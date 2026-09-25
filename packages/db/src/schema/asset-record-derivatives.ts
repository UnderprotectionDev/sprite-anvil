import { sql } from "drizzle-orm";
import {
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

export const assetRecordDerivatives = pgTable(
	"asset_record_derivatives",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		canonicalVersionId: text("canonical_version_id").notNull(),
		sourceAssetRecordId: text("source_asset_record_id").notNull(),
		derivativeAssetRecordId: text("derivative_asset_record_id").notNull(),
		dependencyFacets: text("dependency_facets").array().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_record_derivatives_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_record_derivatives_family_version_fk",
			columns: [table.projectId, table.assetFamilyId, table.canonicalVersionId],
			foreignColumns: [
				assetFamilies.projectId,
				assetFamilies.id,
				assetFamilies.canonicalVersionId,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_record_derivatives_source_fk",
			columns: [
				table.projectId,
				table.sourceAssetRecordId,
				table.assetFamilyId,
			],
			foreignColumns: [
				assetRecords.projectId,
				assetRecords.id,
				assetRecords.assetFamilyId,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_record_derivatives_target_fk",
			columns: [
				table.projectId,
				table.derivativeAssetRecordId,
				table.assetFamilyId,
			],
			foreignColumns: [
				assetRecords.projectId,
				assetRecords.id,
				assetRecords.assetFamilyId,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_record_derivatives_version_fk",
			columns: [table.projectId, table.canonicalVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		check(
			"asset_record_derivatives_distinct_records_check",
			sql`${table.sourceAssetRecordId} <> ${table.derivativeAssetRecordId}`
		),
		check(
			"asset_record_derivatives_facets_nonempty_check",
			sql`cardinality(${table.dependencyFacets}) >= 1`
		),
		index("asset_record_derivatives_source_idx").on(
			table.projectId,
			table.sourceAssetRecordId
		),
		index("asset_record_derivatives_target_idx").on(
			table.projectId,
			table.derivativeAssetRecordId
		),
		uniqueIndex("asset_record_derivatives_source_target_idx").on(
			table.projectId,
			table.sourceAssetRecordId,
			table.derivativeAssetRecordId
		),
	]
);
