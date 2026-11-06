import type {
	ContextRevisionSnapshot,
	DeliveryPlanningStorage,
	RequiredSetRevisionSnapshot,
	StoredDeliveryTarget,
	StoredDeliveryTargetDraft,
	StoredDeliveryTargetRevision,
} from "../delivery-planning-storage";

/**
 * An in-memory DeliveryPlanningStorage with the same uniqueness rules as the
 * database store. `contextRevisions` and `requiredSetRevisions` stand for the
 * rows owned by other features; the storage only reads them, so a test can
 * compare them before and after to prove planning left them alone.
 */
export function createMemoryDeliveryPlanningStorage(seed: {
	contextRevisions: ContextRevisionSnapshot[];
	requiredSetRevisions: RequiredSetRevisionSnapshot[];
}) {
	const targets = new Map<string, StoredDeliveryTarget>();
	const drafts = new Map<string, StoredDeliveryTargetDraft>();
	const revisions: StoredDeliveryTargetRevision[] = [];

	const storage: DeliveryPlanningStorage = {
		findContextRevisions: (_projectId, ids) =>
			Promise.resolve(
				seed.contextRevisions.filter((revision) => ids.includes(revision.id))
			),
		findDraft: (projectId, draftId) => {
			const draft = drafts.get(draftId);
			return Promise.resolve(draft?.projectId === projectId ? draft : null);
		},
		findRequiredSetRevisions: (_projectId, ids) =>
			Promise.resolve(
				seed.requiredSetRevisions.filter((revision) =>
					ids.includes(revision.id)
				)
			),
		findRevisionForDraft: (projectId, draftId) =>
			Promise.resolve(
				revisions.find(
					(revision) =>
						revision.projectId === projectId && revision.draftId === draftId
				) ?? null
			),
		findTarget: (projectId, deliveryTargetId) => {
			const target = targets.get(deliveryTargetId);
			return Promise.resolve(target?.projectId === projectId ? target : null);
		},
		insertDraft: (target, draft) => {
			if (drafts.has(draft.id)) {
				return Promise.resolve(false);
			}
			if (!targets.has(target.id)) {
				targets.set(target.id, target);
			}
			drafts.set(draft.id, draft);
			return Promise.resolve(true);
		},
		insertRevision: (revision) => {
			if (revisions.some((existing) => existing.draftId === revision.draftId)) {
				return Promise.resolve({ status: "conflict" });
			}
			const stored = {
				...revision,
				revisionNumber:
					revisions.filter(
						(existing) =>
							existing.deliveryTargetId === revision.deliveryTargetId
					).length + 1,
			};
			revisions.push(stored);
			return Promise.resolve({ revision: stored, status: "inserted" });
		},
		listDrafts: (projectId) =>
			Promise.resolve(
				[...drafts.values()].filter((draft) => draft.projectId === projectId)
			),
		listRevisions: (projectId) =>
			Promise.resolve(
				revisions.filter((revision) => revision.projectId === projectId)
			),
		listTargets: (projectId) =>
			Promise.resolve(
				[...targets.values()].filter((target) => target.projectId === projectId)
			),
	};

	return { storage };
}
