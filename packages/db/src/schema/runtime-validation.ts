import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { exportBundles } from "./export-bundles";
import { project } from "./project";

/**
 * One immutable Runtime Validation Record: draft evidence for one exact Export
 * Bundle, game build, engine version and optional adapter version. It has no
 * status column; the user's outcome and failure source arrive later as
 * append-only rows. The bundle digest is copied at write time, and the bundle
 * itself is never updated. Rows are inserted once, never updated.
 */
export const runtimeValidationRecords = pgTable(
	"runtime_validation_records",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		bundleId: text("bundle_id").notNull(),
		manifestDigest: text("manifest_digest").notNull(),
		gameBuild: text("game_build").notNull(),
		engineVersion: text("engine_version").notNull(),
		adapterVersion: text("adapter_version"),
		/** The earlier record this retest or fix supersedes; that record is never changed. */
		supersedesRecordId: text("supersedes_record_id"),
		/** Digest of the create request, so a repeated key with other content is a conflict. */
		requestDigest: text("request_digest").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("runtime_validation_records_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		foreignKey({
			name: "runtime_validation_records_bundle_fk",
			columns: [table.projectId, table.bundleId],
			foreignColumns: [exportBundles.projectId, exportBundles.id],
		}).onDelete("cascade"),
	]
);

/**
 * One evidence item of a record: a text note (observation or test result) or an
 * uploaded file kept in object storage by id and SHA-256 digest. Rows are only
 * ever inserted.
 */
export const runtimeValidationEvidence = pgTable(
	"runtime_validation_evidence",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		recordId: text("record_id").notNull(),
		kind: text("kind")
			.$type<"screenshot" | "recording" | "test_result" | "observation">()
			.notNull(),
		source: text("source").$type<"manual" | "adapter_draft">().notNull(),
		text: text("text"),
		fileName: text("file_name"),
		byteSize: integer("byte_size"),
		sha256: text("sha256"),
		objectKey: text("object_key"),
		requestDigest: text("request_digest").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "runtime_validation_evidence_record_fk",
			columns: [table.projectId, table.recordId],
			foreignColumns: [
				runtimeValidationRecords.projectId,
				runtimeValidationRecords.id,
			],
		}).onDelete("cascade"),
		check(
			"runtime_validation_evidence_kind_check",
			sql`${table.kind} in ('screenshot', 'recording', 'test_result', 'observation')`
		),
		check(
			"runtime_validation_evidence_source_check",
			sql`${table.source} in ('manual', 'adapter_draft')`
		),
		check(
			"runtime_validation_evidence_content_check",
			sql`(${table.text} is not null and ${table.fileName} is null and ${table.byteSize} is null and ${table.sha256} is null and ${table.objectKey} is null) or (${table.text} is null and ${table.fileName} is not null and ${table.byteSize} > 0 and ${table.sha256} is not null and ${table.objectKey} is not null)`
		),
	]
);

/**
 * One append-only user decision on a Runtime Validation Record: its outcome
 * (Pass, Fail or Inconclusive) or a failure-source classification. Only the
 * user writes these. A record has at most one outcome decision, which is final;
 * a Fail without a failure-source row is Source Unknown, and each
 * reclassification appends another row (the latest wins). Rows are inserted
 * once, never updated.
 */
export const runtimeValidationDecisions = pgTable(
	"runtime_validation_decisions",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		recordId: text("record_id").notNull(),
		kind: text("kind").$type<"outcome" | "failure_source">().notNull(),
		outcome: text("outcome").$type<"pass" | "fail" | "inconclusive">(),
		failureSource: text("failure_source").$type<
			| "asset_content"
			| "engine_adapter"
			| "game_configuration"
			| "multiple_sources"
		>(),
		requestDigest: text("request_digest").notNull(),
		decidedByUserId: text("decided_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "runtime_validation_decisions_record_fk",
			columns: [table.projectId, table.recordId],
			foreignColumns: [
				runtimeValidationRecords.projectId,
				runtimeValidationRecords.id,
			],
		}).onDelete("cascade"),
		uniqueIndex("runtime_validation_decisions_one_outcome_idx")
			.on(table.recordId)
			.where(sql`${table.kind} = 'outcome'`),
		check(
			"runtime_validation_decisions_content_check",
			sql`(${table.kind} = 'outcome' and ${table.outcome} in ('pass', 'fail', 'inconclusive') and ${table.failureSource} is null) or (${table.kind} = 'failure_source' and ${table.outcome} is null and ${table.failureSource} in ('asset_content', 'engine_adapter', 'game_configuration', 'multiple_sources'))`
		),
	]
);
