import {
	type DeliveryTargetActivateResult,
	type DeliveryTargetCatalog,
	type DeliveryTargetDraft,
	type DeliveryTargetDraftSaveInput,
	type DeliveryTargetDraftSaveResult,
	type DeliveryTargetFamilyScope,
	type DeliveryTargetRevision,
	type DeliveryTargetScopeDiff,
	type DeliveryTargetStore,
	deliveryTargetDraftSchema,
	deliveryTargetRevisionSchema,
	deliveryTargetSchema,
} from "@sprite-anvil/api/delivery-planning";
import { requiredSetItemSchema } from "@sprite-anvil/api/family-readiness";
import { z } from "zod";
import type {
	ContextRevisionSnapshot,
	DeliveryPlanningStorage,
	PinnedFamily,
	RequiredSetRevisionSnapshot,
	StoredDeliveryTarget,
	StoredDeliveryTargetDraft,
	StoredDeliveryTargetRevision,
} from "./delivery-planning-storage";

const maxRevisionAttempts = 3;
const requiredSetItemsSchema = z.array(requiredSetItemSchema);

interface PinnedSnapshots {
	contexts: Map<string, ContextRevisionSnapshot>;
	requiredSets: Map<string, RequiredSetRevisionSnapshot>;
}

export interface DeliveryTargetStoreOptions {
	canAccessProject: (userId: string, projectId: string) => Promise<boolean>;
	now?: () => Date;
	storage: DeliveryPlanningStorage;
}

function describeFamily(
	pin: PinnedFamily,
	snapshots: PinnedSnapshots
): DeliveryTargetFamilyScope {
	const revision = snapshots.requiredSets.get(pin.requiredSetRevisionId);
	if (!revision) {
		throw new Error(
			`Pinned Required Items List revision ${pin.requiredSetRevisionId} is missing.`
		);
	}
	const items = requiredSetItemsSchema.parse(revision.items);
	return {
		assetFamilyId: pin.assetFamilyId,
		assetFamilyName: revision.assetFamilyName,
		requiredItems: items.filter(
			(item) => item.disposition === "required" && item.kind !== "usage_test"
		),
		requiredSetRevisionId: revision.id,
		requiredSetRevisionNumber: revision.revisionNumber,
		usageTests: items.filter(
			(item) => item.disposition === "required" && item.kind === "usage_test"
		),
	};
}

function describeScope(
	stored: { contextRevisionId: string; families: PinnedFamily[] },
	snapshots: PinnedSnapshots
) {
	const context = snapshots.contexts.get(stored.contextRevisionId);
	if (!context) {
		throw new Error(
			`Pinned Context Revision ${stored.contextRevisionId} is missing.`
		);
	}
	return {
		contextRevisionId: context.id,
		contextRevisionNumber: context.revisionNumber,
		families: stored.families.map((pin) => describeFamily(pin, snapshots)),
	};
}

