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
import { assetRecords } from "./asset-records";
import { user } from "./auth";

type RightsRecordState =
	| "documented"
	| "assertion_only"
	| "unknown"
	| "restricted";

export interface StoredRightsRecordEvidenceFile {
	contentLength: number;
	fileName: string;
	objectKey: string;
	sha256: string;
	sourceContentType: string;
}

export const rightsRecords = pgTable(
	"rights_records",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		versionNumber: integer("version_number").notNull(),
		source: text("source"),
		rightsHolderOrProvider: text("rights_holder_or_provider"),
		assertedScope: text("asserted_scope"),
		evidence: text("evidence"),
		evidenceFile: jsonb(
			"evidence_file"
		).$type<StoredRightsRecordEvidenceFile | null>(),
		restrictions: text("restrictions"),
		uncertainty: text("uncertainty"),
		state: text("state").$type<RightsRecordState>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "rights_records_project_asset_record_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("restrict"),
		uniqueIndex("rights_records_asset_version_idx").on(
			table.projectId,
			table.assetRecordId,
			table.versionNumber
		),
		index("rights_records_project_asset_created_idx").on(
			table.projectId,
			table.assetRecordId,
			table.createdAt
		),
		check(
			"rights_records_version_number_check",
			sql`${table.versionNumber} > 0`
		),
		check(
			"rights_records_state_check",
			sql`${table.state} IN ('documented', 'assertion_only', 'unknown', 'restricted')`
		),
		check(
			"rights_records_state_fields_check",
			sql`(${table.state} <> 'documented' OR (${table.evidence} IS NOT NULL AND length(trim(${table.evidence})) > 0) OR ${table.evidenceFile} IS NOT NULL) AND (${table.state} <> 'restricted' OR (${table.restrictions} IS NOT NULL AND length(trim(${table.restrictions})) > 0))`
		),
	]
);
