import { sql } from "drizzle-orm";
import {
	check,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

/**
 * The selection a user made for one Project Archive, kept so a Background
 * Operation can run it later. The row id is derived from the client's
 * idempotency key and is the id of the archive the request produces. Rows are
 * inserted once, never updated.
 */
export const projectArchiveRequests = pgTable(
	"project_archive_requests",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		requestDigest: text("request_digest").notNull(),
		/** The user's own key; with the project and user it derives this row's id. */
		idempotencyKey: text("idempotency_key").notNull(),
		/** Managed Snapshot ids the user chose to include as working files. */
		workingFileIds: jsonb("working_file_ids").$type<string[]>().notNull(),
		requestedByUserId: text("requested_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("project_archive_requests_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);

/**
 * One immutable Project Archive. The row id is derived from the client's
 * idempotency key, so a repeated key finds the same row. The manifest is
 * derived from the section and file rows; its digest is recorded so a re-read
 * can prove nothing changed. Rows are inserted once, never updated.
 */
export const projectArchives = pgTable(
	"project_archives",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		schemaVersion: text("schema_version").notNull(),
		manifestDigest: text("manifest_digest").notNull(),
		requestDigest: text("request_digest").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("project_archives_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);

/**
 * One section of an archive's record groups. A group (for example
 * `foundation`) names a set of sections; a later record group adds rows here
 * without a schema change.
 */
export const projectArchiveSections = pgTable(
	"project_archive_sections",
	{
		archiveId: text("archive_id")
			.notNull()
			.references(() => projectArchives.id, { onDelete: "cascade" }),
		recordGroup: text("record_group").notNull(),
		name: text("name").notNull(),
		recordCount: integer("record_count").notNull(),
		digest: text("digest").notNull(),
		records: jsonb("records").$type<unknown[]>().notNull(),
	},
	(table) => [
		primaryKey({
			name: "project_archive_sections_pk",
			columns: [table.archiveId, table.recordGroup, table.name],
		}),
		check(
			"project_archive_sections_count_check",
			sql`${table.recordCount} >= 0`
		),
	]
);

/**
 * One file the archive accounts for: an included file keeps its source
 * object key for later restore; an excluded file keeps only identity, digest
 * and size, so its absence stays visible. Rows are inserted once.
 */
export const projectArchiveFiles = pgTable(
	"project_archive_files",
	{
		archiveId: text("archive_id")
			.notNull()
			.references(() => projectArchives.id, { onDelete: "cascade" }),
		kind: text("kind").notNull(),
		sourceId: text("source_id").notNull(),
		assetRecordId: text("asset_record_id"),
		assetVersionId: text("asset_version_id"),
		fileName: text("file_name"),
		contentType: text("content_type"),
		byteSize: integer("byte_size").notNull(),
		sha256: text("sha256").notNull(),
		presence: text("presence").$type<"included" | "excluded">().notNull(),
		exclusionReason: text("exclusion_reason"),
		/** Cloud storage location of an included file; never part of the portable manifest. */
		sourceObjectKey: text("source_object_key"),
	},
	(table) => [
		primaryKey({
			name: "project_archive_files_pk",
			columns: [table.archiveId, table.kind, table.sourceId],
		}),
		check("project_archive_files_size_check", sql`${table.byteSize} > 0`),
		check(
			"project_archive_files_sha256_check",
			sql`${table.sha256} ~ '^[a-f0-9]{64}$'`
		),
		check(
			"project_archive_files_presence_check",
			sql`(${table.presence} = 'included' AND ${table.sourceObjectKey} IS NOT NULL AND ${table.exclusionReason} IS NULL) OR (${table.presence} = 'excluded' AND ${table.sourceObjectKey} IS NULL AND ${table.exclusionReason} IS NOT NULL)`
		),
	]
);