/** Key- and element-order independent form; every array in an evidence policy is a set. */
function canonicalPolicy(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalPolicy).sort().join(",")}]`;
	}
	if (typeof value === "object" && value !== null) {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalPolicy(entry)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

function samePolicy(left: unknown, right: unknown) {
	return canonicalPolicy(left) === canonicalPolicy(right);
}

function sameDraftContent(
	stored: StoredDeliveryTargetDraft,
	target: StoredDeliveryTarget | null,
	input: DeliveryTargetDraftSaveInput
) {
	return (
		target?.name === input.name &&
		target.purpose === input.purpose &&
		stored.deliveryTargetId === input.deliveryTargetId &&
		stored.contextRevisionId === input.contextRevisionId &&
		stored.families.length === input.families.length &&
		stored.families.every(
			(family, index) =>
				family.assetFamilyId === input.families[index]?.assetFamilyId &&
				family.requiredSetRevisionId ===
					input.families[index]?.requiredSetRevisionId
		) &&
		samePolicy(
			stored.productionEvidencePolicy,
			input.productionEvidencePolicy
		) &&
		samePolicy(stored.rightsEvidencePolicy, input.rightsEvidencePolicy)
	);
}

/** Compares a revision's base with the target's previous revision; both are immutable, so the diff is derived on read. */
function diffAgainstPrevious(
	revision: StoredDeliveryTargetRevision,
	previous: StoredDeliveryTargetRevision | undefined,
	snapshots: PinnedSnapshots
): DeliveryTargetScopeDiff | null {
	if (!previous) {
		return null;
	}
	const current = describeScope(revision, snapshots);
	const before = describeScope(previous, snapshots);
	const beforeByFamily = new Map(
		before.families.map((family) => [family.assetFamilyId, family])
	);
	const currentByFamily = new Map(
		current.families.map((family) => [family.assetFamilyId, family])
	);
	const nameOf = (family: DeliveryTargetFamilyScope) => ({
		assetFamilyId: family.assetFamilyId,
		assetFamilyName: family.assetFamilyName,
	});
	return {
		contextChange:
			current.contextRevisionId === before.contextRevisionId
				? null
				: {
						fromRevisionId: before.contextRevisionId,
						fromRevisionNumber: before.contextRevisionNumber,
						toRevisionId: current.contextRevisionId,
						toRevisionNumber: current.contextRevisionNumber,
					},
		familiesAdded: current.families
			.filter((family) => !beforeByFamily.has(family.assetFamilyId))
			.map(nameOf),
		familiesRemoved: before.families
			.filter((family) => !currentByFamily.has(family.assetFamilyId))
			.map(nameOf),
		previousRevisionId: previous.id,
		previousRevisionNumber: previous.revisionNumber,
		productionEvidencePolicyChanged: !samePolicy(
			previous.productionEvidencePolicy,
			revision.productionEvidencePolicy
		),
		requiredSetChanges: current.families.flatMap((family) => {
			const old = beforeByFamily.get(family.assetFamilyId);
			return old && old.requiredSetRevisionId !== family.requiredSetRevisionId
				? [
						{
							...nameOf(family),
							fromRevisionId: old.requiredSetRevisionId,
							fromRevisionNumber: old.requiredSetRevisionNumber,
							toRevisionId: family.requiredSetRevisionId,
							toRevisionNumber: family.requiredSetRevisionNumber,
						},
					]
				: [];
		}),
		rightsEvidencePolicyChanged: !samePolicy(
			previous.rightsEvidencePolicy,
			revision.rightsEvidencePolicy
		),
	};
}

function toDraft(
	draft: StoredDeliveryTargetDraft,
	activatedRevisionId: string | null,
	snapshots: PinnedSnapshots
): DeliveryTargetDraft {
	return deliveryTargetDraftSchema.parse({
		...describeScope(draft, snapshots),
		activatedRevisionId,
		productionEvidencePolicy: draft.productionEvidencePolicy,
		rightsEvidencePolicy: draft.rightsEvidencePolicy,
		createdAt: draft.createdAt.toISOString(),
		id: draft.id,
	});
}

function toRevision(
	revision: StoredDeliveryTargetRevision,
	previous: StoredDeliveryTargetRevision | undefined,
	snapshots: PinnedSnapshots
): DeliveryTargetRevision {
	return deliveryTargetRevisionSchema.parse({
		...describeScope(revision, snapshots),
		activatedAt: revision.activatedAt.toISOString(),
		draftId: revision.draftId,
		id: revision.id,
		productionEvidencePolicy: revision.productionEvidencePolicy,
		revisionNumber: revision.revisionNumber,
		rightsEvidencePolicy: revision.rightsEvidencePolicy,
		scopeDiff: diffAgainstPrevious(revision, previous, snapshots),
	});
}

function previousRevisionOf(
	revision: StoredDeliveryTargetRevision,
	all: StoredDeliveryTargetRevision[]
) {
	return all.find(
		(candidate) =>
			candidate.deliveryTargetId === revision.deliveryTargetId &&
			candidate.revisionNumber === revision.revisionNumber - 1
	);
}

async function loadSnapshots(
	storage: DeliveryPlanningStorage,
	projectId: string,
	scopes: { contextRevisionId: string; families: PinnedFamily[] }[]
): Promise<PinnedSnapshots> {
	const contextIds = [
		...new Set(scopes.map((scope) => scope.contextRevisionId)),
	];
	const requiredSetIds = [
		...new Set(
			scopes.flatMap((scope) =>
				scope.families.map((family) => family.requiredSetRevisionId)
			)
		),
	];
	const [contexts, requiredSets] = await Promise.all([
		storage.findContextRevisions(projectId, contextIds),
		storage.findRequiredSetRevisions(projectId, requiredSetIds),
	]);
	return {
		contexts: new Map(contexts.map((context) => [context.id, context])),
		requiredSets: new Map(
			requiredSets.map((revision) => [revision.id, revision])
		),
	};
}

/** Project-scoped Delivery Target planning: drafts are prepared, only an activation creates a revision. */
export function createDeliveryTargetStore(
	options: DeliveryTargetStoreOptions
): DeliveryTargetStore {
	const { canAccessProject, storage } = options;
	const now = options.now ?? (() => new Date());

	async function readDraft(
		projectId: string,
		draft: StoredDeliveryTargetDraft
	) {
		const [snapshots, revision] = await Promise.all([
			loadSnapshots(storage, projectId, [draft]),
			storage.findRevisionForDraft(projectId, draft.id),
		]);
		return toDraft(draft, revision?.id ?? null, snapshots);
	}

	/** The draft already stored under the input's id: the same content is an idempotent re-save, different content a conflict. */
	async function resolveExistingDraft(
		stored: StoredDeliveryTargetDraft,
		input: DeliveryTargetDraftSaveInput
	): Promise<DeliveryTargetDraftSaveResult> {
		const target = await storage.findTarget(
			input.projectId,
			stored.deliveryTargetId
		);
		if (!sameDraftContent(stored, target, input)) {
			return { reason: "draft_id_conflict", status: "rejected" };
		}
		return {
			draft: await readDraft(input.projectId, stored),
			status: "saved",
		};
	}

	async function readRevision(
		projectId: string,
		revision: StoredDeliveryTargetRevision
	) {
		const previous = previousRevisionOf(
			revision,
			await storage.listRevisions(projectId)
		);
		return toRevision(
			revision,
			previous,
			await loadSnapshots(
				storage,
				projectId,
				previous ? [revision, previous] : [revision]
			)
		);
	}

	return {
		async activate(userId, input) {
			if (!(await canAccessProject(userId, input.projectId))) {
				return null;
			}
			const draft = await storage.findDraft(input.projectId, input.draftId);
			if (!draft) {
				return null;
			}
			const activateOnce = async (
				attemptsLeft: number
			): Promise<DeliveryTargetActivateResult> => {
				const existing = await storage.findRevisionForDraft(
					input.projectId,
					draft.id
				);
				if (existing) {
					return {
						revision: await readRevision(input.projectId, existing),
						status: "activated",
					};
				}
				if (attemptsLeft === 0) {
					return { status: "revision_number_conflict" };
				}
				const result = await storage.insertRevision({
					activatedAt: now(),
					activatedByUserId: userId,
					contextRevisionId: draft.contextRevisionId,
					deliveryTargetId: draft.deliveryTargetId,
					draftId: draft.id,
					families: draft.families,
					id: input.id,
					productionEvidencePolicy: draft.productionEvidencePolicy,
					rightsEvidencePolicy: draft.rightsEvidencePolicy,
					projectId: input.projectId,
				});
				return result.status === "inserted"
					? {
							revision: await readRevision(input.projectId, result.revision),
							status: "activated",
						}
					: activateOnce(attemptsLeft - 1);
			};
			return activateOnce(maxRevisionAttempts);
		},

		async list(userId, projectId): Promise<DeliveryTargetCatalog | null> {
			if (!(await canAccessProject(userId, projectId))) {
				return null;
			}
			const [targets, drafts, revisions] = await Promise.all([
				storage.listTargets(projectId),
				storage.listDrafts(projectId),
				storage.listRevisions(projectId),
			]);
			const snapshots = await loadSnapshots(storage, projectId, [
				...drafts,
				...revisions,
			]);
			const activatedByDraft = new Map(
				revisions.map((revision) => [revision.draftId, revision.id])
			);
			return {
				deliveryTargets: targets.map((target) => {
					const targetRevisions = revisions
						.filter((revision) => revision.deliveryTargetId === target.id)
						.sort((left, right) => left.revisionNumber - right.revisionNumber)
						.map((revision) =>
							toRevision(
								revision,
								previousRevisionOf(revision, revisions),
								snapshots
							)
						);
					return deliveryTargetSchema.parse({
						activeRevision: targetRevisions.at(-1) ?? null,
						drafts: drafts
							.filter((draft) => draft.deliveryTargetId === target.id)
							.sort(
								(left, right) =>
									left.createdAt.getTime() - right.createdAt.getTime() ||
									left.id.localeCompare(right.id)
							)
							.map((draft) =>
								toDraft(
									draft,
									activatedByDraft.get(draft.id) ?? null,
									snapshots
								)
							),
						id: target.id,
						name: target.name,
						purpose: target.purpose,
						revisions: targetRevisions,
					});
				}),
			};
		},

		async saveDraft(userId, input) {
			if (!(await canAccessProject(userId, input.projectId))) {
				return null;
			}
			const existing = await storage.findDraft(input.projectId, input.id);
			if (existing) {
				return resolveExistingDraft(existing, input);
			}
			const snapshots = await loadSnapshots(storage, input.projectId, [
				{
					contextRevisionId: input.contextRevisionId,
					families: input.families,
				},
			]);
			if (!snapshots.contexts.has(input.contextRevisionId)) {
				return { reason: "context_revision_not_found", status: "rejected" };
			}
			const everyListBelongsToItsFamily = input.families.every(
				(family) =>
					snapshots.requiredSets.get(family.requiredSetRevisionId)
						?.assetFamilyId === family.assetFamilyId
			);
			if (!everyListBelongsToItsFamily) {
				return {
					reason: "required_set_revision_not_found",
					status: "rejected",
				};
			}
			const pinnedFamilyIds = new Set(
				input.families.map((family) => family.assetFamilyId)
			);
			if (
				!input.productionEvidencePolicy.familyRequirements.every((entry) =>
					pinnedFamilyIds.has(entry.assetFamilyId)
				)
			) {
				return { reason: "policy_family_not_pinned", status: "rejected" };
			}
			const target = (await storage.findTarget(
				input.projectId,
				input.deliveryTargetId
			)) ?? {
				id: input.deliveryTargetId,
				name: input.name,
				projectId: input.projectId,
				purpose: input.purpose,
			};
			const draft: StoredDeliveryTargetDraft = {
				contextRevisionId: input.contextRevisionId,
				createdAt: now(),
				createdByUserId: userId,
				deliveryTargetId: target.id,
				families: input.families,
				id: input.id,
				productionEvidencePolicy: input.productionEvidencePolicy,
				projectId: input.projectId,
				rightsEvidencePolicy: input.rightsEvidencePolicy,
			};
			const inserted = await storage.insertDraft(target, draft);
			if (inserted === "target_in_other_project") {
				return { reason: "delivery_target_unavailable", status: "rejected" };
			}
			if (inserted === "draft_exists") {
				// A concurrent save of this same draft won; compare with what it stored.
				const stored = await storage.findDraft(input.projectId, input.id);
				if (!stored) {
					throw new Error("The Delivery Target draft could not be saved.");
				}
				return resolveExistingDraft(stored, input);
			}
			return {
				draft: await readDraft(input.projectId, draft),
				status: "saved",
			};
		},
	};
}
