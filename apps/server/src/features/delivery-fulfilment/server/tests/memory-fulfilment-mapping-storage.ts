import type {
	FulfilmentMappingStorage,
	StoredFulfilmentMappingDraft,
} from "../fulfilment-mapping-storage";

/** An in-memory FulfilmentMappingStorage with the same insert-only behavior as the database store. */
export function createMemoryFulfilmentMappingStorage(): FulfilmentMappingStorage & {
	snapshot: () => string;
} {
	const drafts = new Map<string, StoredFulfilmentMappingDraft>();
	return {
		findDraft: (projectId, draftId) => {
			const found = drafts.get(draftId);
			return Promise.resolve(
				found?.projectId === projectId ? structuredClone(found) : null
			);
		},
		insertDraft: (draft) => {
			if (drafts.has(draft.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			drafts.set(draft.id, structuredClone(draft));
			return Promise.resolve({ status: "inserted" });
		},
		listDrafts: (projectId, deliveryTargetId) =>
			Promise.resolve(
				[...drafts.values()]
					.filter(
						(row) =>
							row.projectId === projectId &&
							row.deliveryTargetId === deliveryTargetId
					)
					// Deliberately unordered: the store must sort newest first.
					.sort(
						(left, right) =>
							left.createdAt.getTime() - right.createdAt.getTime()
					)
					.map((row) => structuredClone(row))
			),
		snapshot: () => JSON.stringify([...drafts.values()]),
	};
}
