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
import { assetVersions } from "./asset-versions";
import { user } from "./auth";
import { generationPackages } from "./generation-packages";

export const legacyAssetAttestations = pgTable(
	"legacy_asset_attestations",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		versionId: text("version_id").notNull(),
		knownSource: text("known_source"),
		userRelationship: text("user_relationship")
			.$type<
				| "created_by_user"
				| "received_from_team"
				| "licensed_third_party"
				| "unknown"
			>()
			.notNull(),
		supportingEvidence: text("supporting_evidence"),
		historyUnknown: boolean("history_unknown").notNull(),
		attestedByUserId: text("attested_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "legacy_asset_attestations_version_fk",
			columns: [table.projectId, table.versionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		check(
			"legacy_asset_attestations_relationship_check",
			sql`${table.userRelationship} IN ('created_by_user', 'received_from_team', 'licensed_third_party', 'unknown')`
		),
		check(
			"legacy_asset_attestations_unknown_history_check",
			sql`${table.historyUnknown} = true`
		),
		index("legacy_asset_attestations_version_created_idx").on(
			table.versionId,
			table.createdAt
		),
	]
);

export const manualImportEvidence = pgTable(
	"manual_import_evidence",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		versionId: text("version_id").notNull(),
		generationPackageId: text("generation_package_id").notNull(),
		sourceSurface: text("source_surface").notNull(),
		generationInstruction: text("generation_instruction").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "manual_import_evidence_version_fk",
			columns: [table.projectId, table.versionId, table.assetRecordId],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.id,
				assetVersions.assetRecordId,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "manual_import_evidence_generation_package_fk",
			columns: [
				table.projectId,
				table.assetRecordId,
				table.generationPackageId,
			],
			foreignColumns: [
				generationPackages.projectId,
				generationPackages.assetRecordId,
				generationPackages.id,
			],
		}).onDelete("restrict"),
		check(
			"manual_import_evidence_source_surface_check",
			sql`${table.sourceSurface} = btrim(${table.sourceSurface}) AND char_length(${table.sourceSurface}) BETWEEN 1 AND 255`
		),
		check(
			"manual_import_evidence_generation_instruction_check",
			sql`char_length(${table.generationInstruction}) BETWEEN 1 AND 100000 AND char_length(btrim(${table.generationInstruction})) > 0`
		),
		uniqueIndex("manual_import_evidence_project_version_idx").on(
			table.projectId,
			table.versionId
		),
		index("manual_import_evidence_project_record_created_idx").on(
			table.projectId,
			table.assetRecordId,
			table.createdAt
		),
	]
);
