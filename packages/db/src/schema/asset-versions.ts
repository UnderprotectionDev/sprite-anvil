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
import { assetRecords } from "./asset-records";
import { user } from "./auth";
import { project } from "./project";

export const assetVersions = pgTable(
	"asset_versions",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		assetRecordId: text("asset_record_id").notNull(),
		assetFamilyId: text("asset_family_id"),
		versionNumber: integer("version_number").notNull(),
		fileName: text("file_name"),
		contentType: text("content_type").notNull(),
		sourceKind: text("source_kind")
			.$type<
				| "manual_import"
				| "external_working_file_edit"
				| "legacy_asset"
				| "derived"
				| "unknown"
			>()
			.default("unknown")
			.notNull(),
		sourceImageWidth: integer("source_image_width"),
		sourceImageHeight: integer("source_image_height"),
		sha256: text("sha256"),
		byteSize: integer("byte_size").notNull(),
		contentDigest: text("content_digest"),
		integrityVerified: boolean("integrity_verified").default(false).notNull(),
		productionSource: text("production_source")
			.$type<"unknown" | "user_reported_provider" | "connected_provider">()
			.default("unknown")
			.notNull(),
		idempotencyKey: text("idempotency_key")
			.default(sql`'legacy:' || gen_random_uuid()::text`)
			.notNull(),
		objectKey: text("object_key").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_versions_project_record_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_versions_project_family_record_fk",
			columns: [table.projectId, table.assetFamilyId, table.assetRecordId],
			foreignColumns: [
				assetRecords.projectId,
				assetRecords.assetFamilyId,
				assetRecords.id,
			],
		}).onDelete("restrict"),
		uniqueIndex("asset_versions_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("asset_versions_project_record_id_idx").on(
			table.projectId,
			table.id,
			table.assetRecordId
		),
		uniqueIndex("asset_versions_project_family_record_id_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.assetRecordId,
			table.id
		),
		uniqueIndex("asset_versions_record_number_idx").on(
			table.projectId,
			table.assetRecordId,
			table.versionNumber
		),
		check(
			"asset_versions_content_type_check",
			sql`${table.contentType} IN ('image/png', 'image/webp')`
		),
		check(
			"asset_versions_source_kind_check",
			sql`${table.sourceKind} IN ('manual_import', 'external_working_file_edit', 'legacy_asset', 'derived', 'unknown')`
		),
		check(
			"asset_versions_source_image_dimensions_check",
			sql`(${table.sourceImageWidth} IS NULL AND ${table.sourceImageHeight} IS NULL) OR (${table.sourceImageWidth} IS NOT NULL AND ${table.sourceImageHeight} IS NOT NULL AND ${table.sourceImageWidth} > 0 AND ${table.sourceImageHeight} > 0)`
		),
		check(
			"asset_versions_sha256_check",
			sql`${table.sha256} ~ '^[a-f0-9]{64}$'`
		),
		check(
			"asset_versions_content_digest_check",
			sql`${table.contentDigest} IS NULL OR ${table.contentDigest} ~ '^[a-f0-9]{64}$'`
		),
		check(
			"asset_versions_integrity_digest_check",
			sql`${table.integrityVerified} = false OR ${table.contentDigest} IS NOT NULL`
		),
		check("asset_versions_byte_size_check", sql`${table.byteSize} > 0`),
		check(
			"asset_versions_production_source_check",
			sql`${table.productionSource} IN ('unknown', 'user_reported_provider', 'connected_provider')`
		),
		uniqueIndex("asset_versions_idempotency_key_idx").on(
			table.projectId,
			table.assetRecordId,
			table.idempotencyKey
		),
		index("asset_versions_record_created_at_idx").on(
			table.assetRecordId,
			table.createdAt
		),
		index("asset_versions_project_source_image_dimensions_idx").on(
			table.projectId,
			table.sourceImageWidth,
			table.sourceImageHeight,
			table.assetRecordId
		),
	]
);

