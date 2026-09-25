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
		sha256: text("sha256"),
		byteSize: integer("byte_size").notNull(),
		contentDigest: text("content_digest"),
		integrityVerified: boolean("integrity_verified").default(false).notNull(),
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
		uniqueIndex("asset_versions_idempotency_key_idx").on(
			table.projectId,
			table.assetRecordId,
			table.idempotencyKey
		),
		index("asset_versions_record_created_at_idx").on(
			table.assetRecordId,
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
