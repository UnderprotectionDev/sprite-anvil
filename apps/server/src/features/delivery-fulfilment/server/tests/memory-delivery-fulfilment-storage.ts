import type {
	DeliveryFulfilmentStorage,
	StoredDeliveryFulfilment,
} from "../delivery-fulfilment-storage";

/** An in-memory DeliveryFulfilmentStorage with the same insert-only behavior as the database store. */
export function createMemoryDeliveryFulfilmentStorage(): DeliveryFulfilmentStorage & {
	snapshot: () => string;
} {
	const rows = new Map<string, StoredDeliveryFulfilment>();
	return {
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
		snapshot: () => JSON.stringify([...rows.values()]),
	};
}
