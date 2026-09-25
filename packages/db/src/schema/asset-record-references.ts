import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { assetRecords } from "./asset-records";
import { assetVersions } from "./asset-versions";
import { user } from "./auth";

export const assetRecordReferences = pgTable(
	"asset_record_references",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		targetVersionId: text("target_version_id").notNull(),
		role: text("role")
			.$type<
				| "identity"
				| "pose"
				| "style"
				| "palette"
				| "equipment"
				| "composition"
				| "theme"
				| "custom"
			>()
			.notNull(),
		transferredFeatures: text("transferred_features").array().notNull(),
		forbiddenFeatures: text("forbidden_features").array().notNull(),
		notes: text("notes"),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_record_references_record_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_record_references_version_fk",
			columns: [table.projectId, table.targetVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		check(
			"asset_record_references_role_check",
			sql`${table.role} IN ('identity', 'pose', 'style', 'palette', 'equipment', 'composition', 'theme', 'custom')`
		),
		check(
			"asset_record_references_feature_check",
			sql`cardinality(${table.transferredFeatures}) + cardinality(${table.forbiddenFeatures}) >= 1`
		),
		check(
			"asset_record_references_features_disjoint_check",
			sql`NOT (${table.transferredFeatures} && ${table.forbiddenFeatures})`
		),
		index("asset_record_references_asset_record_created_idx").on(
			table.assetRecordId,
			table.createdAt
		),
	]
);
