import type {
	DeliveryFulfilment,
	DeliveryFulfilmentStore,
	FulfilmentFinalizeInput,
	FulfilmentFinalizeResult,
	FulfilmentRequirementRecord,
} from "@sprite-anvil/api/delivery-fulfilment-records";
import { deliveryFulfilmentSchema } from "@sprite-anvil/api/delivery-fulfilment-records";
import type { DeliveryTargetStore } from "@sprite-anvil/api/delivery-planning-store";
import { exportBundleSha256 } from "@sprite-anvil/api/export-bundle-manifest";
import type { ReadinessPlanStore } from "@sprite-anvil/api/readiness-plans";
import {
	IdempotencyConflictError,
	idempotentRecordId,
	RecordIntegrityError,
} from "@sprite-anvil/api/record-publication";
import type {
	DeliveryFulfilmentStorage,
	StoredDeliveryFulfilment,
} from "./delivery-fulfilment-storage";
import type { FulfilmentMappingStorage } from "./fulfilment-mapping-storage";

export interface DeliveryFulfilmentStoreOptions {
	deliveryTargets: Pick<DeliveryTargetStore, "list">;
	/** Reads the persisted mapping draft the user resolved. */
	drafts: Pick<FulfilmentMappingStorage, "findDraft">;
	now?: () => Date;
	readinessPlans: Pick<ReadinessPlanStore, "get">;
	storage: DeliveryFulfilmentStorage;
}

type Draft = NonNullable<
	Awaited<ReturnType<FulfilmentMappingStorage["findDraft"]>>
>;
type Requirement = Draft["requirements"][number];

const requirementKey = (assetFamilyId: string, itemId: string) =>
	JSON.stringify([assetFamilyId, itemId]);

function newestFirst(
	left: StoredDeliveryFulfilment,
	right: StoredDeliveryFulfilment
) {
	return (
		right.createdAt.getTime() - left.createdAt.getTime() ||
		right.id.localeCompare(left.id)
	);
}

/** The newest Fulfilment of each revision is the current one. */
function toFulfilments(rows: StoredDeliveryFulfilment[]): DeliveryFulfilment[] {
	const seenRevisions = new Set<string>();
	return [...rows].sort(newestFirst).map((row) => {
		const isCurrent = !seenRevisions.has(row.revisionId);
		seenRevisions.add(row.revisionId);
		return deliveryFulfilmentSchema.parse({
			createdAt: row.createdAt.toISOString(),
			deliveryTargetId: row.deliveryTargetId,
			draftId: row.draftId,
			id: row.id,
			isCurrent,
			projectId: row.projectId,
			requirements: row.requirements,
			revisionId: row.revisionId,
			revisionNumber: row.revisionNumber,
		});
	});
}

/** Null selection problems mean the selections are valid for the draft. */
function validateSelections(
	requirements: Requirement[],
	selections: FulfilmentFinalizeInput["selections"]
) {
	const chosen = new Map<string, string>();
	for (const selection of selections) {
		const key = requirementKey(selection.assetFamilyId, selection.itemId);
		const requirement = requirements.find(
			(entry) =>
				requirementKey(entry.assetFamilyId, entry.itemId) === key &&
				entry.status === "conflict"
		);
		const isCandidate = requirement?.candidates.some(
			(candidate) => candidate.bundleId === selection.bundleId
		);
		if (!isCandidate || chosen.has(key)) {
			return null;
		}
		chosen.set(key, selection.bundleId);
	}
	return chosen;
}

function recordOf(
	requirement: Requirement,
	chosenBundleId: string | undefined
): FulfilmentRequirementRecord | null {
	const bundleId = chosenBundleId ?? requirement.proposedBundleId;
	const candidate = requirement.candidates.find(
		(entry) => entry.bundleId === bundleId
	);
	if (!candidate) {
		return null;
	}
	const resolutions = {
		agreed: "identical_pins",
		conflict: "user_selected",
		mapped: "only_bundle",
	} as const;
	if (requirement.status === "missing") {
		return null;
	}
	return {
		assetFamilyId: requirement.assetFamilyId,
		assetFamilyName: requirement.assetFamilyName,
		assetVersionIds: candidate.assetVersionIds,
		bundleId: candidate.bundleId,
		itemId: requirement.itemId,
		itemKind: requirement.itemKind,
		itemName: requirement.itemName,
		manifestDigest: candidate.manifestDigest,
		requiredSetRevisionId: requirement.requiredSetRevisionId,
		resolution: resolutions[requirement.status],
	};
}

/** Every requirement of the draft as a Fulfilment row, or the reason the user's selections cannot make one. */
function resolveRequirements(
	draftRequirements: Requirement[],
	selections: FulfilmentFinalizeInput["selections"]
):
	| { requirements: FulfilmentRequirementRecord[] }
	| {
			reason:
				| "invalid_selection"
				| "missing_requirements"
				| "unresolved_conflicts";
	  } {
	const chosen = validateSelections(draftRequirements, selections);
	if (!chosen) {
		return { reason: "invalid_selection" };
	}
	if (draftRequirements.some((entry) => entry.status === "missing")) {
		return { reason: "missing_requirements" };
	}
	const requirements = draftRequirements.map((requirement) =>
		recordOf(
			requirement,
			chosen.get(requirementKey(requirement.assetFamilyId, requirement.itemId))
		)
	);
	const complete = requirements.filter((record) => record !== null);
	return complete.length === requirements.length
		? { requirements: complete }
		: { reason: "unresolved_conflicts" };
}

