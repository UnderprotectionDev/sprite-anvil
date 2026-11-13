import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

/**
 * One Erasure Impact Report: the exact scope of erasing one Asset Record. The
 * row id is derived from the client's idempotency key, so a repeated key finds
 * the same row. `scope` holds the content-free scope the digest covers; no file
 * name, file content or storage location is kept. `targetAssetRecordId` is not
 * a foreign key: the report outlives the erasure it describes. Rows are
 * inserted once, never updated.
 */
export const erasureImpactReports = pgTable(
	"erasure_impact_reports",
	{
		contractVersion: text("contract_version").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		reportDigest: text("report_digest").notNull(),
		requestDigest: text("request_digest").notNull(),
		scope: jsonb("scope").$type<Record<string, unknown>>().notNull(),
		targetAssetRecordId: text("target_asset_record_id").notNull(),
	},
	(table) => [
		uniqueIndex("erasure_impact_reports_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);

/**
 * The user's approval of one exact Erasure Impact Report and the Deletion Job
 * it starts. The row id is derived from the client's idempotency key. The
 * report is not a foreign key: the approval and its receipt outlive the
 * scope they describe. Rows are inserted once, never updated.
 */
export const erasureApprovals = pgTable(
	"erasure_approvals",
	{
		approvedByUserId: text("approved_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		confirmed: jsonb("confirmed").$type<Record<string, number>>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		id: text("id").primaryKey(),
		idempotencyKey: text("idempotency_key").notNull(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		reportDigest: text("report_digest").notNull(),
		reportId: text("report_id").notNull(),
		requestDigest: text("request_digest").notNull(),
		selectedContainerIds: jsonb("selected_container_ids")
			.$type<string[]>()
			.notNull(),
	},
	(table) => [
		uniqueIndex("erasure_approvals_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);

/**
 * The mark that the removal of stored objects began for one approval: the
 * irreversible boundary. Once it exists the Deletion Job no longer passes a
 * cancel checkpoint, because cancelling can no longer undo what was removed.
 * The id is the approval id. Rows are inserted once, never updated.
 */
export const erasureRemovalStarts = pgTable(
	"erasure_removal_starts",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		startedAt: timestamp("started_at").notNull(),
	},
	(table) => [
		uniqueIndex("erasure_removal_starts_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);

/**
 * The content-free Deletion Receipt of one completed Deletion Job. The id is
 * the approval id, so one approval can never have a second receipt. The
 * receipt holds identities, digests, counts and times only; no file content,
 * name or storage location. Rows are inserted once, never updated.
 */
export const deletionReceipts = pgTable(
	"deletion_receipts",
	{
		backgroundOperationId: text("background_operation_id").notNull(),
		contractVersion: text("contract_version").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		receipt: jsonb("receipt").$type<Record<string, unknown>>().notNull(),
		receiptDigest: text("receipt_digest").notNull(),
	},
	(table) => [
		uniqueIndex("deletion_receipts_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);

/**
 * What stays of an erased Asset Version: its identity and the receipt that
 * erased it, never content. The Asset Version row stays with its file name
 * redacted, the Asset Record is marked erased and its stored object is gone.
 * The id is the Asset Version id. Rows are inserted once, never updated.
 */
export const erasureTombstones = pgTable(
	"erasure_tombstones",
	{
		assetRecordId: text("asset_record_id").notNull(),
		erasedAt: timestamp("erased_at").notNull(),
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		receiptId: text("receipt_id").notNull(),
	},
	(table) => [
		index("erasure_tombstones_project_asset_record_idx").on(
			table.projectId,
			table.assetRecordId
		),
	]
);
