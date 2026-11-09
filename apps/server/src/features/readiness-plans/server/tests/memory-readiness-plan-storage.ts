import type { ReadinessPlanStorage } from "../readiness-plan-storage";

/**
 * An in-memory ReadinessPlanStorage with one ordering per Delivery Target
 * revision, like the database store. `activeRevisionIdOf` answers which
 * revision is active at write time, as the database's conditional write does.
 */
export function createMemoryReadinessPlanStorage(
	activeRevisionIdOf: (deliveryTargetId: string) => string | null = () => null
) {
	const orders = new Map<string, string[]>();
	const key = (projectId: string, revisionId: string) =>
		`${projectId}:${revisionId}`;
	const storage: ReadinessPlanStorage = {
		findOrder: (projectId, revisionId) =>
			Promise.resolve(orders.get(key(projectId, revisionId)) ?? null),
		saveOrder: (order) => {
			if (activeRevisionIdOf(order.deliveryTargetId) !== order.revisionId) {
				return Promise.resolve(false);
			}
			orders.set(key(order.projectId, order.revisionId), [
				...order.orderedWorkIds,
			]);
			return Promise.resolve(true);
		},
	};
	return { storage };
}
