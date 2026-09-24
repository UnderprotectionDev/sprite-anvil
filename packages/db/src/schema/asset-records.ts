import { defineRelationsPart, sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

type AssetRecordIdentityCriteria =
	| "independent_product_meaning"
	| "independent_lifecycle"
	| "delivery_identity";

type AssetRecordAvailability = "active" | "archived" | "erased";

export const assetRecords = pgTable(
	"asset_records",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		name: text("name").notNull(),
		identityCriteria: text("identity_criteria")
			.array()
			.$type<AssetRecordIdentityCriteria>()
			.notNull(),
		supportLevel: text("support_level").$type<"general">().notNull(),
		availability: text("availability")
			.$type<AssetRecordAvailability>()
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"asset_records_identity_criteria_nonempty_check",
			sql`cardinality(${table.identityCriteria}) >= 1`
		),
		check(
			"asset_records_availability_check",
			sql`${table.availability} IN ('active', 'archived', 'erased')`
		),
		index("asset_records_project_created_at_idx").on(
			table.projectId,
			table.createdAt
		),
		index("asset_records_created_by_user_id_idx").on(table.createdByUserId),
	]
);

export const assetRecordRelations = defineRelationsPart(
	{ user, project, assetRecords },
	(r) => ({
		assetRecords: {
			creator: r.one.user({
				from: r.assetRecords.createdByUserId,
				to: r.user.id,
			}),
			project: r.one.project({
				from: r.assetRecords.projectId,
				to: r.project.id,
			}),
		},
	})
);
