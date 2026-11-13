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
import { diffFulfilments } from "./delivery-diff";
import type {
	DeliveryFulfilmentStorage,
	StoredDeliveryFulfilment,
} from "./delivery-fulfilment-storage";
import type { FulfilmentMappingStorage } from "./fulfilment-mapping-storage";
import {
	isReadyForRevision,
	newestFirst,
	readDeliveryTarget,
	requirementKey,
} from "./fulfilment-support";

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

const resolutions = {
	agreed: "identical_pins",
	conflict: "user_selected",
	mapped: "only_bundle",
} as const;

/**
 * The newest Fulfilment of each revision is the current one. A Fulfilment is
 * verifiable unless a requirement pins an Asset Version that was erased.
 */
function toFulfilments(
	rows: StoredDeliveryFulfilment[],
	erasedVersionIds: ReadonlySet<string>
): DeliveryFulfilment[] {
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
			verifiable: !row.requirements.some((requirement) =>
				requirement.assetVersionIds.some((id) => erasedVersionIds.has(id))
			),
		});
	});
}

/**
 * The bundle the user picked per requirement key, or null when any selection
 * is not a candidate of a conflicting requirement or repeats a requirement.
 */
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

/** The Fulfilment row of one requirement, or null when it has no bundle: missing, or a conflict nobody picked. */
function recordOf(
	requirement: Requirement,
	chosenBundleId: string | undefined
): FulfilmentRequirementRecord | null {
	if (requirement.status === "missing") {
		return null;
	}
	const bundleId = chosenBundleId ?? requirement.proposedBundleId;
	const candidate = requirement.candidates.find(
		(entry) => entry.bundleId === bundleId
	);
	if (!candidate) {
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
				| "no_requirements"
				| "unresolved_conflicts";
	  } {
	// An empty draft would make a vacuous Fulfilment that delivers nothing.
	if (draftRequirements.length === 0) {
		return { reason: "no_requirements" };
	}
	const chosen = validateSelections(draftRequirements, selections);
	if (!chosen) {
		return { reason: "invalid_selection" };
	}
	if (draftRequirements.some((entry) => entry.status === "missing")) {
		return { reason: "missing_requirements" };
	}
	// With nothing missing, a requirement lacking a bundle here is a conflict the user did not resolve.
	const records = draftRequirements.map((requirement) =>
		recordOf(
			requirement,
			chosen.get(requirementKey(requirement.assetFamilyId, requirement.itemId))
		)
	);
	const requirements = records.filter((record) => record !== null);
	return requirements.length === records.length
		? { requirements }
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

	const readTarget = (
		userId: string,
		input: { deliveryTargetId: string; projectId: string }
	) => readDeliveryTarget(deliveryTargets, userId, input);

	/** The rows as Fulfilments, with their verifiability read from the Erasure Tombstones at this moment. */
	const present = async (
		projectId: string,
		rows: StoredDeliveryFulfilment[]
	) => {
		const pinned = new Set(
			rows.flatMap((row) =>
				row.requirements.flatMap((requirement) => requirement.assetVersionIds)
			)
		);
		return toFulfilments(
			rows,
			await storage.erasedAssetVersionIds(projectId, [...pinned])
		);
	};

	return {
		async compare(userId, input) {
			const catalog = await deliveryTargets.list(userId, input.projectId);
			if (!catalog) {
				return null;
			}
			const [from, to] = await Promise.all([
				storage.findFulfilment(input.projectId, input.fromFulfilmentId),
				storage.findFulfilment(input.projectId, input.toFulfilmentId),
			]);
			if (!(from && to)) {
				return null;
			}
			return diffFulfilments(from, to, catalog);
		},
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
			if (
				!(await isReadyForRevision(readinessPlans, userId, input, revision))
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
				(await present(input.projectId, siblings)).find(
					(entry) => entry.id === found.id
				) ?? null
			);
		},
		async list(userId, input) {
			if (!(await readTarget(userId, input))) {
				return null;
			}
			return {
				fulfilments: await present(
					input.projectId,
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
		const stored = (await present(input.projectId, rows)).find(
			(entry) => entry.id === id
		);
		if (!stored) {
			throw new RecordIntegrityError(
				"The delivery fulfilment could not be re-read from the persisted record."
			);
		}
		return stored;
	}
}