export const unitVersions = pgTable(
	"unit_versions",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		assetRecordId: text("asset_record_id").notNull(),
		assetVersionId: text("asset_version_id").notNull(),
		sourceAssetVersionId: text("source_asset_version_id").notNull(),
		unitType: text("unit_type")
			.$type<"frame" | "direction" | "tile" | "state">()
			.notNull(),
		unitKey: text("unit_key").notNull(),
		versionNumber: integer("version_number").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "unit_versions_candidate_asset_version_fk",
			columns: [table.projectId, table.assetVersionId, table.assetRecordId],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.id,
				assetVersions.assetRecordId,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "unit_versions_source_asset_version_fk",
			columns: [
				table.projectId,
				table.sourceAssetVersionId,
				table.assetRecordId,
			],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.id,
				assetVersions.assetRecordId,
			],
		}).onDelete("restrict"),
		check(
			"unit_versions_type_check",
			sql`${table.unitType} IN ('frame', 'direction', 'tile', 'state')`
		),
		check(
			"unit_versions_key_check",
			sql`${table.unitKey} = btrim(${table.unitKey}) AND char_length(${table.unitKey}) BETWEEN 1 AND 120`
		),
		check(
			"unit_versions_version_number_check",
			sql`${table.versionNumber} > 0`
		),
		check(
			"unit_versions_source_distinct_check",
			sql`${table.assetVersionId} <> ${table.sourceAssetVersionId}`
		),
		uniqueIndex("unit_versions_project_asset_version_idx").on(
			table.projectId,
			table.assetVersionId
		),
		uniqueIndex("unit_versions_project_id_record_type_key_idx").on(
			table.projectId,
			table.id,
			table.assetRecordId,
			table.unitType,
			table.unitKey
		),
		uniqueIndex("unit_versions_identity_version_idx").on(
			table.projectId,
			table.assetRecordId,
			table.unitType,
			table.unitKey,
			table.versionNumber
		),
		index("unit_versions_identity_created_at_idx").on(
			table.projectId,
			table.assetRecordId,
			table.unitType,
			table.unitKey,
			table.createdAt
		),
	]
);

export const compositeVersions = pgTable(
	"composite_versions",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		assetRecordId: text("asset_record_id").notNull(),
		versionNumber: integer("version_number").notNull(),
		idempotencyKey: text("idempotency_key").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "composite_versions_project_record_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("restrict"),
		uniqueIndex("composite_versions_project_id_record_id_idx").on(
			table.projectId,
			table.id,
			table.assetRecordId
		),
		uniqueIndex("composite_versions_record_number_idx").on(
			table.projectId,
			table.assetRecordId,
			table.versionNumber
		),
		uniqueIndex("composite_versions_idempotency_key_idx").on(
			table.projectId,
			table.assetRecordId,
			table.idempotencyKey
		),
		check(
			"composite_versions_version_number_check",
			sql`${table.versionNumber} > 0`
		),
		check(
			"composite_versions_idempotency_key_check",
			sql`${table.idempotencyKey} = btrim(${table.idempotencyKey}) AND char_length(${table.idempotencyKey}) BETWEEN 1 AND 128`
		),
		index("composite_versions_record_created_at_idx").on(
			table.projectId,
			table.assetRecordId,
			table.createdAt
		),
	]
);