/**
 * Creates and re-reads Delivery Fulfilments. A Fulfilment is made only from the
 * persisted draft the user resolved, for the active revision, while the target
 * is still Ready; it covers every requirement, picks no newest bundle, and is
 * never changed once written. A later one for the same revision becomes
 * current and the earlier ones stay as history.
 */
export function createDeliveryFulfilmentStore(
	options: DeliveryFulfilmentStoreOptions
): DeliveryFulfilmentStore {
	const { deliveryTargets, drafts, readinessPlans, storage } = options;
	const now = options.now ?? (() => new Date());

	async function readTarget(
		userId: string,
		input: { deliveryTargetId: string; projectId: string }
	) {
		const catalog = await deliveryTargets.list(userId, input.projectId);
		return (
			catalog?.deliveryTargets.find(
				(target) => target.id === input.deliveryTargetId
			) ?? null
		);
	}

	return {
		async finalize(userId, input): Promise<FulfilmentFinalizeResult | null> {
			const target = await readTarget(userId, input);
			if (!target) {
				return null;
			}
			const draft = await drafts.findDraft(input.projectId, input.draftId);
			if (draft?.deliveryTargetId !== input.deliveryTargetId) {
				return null;
			}
			const id = await idempotentRecordId(
				{
					kind: "delivery-fulfilment",
					projectId: input.projectId,
					targetId: input.deliveryTargetId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await exportBundleSha256(
				JSON.stringify({
					draftId: input.draftId,
					selections: input.selections
						.map((selection) => [
							selection.assetFamilyId,
							selection.itemId,
							selection.bundleId,
						])
						.sort((left, right) =>
							JSON.stringify(left).localeCompare(JSON.stringify(right))
						),
				})
			);
			const replay = async (): Promise<FulfilmentFinalizeResult | null> => {
				const existing = await storage.findFulfilment(input.projectId, id);
				if (!existing) {
					return null;
				}
				if (existing.requestDigest !== requestDigest) {
					throw new IdempotencyConflictError("Delivery Fulfilment");
				}
				return { fulfilment: await read(input, id), status: "replayed" };
			};
			// A retry replays the first Fulfilment even after the target moved on.
			const replayed = await replay();
			if (replayed) {
				return replayed;
			}

			const revision = target.activeRevision;
			if (!revision) {
				return { reason: "no_active_revision", status: "rejected" };
			}
			if (draft.revisionId !== revision.id) {
				return { reason: "revision_changed", status: "rejected" };
			}
			const plan = await readinessPlans.get(userId, input);
			if (
				plan?.status !== "found" ||
				plan.plan.revisionId !== revision.id ||
				plan.plan.targetReadiness !== "ready"
			) {
				return { reason: "target_not_ready", status: "rejected" };
			}
			const resolved = resolveRequirements(
				draft.requirements,
				input.selections
			);
			if ("reason" in resolved) {
				return { reason: resolved.reason, status: "rejected" };
			}
			const { requirements } = resolved;

			const inserted = await storage.insertFulfilment({
				createdAt: now(),
				createdByUserId: userId,
				deliveryTargetId: input.deliveryTargetId,
				draftId: draft.id,
				id,
				projectId: input.projectId,
				requestDigest,
				requirements,
				revisionId: revision.id,
				revisionNumber: revision.revisionNumber,
			});
			if (inserted.status === "conflict") {
				const winner = await replay();
				if (winner) {
					return winner;
				}
			}
			return { fulfilment: await read(input, id), status: "created" };
		},
		async get(userId, input) {
			const found = await storage.findFulfilment(
				input.projectId,
				input.fulfilmentId
			);
			if (!(found && (await deliveryTargets.list(userId, input.projectId)))) {
				return null;
			}
			const siblings = await storage.listFulfilments(
				input.projectId,
				found.deliveryTargetId
			);
			return (
				toFulfilments(siblings).find((entry) => entry.id === found.id) ?? null
			);
		},
		async list(userId, input) {
			if (!(await readTarget(userId, input))) {
				return null;
			}
			return {
				fulfilments: toFulfilments(
					await storage.listFulfilments(input.projectId, input.deliveryTargetId)
				),
			};
		},
	};

	async function read(
		input: { deliveryTargetId: string; projectId: string },
		id: string
	) {
		const rows = await storage.listFulfilments(
			input.projectId,
			input.deliveryTargetId
		);
		const stored = toFulfilments(rows).find((entry) => entry.id === id);
		if (!stored) {
			throw new RecordIntegrityError(
				"The delivery fulfilment could not be re-read from the persisted record."
			);
		}
		return stored;
	}
}
