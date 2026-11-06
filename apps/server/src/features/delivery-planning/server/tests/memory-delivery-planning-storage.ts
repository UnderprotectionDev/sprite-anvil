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
	let pendingRevisionConflicts = 0;

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
				return Promise.resolve("draft_exists");
			}
			const knownTarget = targets.get(target.id);
			if (knownTarget && knownTarget.projectId !== draft.projectId) {
				return Promise.resolve("target_in_other_project");
			}
			if (!knownTarget) {
				targets.set(target.id, target);
			}
			drafts.set(draft.id, draft);
			return Promise.resolve("inserted");
		},
		insertRevision: (revision) => {
			if (revisions.some((existing) => existing.draftId === revision.draftId)) {
				return Promise.resolve({ status: "conflict" });
			}
			if (pendingRevisionConflicts > 0) {
				pendingRevisionConflicts -= 1;
				return Promise.resolve({ status: "conflict" });
			}
			const stored = {
				...revision,
				revisionNumber:
					Math.max(
						0,
						...revisions
							.filter(
								(existing) =>
									existing.deliveryTargetId === revision.deliveryTargetId
							)
							.map((existing) => existing.revisionNumber)
					) + 1,
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

	return {
		/** Makes the next `count` revision inserts lose the revision-number race, as a concurrent activation would. */
		failNextRevisionInserts: (count: number) => {
			pendingRevisionConflicts = count;
		},
		storage,
	};
}
