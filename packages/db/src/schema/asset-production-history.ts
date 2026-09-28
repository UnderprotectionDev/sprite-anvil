import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
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
		unknownHistoryDetails: text("unknown_history_details"),
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
		check(
			"legacy_asset_attestations_unknown_history_details_check",
			sql`${table.unknownHistoryDetails} IS NULL OR length(trim(${table.unknownHistoryDetails})) > 0`
		),
		index("legacy_asset_attestations_version_created_idx").on(
			table.versionId,
			table.createdAt
		),
	]
);

export const managedSnapshots = pgTable(
	"managed_snapshots",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		assetVersionId: text("asset_version_id").notNull(),
		fileName: text("file_name").notNull(),
		byteSize: integer("byte_size").notNull(),
		sha256: text("sha256").notNull(),
		objectKey: text("object_key").notNull(),
		idempotencyKey: text("idempotency_key").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "managed_snapshots_version_fk",
			columns: [table.projectId, table.assetVersionId, table.assetRecordId],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.id,
				assetVersions.assetRecordId,
			],
		}).onDelete("restrict"),
		check(
			"managed_snapshots_file_name_check",
			sql`${table.fileName} = btrim(${table.fileName}) AND char_length(${table.fileName}) BETWEEN 1 AND 255 AND position('/' in ${table.fileName}) = 0 AND position(chr(92) in ${table.fileName}) = 0`
		),
		check("managed_snapshots_byte_size_check", sql`${table.byteSize} > 0`),
		check(
			"managed_snapshots_sha256_check",
			sql`${table.sha256} ~ '^[a-f0-9]{64}$'`
		),
		uniqueIndex("managed_snapshots_idempotency_idx").on(
			table.projectId,
			table.assetVersionId,
			table.idempotencyKey
		),
		index("managed_snapshots_version_created_idx").on(
			table.projectId,
			table.assetVersionId,
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
		revision: integer("revision").default(1).notNull(),
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
		check("manual_import_evidence_revision_check", sql`${table.revision} > 0`),
		uniqueIndex("manual_import_evidence_revision_idx").on(
			table.projectId,
			table.versionId,
			table.revision
		),
		index("manual_import_evidence_project_record_created_idx").on(
			table.projectId,
			table.assetRecordId,
			table.createdAt
		),
	]
);