export const compositionMemberships = pgTable(
	"composition_memberships",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		compositeVersionId: text("composite_version_id").notNull(),
		unitVersionId: text("unit_version_id").notNull(),
		unitType: text("unit_type")
			.$type<"frame" | "direction" | "tile" | "state">()
			.notNull(),
		unitKey: text("unit_key").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "composition_memberships_project_composite_fk",
			columns: [table.projectId, table.compositeVersionId, table.assetRecordId],
			foreignColumns: [
				compositeVersions.projectId,
				compositeVersions.id,
				compositeVersions.assetRecordId,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "composition_memberships_project_unit_fk",
			columns: [
				table.projectId,
				table.unitVersionId,
				table.assetRecordId,
				table.unitType,
				table.unitKey,
			],
			foreignColumns: [
				unitVersions.projectId,
				unitVersions.id,
				unitVersions.assetRecordId,
				unitVersions.unitType,
				unitVersions.unitKey,
			],
		}).onDelete("restrict"),
		check(
			"composition_memberships_type_check",
			sql`${table.unitType} IN ('frame', 'direction', 'tile', 'state')`
		),
		check(
			"composition_memberships_key_check",
			sql`${table.unitKey} = btrim(${table.unitKey}) AND char_length(${table.unitKey}) BETWEEN 1 AND 120`
		),
		uniqueIndex("composition_memberships_slot_idx").on(
			table.projectId,
			table.compositeVersionId,
			table.unitType,
			table.unitKey
		),
		uniqueIndex("composition_memberships_unit_idx").on(
			table.projectId,
			table.compositeVersionId,
			table.unitVersionId
		),
		index("composition_memberships_unit_version_idx").on(
			table.projectId,
			table.unitVersionId
		),
	]
);

export const compositeVersionReviewEvents = pgTable(
	"composite_version_review_events",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		compositeVersionId: text("composite_version_id").notNull(),
		decision: text("decision")
			.$type<"candidate" | "approved" | "rejected">()
			.notNull(),
		rationale: text("rationale"),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "composite_version_reviews_project_composite_fk",
			columns: [table.projectId, table.compositeVersionId, table.assetRecordId],
			foreignColumns: [
				compositeVersions.projectId,
				compositeVersions.id,
				compositeVersions.assetRecordId,
			],
		}).onDelete("restrict"),
		check(
			"composite_version_reviews_decision_check",
			sql`${table.decision} IN ('candidate', 'approved', 'rejected')`
		),
		index("composite_version_reviews_record_created_idx").on(
			table.assetRecordId,
			table.createdAt
		),
		index("composite_version_reviews_composite_created_idx").on(
			table.projectId,
			table.compositeVersionId,
			table.createdAt
		),
	]
);

export const assetVersionReviewEvents = pgTable(
	"asset_version_review_events",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		versionId: text("version_id").notNull(),
		decision: text("decision")
			.$type<"candidate" | "approved" | "rejected">()
			.notNull(),
		rationale: text("rationale"),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_version_reviews_project_version_fk",
			columns: [table.projectId, table.versionId, table.assetRecordId],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.id,
				assetVersions.assetRecordId,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_version_reviews_project_record_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("restrict"),
		check(
			"asset_version_reviews_decision_check",
			sql`${table.decision} IN ('candidate', 'approved', 'rejected')`
		),
		index("asset_version_reviews_record_created_idx").on(
			table.assetRecordId,
			table.createdAt
		),
		index("asset_version_reviews_version_created_idx").on(
			table.versionId,
			table.createdAt
		),
	]
);

export const assetVersionQualityEvidence = pgTable(
	"asset_version_quality_evidence",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		versionId: text("version_id").notNull(),
		gate: text("gate").$type<"format_signature">().notNull(),
		result: text("result").$type<"matched">().notNull(),
		sha256: text("sha256").notNull(),
		byteSize: integer("byte_size").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_version_quality_evidence_version_fk",
			columns: [table.projectId, table.versionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		check(
			"asset_version_quality_evidence_gate_check",
			sql`${table.gate} = 'format_signature'`
		),
		check(
			"asset_version_quality_evidence_result_check",
			sql`${table.result} = 'matched'`
		),
		check(
			"asset_version_quality_evidence_sha256_check",
			sql`${table.sha256} ~ '^[a-f0-9]{64}$'`
		),
		check(
			"asset_version_quality_evidence_byte_size_check",
			sql`${table.byteSize} > 0`
		),
		index("asset_version_quality_evidence_version_created_idx").on(
			table.versionId,
			table.createdAt
		),
	]
);
