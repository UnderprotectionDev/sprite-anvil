import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { deliveryTargetRevisions } from "./delivery-planning";
import { project } from "./project";

/**
 * The user's order of one Delivery Target revision's Readiness Plan work. It is
 * the only stored part of a plan: blockers and work are derived on every read,
 * so this holds the user's priority and nothing computed.
 */
export const readinessPlanOrders = pgTable("readiness_plan_orders", {
	deliveryTargetRevisionId: text("delivery_target_revision_id")
		.primaryKey()
		.references(() => deliveryTargetRevisions.id, { onDelete: "cascade" }),
	projectId: text("project_id")
		.notNull()
		.references(() => project.id, { onDelete: "cascade" }),
	orderedWorkIds: jsonb("ordered_work_ids").$type<string[]>().notNull(),
	updatedByUserId: text("updated_by_user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
