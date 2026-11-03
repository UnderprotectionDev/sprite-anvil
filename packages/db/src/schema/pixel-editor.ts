import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { assetVersions } from "./asset-versions";
import { user } from "./auth";

/**
 * Last-Mile Pixel Editor Working Drafts. A draft keeps the ordered operation
 * list (applied prefix plus redo tail); the server re-renders it from the
 * immutable source Asset Version. Committing links exactly one Candidate
 * Version and never mutates the source.
 */
export const pixelEditorDrafts = pgTable(
	"pixel_editor_drafts",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		sourceAssetVersionId: text("source_asset_version_id").notNull(),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		status: text("status")
			.$type<"open" | "committed" | "discarded">()
			.default("open")
			.notNull(),
		operations: jsonb("operations").$type<unknown[]>().notNull(),
		appliedOperationCount: integer("applied_operation_count")
			.default(0)
			.notNull(),
		revision: integer("revision").default(0).notNull(),
		committedAssetVersionId: text("committed_asset_version_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "pixel_editor_drafts_source_version_fk",
			columns: [table.projectId, table.sourceAssetVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "pixel_editor_drafts_committed_version_fk",
			columns: [table.projectId, table.committedAssetVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		uniqueIndex("pixel_editor_drafts_open_source_idx")
			.on(table.projectId, table.ownerUserId, table.sourceAssetVersionId)
			.where(sql`${table.status} = 'open'`),
		uniqueIndex("pixel_editor_drafts_committed_version_idx")
			.on(table.projectId, table.committedAssetVersionId)
			.where(sql`${table.committedAssetVersionId} IS NOT NULL`),
		index("pixel_editor_drafts_owner_idx").on(
			table.projectId,
			table.ownerUserId,
			table.updatedAt
		),
		check(
			"pixel_editor_drafts_status_check",
			sql`${table.status} IN ('open', 'committed', 'discarded')`
		),
		check(
			"pixel_editor_drafts_history_check",
			sql`${table.revision} >= 0 AND ${table.appliedOperationCount} >= 0 AND ${table.appliedOperationCount} <= jsonb_array_length(${table.operations})`
		),
		check(
			"pixel_editor_drafts_commit_check",
			sql`(${table.status} = 'committed') = (${table.committedAssetVersionId} IS NOT NULL)`
		),
	]
);
