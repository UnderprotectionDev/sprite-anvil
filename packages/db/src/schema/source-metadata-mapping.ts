import {
	foreignKey,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { assetRecords } from "./asset-records";
import { assetVersions } from "./asset-versions";
import { user } from "./auth";
import { importInboxEntries } from "./import-inbox";
import { project } from "./project";

export const sourceMetadataMappingProposals = pgTable(
	"source_metadata_mapping_proposals",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		sourceEntryId: text("source_entry_id").notNull(),
		proposal: jsonb("proposal").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "source_metadata_mapping_proposals_project_source_entry_fk",
			columns: [table.projectId, table.sourceEntryId],
			foreignColumns: [importInboxEntries.projectId, importInboxEntries.id],
		}).onDelete("restrict"),
		index("source_metadata_mapping_proposals_source_created_at_idx").on(
			table.projectId,
			table.sourceEntryId,
			table.createdAt
		),
	]
);

export const sourceMetadataMappingFinalizations = pgTable(
	"source_metadata_mapping_finalizations",
	{
		proposalId: text("proposal_id")
			.primaryKey()
			.references(() => sourceMetadataMappingProposals.id, {
				onDelete: "restrict",
			}),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		assetRecordId: text("asset_record_id").notNull(),
		assetVersionId: text("asset_version_id"),
		decisions: jsonb("decisions").notNull(),
		status: text("status").$type<"pending" | "completed">().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "source_metadata_mapping_finalizations_target_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "source_metadata_mapping_finalizations_version_fk",
			columns: [table.projectId, table.assetVersionId, table.assetRecordId],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.id,
				assetVersions.assetRecordId,
			],
		}).onDelete("restrict"),
	]
);
