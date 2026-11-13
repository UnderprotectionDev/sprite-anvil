import type {
	DeliveryFulfilmentStorage,
	StoredDeliveryFulfilment,
} from "../delivery-fulfilment-storage";

/** An in-memory DeliveryFulfilmentStorage with the same insert-only behavior as the database store. */
export function createMemoryDeliveryFulfilmentStorage(): DeliveryFulfilmentStorage & {
	/** Models the Erasure Tombstones of erased Asset Versions; the Fulfilment rows are not touched. */
	markErased: (assetVersionIds: string[]) => void;
	snapshot: () => string;
} {
	const rows = new Map<string, StoredDeliveryFulfilment>();
	const erased = new Set<string>();
	return {
		erasedAssetVersionIds: (_projectId, assetVersionIds) =>
			Promise.resolve(new Set(assetVersionIds.filter((id) => erased.has(id)))),
		findFulfilment: (projectId, fulfilmentId) => {
			const found = rows.get(fulfilmentId);
			return Promise.resolve(
				found?.projectId === projectId ? structuredClone(found) : null
			);
		},
		hasFulfilment: (projectId, revisionId) =>
			Promise.resolve(
				[...rows.values()].some(
					(row) => row.projectId === projectId && row.revisionId === revisionId
				)
			),
		insertFulfilment: (fulfilment) => {
			if (rows.has(fulfilment.id)) {
				return Promise.resolve({ status: "conflict" });
			}
			rows.set(fulfilment.id, structuredClone(fulfilment));
			return Promise.resolve({ status: "inserted" });
		},
		listFulfilments: (projectId, deliveryTargetId) =>
			Promise.resolve(
				[...rows.values()]
					.filter(
						(row) =>
							row.projectId === projectId &&
							row.deliveryTargetId === deliveryTargetId
					)
					// Deliberately unordered: the store must decide which one is current.
					.sort(
						(left, right) =>
							left.createdAt.getTime() - right.createdAt.getTime()
					)
					.map((row) => structuredClone(row))
			),
		markErased: (assetVersionIds) => {
			for (const id of assetVersionIds) {
				erased.add(id);
			}
		},
		snapshot: () => JSON.stringify([...rows.values()]),
	};
}
