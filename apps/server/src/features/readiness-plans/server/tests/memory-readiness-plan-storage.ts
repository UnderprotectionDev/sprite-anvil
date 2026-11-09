import type { ReadinessPlanStorage } from "../readiness-plan-storage";

/** An in-memory ReadinessPlanStorage with one ordering per Delivery Target revision, like the database store. */
export function createMemoryReadinessPlanStorage() {
	const orders = new Map<string, string[]>();
	const key = (projectId: string, revisionId: string) =>
		`${projectId}:${revisionId}`;
	const storage: ReadinessPlanStorage = {
		findOrder: (projectId, revisionId) =>
			Promise.resolve(orders.get(key(projectId, revisionId)) ?? null),
		saveOrder: (order) => {
			orders.set(key(order.projectId, order.revisionId), [
				...order.orderedWorkIds,
			]);
			return Promise.resolve();
		},
	};
	return { storage };
}
