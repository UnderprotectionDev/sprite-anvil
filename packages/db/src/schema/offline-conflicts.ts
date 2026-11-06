import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Offline Conflict Records. A record is written once and never updated: it
 * holds the pinned base, the cloud draft as it stood, and the local Working
 * Draft in `content`, which carries its own contract version. Unknown optional
 * fields stay inside `content` untouched. The cloud draft is never changed by
 * a record or by its resolution.
 */
export const offlineConflictRecords = pgTable(
	"offline_conflict_records",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// Plain provenance value with no foreign key: the record must outlive a
		// draft that is discarded or committed in the cloud.
		draftId: text("draft_id").notNull(),
		contractVersion: text("contract_version").notNull(),
		baseRevision: integer("base_revision").notNull(),
		cloudRevision: integer("cloud_revision").notNull(),
		localDigest: text("local_digest").notNull(),
		content: jsonb("content").$type<unknown>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("offline_conflict_records_detection_idx").on(
			table.projectId,
			table.ownerUserId,
			table.draftId,
			table.baseRevision,
			table.cloudRevision,
			table.localDigest
		),
		index("offline_conflict_records_owner_idx").on(
			table.projectId,
			table.ownerUserId,
			table.createdAt
		),
		check(
			"offline_conflict_records_revision_check",
			sql`${table.baseRevision} >= 0 AND ${table.cloudRevision} >= 0`
		),
	]
);

/** One resolution per record: the user's explicit choice, who made it and when. */
export const offlineConflictResolutions = pgTable(
	"offline_conflict_resolutions",
	{
		id: text("id").primaryKey(),
		conflictId: text("conflict_id")
			.notNull()
			.references(() => offlineConflictRecords.id, { onDelete: "cascade" }),
		projectId: text("project_id").notNull(),
		resolvedByUserId: text("resolved_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		choice: text("choice")
			.$type<"create-candidate" | "keep-cloud-retain-draft" | "abandon">()
			.notNull(),
		idempotencyKey: text("idempotency_key").notNull(),
		// The Candidate Version a create-candidate choice produced (plain
		// provenance, no foreign key); null for the other choices. A
		// create-candidate row is claimed with null first and completed once the
		// Candidate Version exists, so a losing racer never creates one.
		resultAssetVersionId: text("result_asset_version_id"),
		resolvedAt: timestamp("resolved_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("offline_conflict_resolutions_conflict_idx").on(
			table.conflictId
		),
		check(
			"offline_conflict_resolutions_choice_check",
			sql`${table.choice} IN ('create-candidate', 'keep-cloud-retain-draft', 'abandon')`
		),
		check(
			"offline_conflict_resolutions_result_check",
			sql`${table.choice} = 'create-candidate' OR ${table.resultAssetVersionId} IS NULL`
		),
	]
);
