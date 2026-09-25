import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { assetFamilies, assetRecords } from "./asset-records";
import { assetVersions } from "./asset-versions";
import { user } from "./auth";

export const assetFamilyCanonicalDesigns = pgTable(
	"asset_family_canonical_designs",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		assetVersionId: text("asset_version_id").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_family_canonical_designs_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_family_canonical_designs_record_fk",
			columns: [table.projectId, table.assetRecordId, table.assetFamilyId],
			foreignColumns: [
				assetRecords.projectId,
				assetRecords.id,
				assetRecords.assetFamilyId,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_family_canonical_designs_version_fk",
			columns: [
				table.projectId,
				table.assetFamilyId,
				table.assetRecordId,
				table.assetVersionId,
			],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.assetFamilyId,
				assetVersions.assetRecordId,
				assetVersions.id,
			],
		}).onDelete("restrict"),
		index("asset_family_canonical_designs_current_idx").on(
			table.assetFamilyId,
			table.createdAt
		),
	]
);

export const assetFamilyRelationships = pgTable(
	"asset_family_relationships",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		sourceAssetRecordId: text("source_asset_record_id").notNull(),
		sourceAssetVersionId: text("source_asset_version_id"),
		legacyUnversioned: boolean("legacy_unversioned").default(false).notNull(),
		targetAssetRecordId: text("target_asset_record_id").notNull(),
		type: text("type")
			.$type<"direction" | "animation" | "state" | "derivative">()
			.notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_family_relationships_source_same_family_fk",
			columns: [
				table.projectId,
				table.assetFamilyId,
				table.sourceAssetRecordId,
			],
			foreignColumns: [
				assetRecords.projectId,
				assetRecords.assetFamilyId,
				assetRecords.id,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_family_relationships_source_version_fk",
			columns: [
				table.projectId,
				table.assetFamilyId,
				table.sourceAssetRecordId,
				table.sourceAssetVersionId,
			],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.assetFamilyId,
				assetVersions.assetRecordId,
				assetVersions.id,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_family_relationships_target_same_family_fk",
			columns: [
				table.projectId,
				table.assetFamilyId,
				table.targetAssetRecordId,
			],
			foreignColumns: [
				assetRecords.projectId,
				assetRecords.assetFamilyId,
				assetRecords.id,
			],
		}).onDelete("restrict"),
		check(
			"asset_family_relationships_distinct_records_check",
			sql`${table.sourceAssetRecordId} <> ${table.targetAssetRecordId}`
		),
		check(
			"asset_family_relationships_derivative_version_check",
			sql`(${table.type} = 'derivative' AND ${table.sourceAssetVersionId} IS NOT NULL AND ${table.legacyUnversioned} = false) OR (${table.type} = 'derivative' AND ${table.sourceAssetVersionId} IS NULL AND ${table.legacyUnversioned} = true) OR (${table.type} <> 'derivative' AND ${table.sourceAssetVersionId} IS NULL AND ${table.legacyUnversioned} = false)`
		),
		uniqueIndex("asset_family_relationships_unique_link_idx").on(
			table.assetFamilyId,
			table.sourceAssetRecordId,
			table.targetAssetRecordId,
			table.type
		),
		index("asset_family_relationships_project_family_idx").on(
			table.projectId,
			table.assetFamilyId
		),
		index("asset_family_relationships_created_by_user_id_idx").on(
			table.createdByUserId
		),
	]
);
