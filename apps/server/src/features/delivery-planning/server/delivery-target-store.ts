import {
	type DeliveryTargetCatalog,
	type DeliveryTargetDraft,
	type DeliveryTargetFamilyScope,
	type DeliveryTargetRevision,
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

function toDraft(
	draft: StoredDeliveryTargetDraft,
	activatedRevisionId: string | null,
	snapshots: PinnedSnapshots
): DeliveryTargetDraft {
	return deliveryTargetDraftSchema.parse({
		...describeScope(draft, snapshots),
		activatedRevisionId,
		createdAt: draft.createdAt.toISOString(),
		id: draft.id,
	});
}

function toRevision(
	revision: StoredDeliveryTargetRevision,
	snapshots: PinnedSnapshots
): DeliveryTargetRevision {
	return deliveryTargetRevisionSchema.parse({
		...describeScope(revision, snapshots),
		activatedAt: revision.activatedAt.toISOString(),
		draftId: revision.draftId,
		id: revision.id,
		revisionNumber: revision.revisionNumber,
	});
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

	async function readRevision(
		projectId: string,
		revision: StoredDeliveryTargetRevision
	) {
		return toRevision(
			revision,
			await loadSnapshots(storage, projectId, [revision])
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
			): Promise<DeliveryTargetRevision> => {
				const existing = await storage.findRevisionForDraft(
					input.projectId,
					draft.id
				);
				if (existing) {
					return readRevision(input.projectId, existing);
				}
				if (attemptsLeft === 0) {
					throw new Error(
						"The Delivery Target revision number was taken repeatedly; try activating again."
					);
				}
				const result = await storage.insertRevision({
					activatedAt: now(),
					activatedByUserId: userId,
					contextRevisionId: draft.contextRevisionId,
					deliveryTargetId: draft.deliveryTargetId,
					draftId: draft.id,
					families: draft.families,
					id: input.id,
					projectId: input.projectId,
				});
				return result.status === "inserted"
					? readRevision(input.projectId, result.revision)
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
						.map((revision) => toRevision(revision, snapshots));
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
				return {
					draft: await readDraft(input.projectId, existing),
					status: "saved",
				};
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
				projectId: input.projectId,
			};
			if (!(await storage.insertDraft(target, draft))) {
				// A concurrent save of this same draft won; return what it stored.
				const stored = await storage.findDraft(input.projectId, input.id);
				if (!stored) {
					throw new Error("The Delivery Target draft could not be saved.");
				}
				return {
					draft: await readDraft(input.projectId, stored),
					status: "saved",
				};
			}
			return {
				draft: await readDraft(input.projectId, draft),
				status: "saved",
			};
		},
	};
}
