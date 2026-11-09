import type { Database } from "@sprite-anvil/db";
import { readinessPlanOrders } from "@sprite-anvil/db/schema/readiness-plans";
import { and, eq } from "drizzle-orm";
import type { ReadinessPlanStorage } from "./readiness-plan-storage";

export function createDatabaseReadinessPlanStorage(
	db: Database
): ReadinessPlanStorage {
	return {
		async findOrder(projectId, revisionId) {
			const [row] = await db
				.select({ orderedWorkIds: readinessPlanOrders.orderedWorkIds })
				.from(readinessPlanOrders)
				.where(
					and(
						eq(readinessPlanOrders.projectId, projectId),
						eq(readinessPlanOrders.deliveryTargetRevisionId, revisionId)
					)
				);
			return row?.orderedWorkIds ?? null;
		},
		async saveOrder(order) {
			const values = {
				orderedWorkIds: order.orderedWorkIds,
				updatedAt: order.updatedAt,
				updatedByUserId: order.updatedByUserId,
			};
			await db
				.insert(readinessPlanOrders)
				.values({
					...values,
					deliveryTargetRevisionId: order.revisionId,
					projectId: order.projectId,
				})
				.onConflictDoUpdate({
					set: values,
					target: readinessPlanOrders.deliveryTargetRevisionId,
				});
		},
	};
}
