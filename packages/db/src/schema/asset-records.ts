import { defineRelationsPart, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { visualWorlds } from "./context-scopes";
import { project } from "./project";

type AssetRecordIdentityCriteria =
	| "independent_product_meaning"
	| "independent_lifecycle"
	| "delivery_identity";

type AssetRecordAvailability = "active" | "archived" | "erased";

export const assetFamilies = pgTable(
	"asset_families",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		visualWorldId: text("visual_world_id").notNull(),
		canonicalVersionId: text("canonical_version_id"),
		name: text("name").notNull(),
		useContext: text("use_context").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("asset_families_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("asset_families_project_version_idx").on(
			table.projectId,
			table.id,
			table.canonicalVersionId
		),
		foreignKey({
			name: "asset_families_project_visual_world_fk",
			columns: [table.projectId, table.visualWorldId],
			foreignColumns: [visualWorlds.projectId, visualWorlds.id],
		}).onDelete("restrict"),
		uniqueIndex("asset_families_project_name_ci_idx").on(
			table.projectId,
			sql`lower(${table.name})`
		),
	]
);

export const assetRecords = pgTable(
	"asset_records",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		assetFamilyId: text("asset_family_id"),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		name: text("name").notNull(),
		identityCriteria: text("identity_criteria")
			.array()
			.$type<AssetRecordIdentityCriteria>(),
		supportLevel: text("support_level").$type<"general">().notNull(),
		availability: text("availability")
			.$type<AssetRecordAvailability>()
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"asset_records_identity_criteria_nonempty_check",
			sql`${table.identityCriteria} IS NULL OR cardinality(${table.identityCriteria}) >= 1`
		),
		check(
			"asset_records_availability_check",
			sql`${table.availability} IN ('active', 'archived', 'erased')`
		),
		uniqueIndex("asset_records_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("asset_records_project_id_family_idx").on(
			table.projectId,
			table.id,
			table.assetFamilyId
		),
		foreignKey({
			name: "asset_records_project_asset_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("restrict"),
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
