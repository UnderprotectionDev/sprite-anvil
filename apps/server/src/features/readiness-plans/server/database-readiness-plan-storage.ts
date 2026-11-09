import type { Database } from "@sprite-anvil/db";
import { deliveryTargetRevisions } from "@sprite-anvil/db/schema/delivery-planning";
import { readinessPlanOrders } from "@sprite-anvil/db/schema/readiness-plans";
import { and, eq, gt, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ReadinessPlanStorage } from "./readiness-plan-storage";

const newerRevision = alias(deliveryTargetRevisions, "newer_revision");

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
			// One statement: the order is written only while the revision is still the
			// Delivery Target's latest, so activating a newer revision cannot be raced.
			const saved = await db
				.insert(readinessPlanOrders)
				.select(
					db
						.select({
							deliveryTargetRevisionId: deliveryTargetRevisions.id,
							projectId: deliveryTargetRevisions.projectId,
							orderedWorkIds: sql<
								string[]
							>`${JSON.stringify(order.orderedWorkIds)}::jsonb`.as(
								"ordered_work_ids"
							),
							updatedByUserId: sql<string>`${order.updatedByUserId}`.as(
								"updated_by_user_id"
							),
							updatedAt:
								sql<Date>`${order.updatedAt.toISOString()}::timestamp`.as(
									"updated_at"
								),
						})
						.from(deliveryTargetRevisions)
						.where(
							and(
								eq(deliveryTargetRevisions.id, order.revisionId),
								eq(deliveryTargetRevisions.projectId, order.projectId),
								eq(
									deliveryTargetRevisions.deliveryTargetId,
									order.deliveryTargetId
								),
								notExists(
									db
										.select({ id: newerRevision.id })
										.from(newerRevision)
										.where(
											and(
												eq(
													newerRevision.deliveryTargetId,
													order.deliveryTargetId
												),
												gt(
													newerRevision.revisionNumber,
													deliveryTargetRevisions.revisionNumber
												)
											)
										)
								)
							)
						)
				)
				.onConflictDoUpdate({
					set: {
						orderedWorkIds: sql`excluded.ordered_work_ids`,
						updatedAt: sql`excluded.updated_at`,
						updatedByUserId: sql`excluded.updated_by_user_id`,
					},
					target: readinessPlanOrders.deliveryTargetRevisionId,
				})
				.returning({ id: readinessPlanOrders.deliveryTargetRevisionId });
			return saved.length > 0;
		},
	};
}
