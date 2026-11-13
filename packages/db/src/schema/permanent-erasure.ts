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
 * content or storage location is kept. `targetAssetRecordId` is not a foreign
 * key: the report outlives the erasure it describes. Rows are inserted once,
 * never updated.
 */
export const erasureImpactReports = pgTable(
	"erasure_impact_reports",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		targetAssetRecordId: text("target_asset_record_id").notNull(),
		contractVersion: text("contract_version").notNull(),
		reportDigest: text("report_digest").notNull(),
		requestDigest: text("request_digest").notNull(),
		scope: jsonb("scope").$type<Record<string, unknown>>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
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
export const erasureAuthorizations = pgTable(
	"erasure_authorizations",
	{
		authorizedByUserId: text("authorized_by_user_id")
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
		uniqueIndex("erasure_authorizations_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);

/**
 * The content-free Deletion Receipt of one completed Deletion Job. The id is
 * the authorization id, so one approval can never have a second receipt. The
 * receipt holds identities, digests, counts and times only; no file content,
 * name or storage location. Rows are inserted once, never updated.
 */
export const erasureReceipts = pgTable(
	"erasure_receipts",
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
		uniqueIndex("erasure_receipts_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);

/**
 * What stays of an erased Asset Version: its identity and the receipt that
 * erased it, never content. The Asset Version row stays, the Asset Record is
 * marked erased and its stored object is gone. The id is the Asset Version id.
 * Rows are inserted once, never updated.
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
