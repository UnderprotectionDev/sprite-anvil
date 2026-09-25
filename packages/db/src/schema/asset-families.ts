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

import { user } from "./auth";
import { visualWorlds } from "./context-scopes";
import { project } from "./project";

export const subjectIdentities = pgTable(
	"subject_identities",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("subject_identities_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("subject_identities_project_name_idx").on(
			table.projectId,
			sql`lower(${table.name})`
		),
		index("subject_identities_created_by_user_id_idx").on(
			table.createdByUserId
		),
	]
);

export const assetFamilies = pgTable(
	"asset_families",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		subjectIdentityId: text("subject_identity_id").notNull(),
		name: text("name").notNull(),
		visualWorldId: text("visual_world_id").notNull(),
		useContext: text("use_context").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_families_project_subject_identity_fk",
			columns: [table.projectId, table.subjectIdentityId],
			foreignColumns: [subjectIdentities.projectId, subjectIdentities.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "asset_families_project_visual_world_fk",
			columns: [table.projectId, table.visualWorldId],
			foreignColumns: [visualWorlds.projectId, visualWorlds.id],
		}).onDelete("cascade"),
		uniqueIndex("asset_families_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("asset_families_identity_name_idx").on(
			table.subjectIdentityId,
			sql`lower(${table.name})`
		),
		index("asset_families_project_visual_world_idx").on(
			table.projectId,
			table.visualWorldId
		),
		index("asset_families_created_by_user_id_idx").on(table.createdByUserId),
	]
);

export const assetRecords = pgTable(
	"asset_records",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		name: text("name").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_records_project_asset_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("cascade"),
		uniqueIndex("asset_records_project_family_id_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.id
		),
		uniqueIndex("asset_records_family_name_idx").on(
			table.assetFamilyId,
			sql`lower(${table.name})`
		),
		index("asset_records_created_by_user_id_idx").on(table.createdByUserId),
	]
);

export const assetVersions = pgTable(
	"asset_versions",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		versionNumber: integer("version_number").notNull(),
		objectKey: text("object_key").notNull().unique(),
		contentType: text("content_type")
			.$type<"image/png" | "image/webp">()
			.notNull(),
		contentLength: integer("content_length").notNull(),
		contentDigest: text("content_digest"),
		integrityVerified: boolean("integrity_verified").default(false).notNull(),
		idempotencyKey: text("idempotency_key")
			.default(sql`'legacy:' || gen_random_uuid()::text`)
			.notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_versions_project_family_record_fk",
			columns: [table.projectId, table.assetFamilyId, table.assetRecordId],
			foreignColumns: [
				assetRecords.projectId,
				assetRecords.assetFamilyId,
				assetRecords.id,
			],
		}).onDelete("cascade"),
		check(
			"asset_versions_version_number_positive",
			sql`${table.versionNumber} > 0`
		),
		check(
			"asset_versions_content_length_positive",
			sql`${table.contentLength} > 0`
		),
		check(
			"asset_versions_content_digest_check",
			sql`${table.contentDigest} IS NULL OR ${table.contentDigest} ~ '^[0-9a-f]{64}$'`
		),
		check(
			"asset_versions_integrity_digest_check",
			sql`${table.integrityVerified} = false OR ${table.contentDigest} IS NOT NULL`
		),
		uniqueIndex("asset_versions_project_family_record_id_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.assetRecordId,
			table.id
		),
		uniqueIndex("asset_versions_record_version_number_idx").on(
			table.assetRecordId,
			table.versionNumber
		),
		uniqueIndex("asset_versions_idempotency_key_idx").on(
			table.projectId,
			table.assetRecordId,
			table.idempotencyKey
		),
		index("asset_versions_project_record_idx").on(
			table.projectId,
			table.assetRecordId
		),
		index("asset_versions_created_by_user_id_idx").on(table.createdByUserId),
	]
);

export const assetVersionReviewEvents = pgTable(
	"asset_version_review_events",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		assetVersionId: text("asset_version_id").notNull(),
		type: text("type").$type<"candidate" | "approved" | "rejected">().notNull(),
		rationale: text("rationale"),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_version_review_events_version_fk",
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
		}).onDelete("cascade"),
		check(
			"asset_version_review_events_type_check",
			sql`${table.type} IN ('candidate', 'approved', 'rejected')`
		),
		index("asset_version_review_events_version_created_idx").on(
			table.assetVersionId,
			table.createdAt
		),
		index("asset_version_review_events_project_idx").on(
			table.projectId,
			table.assetFamilyId
		),
	]
);

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
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_family_canonical_designs_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("cascade"),
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
		}).onDelete("cascade"),
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
			.references(() => user.id, { onDelete: "cascade" }),
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
		}).onDelete("cascade"),
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
		}).onDelete("cascade"),
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
		}).onDelete("cascade"),
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
