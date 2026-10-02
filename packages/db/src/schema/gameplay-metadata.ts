import {
	foreignKey,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { assetVersions } from "./asset-versions";
import { user } from "./auth";
import { specializedProfileContractRevisions } from "./specialized-profile-contracts";

export const gameplayMetadataRecords = pgTable(
	"gameplay_metadata_records",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		assetVersionId: text("asset_version_id").notNull(),
		contractRevisionId: text("contract_revision_id")
			.notNull()
			.references(() => specializedProfileContractRevisions.id, {
				onDelete: "restrict",
			}),
		record: jsonb("record").$type<Record<string, unknown>>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "gameplay_metadata_records_exact_version_fk",
			columns: [table.projectId, table.assetVersionId, table.assetRecordId],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.id,
				assetVersions.assetRecordId,
			],
		}).onDelete("restrict"),
		index("gameplay_metadata_records_target_idx").on(
			table.projectId,
			table.assetRecordId,
			table.createdAt
		),
	]
);
