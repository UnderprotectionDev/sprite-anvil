import {
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
