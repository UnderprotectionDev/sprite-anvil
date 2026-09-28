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
import { project } from "./project";

export const providerGenerationRecords = pgTable(
	"provider_generation_records",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		assetRecordId: text("asset_record_id").notNull(),
		assetVersionId: text("asset_version_id").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		provider: text("provider").notNull(),
		interface: text("interface"),
		model: text("model"),
		modelVersion: text("model_version"),
		requestedWidth: integer("requested_width"),
		requestedHeight: integer("requested_height"),
		actualWidth: integer("actual_width"),
		actualHeight: integer("actual_height"),
		referenceIds: jsonb("reference_ids").$type<string[]>().notNull(),
		palette: jsonb("palette").$type<string[]>().notNull(),
		seed: jsonb("seed").$type<string | number>(),
		parameterSnapshot: jsonb("parameter_snapshot")
			.$type<Record<string, unknown>>()
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "provider_generation_records_asset_version_fk",
			columns: [table.projectId, table.assetVersionId, table.assetRecordId],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.id,
				assetVersions.assetRecordId,
			],
		}).onDelete("restrict"),
		uniqueIndex("provider_generation_records_version_idx").on(
			table.projectId,
			table.assetVersionId
		),
		index("provider_generation_records_project_created_at_idx").on(
			table.projectId,
			table.createdAt
		),
		check(
			"provider_generation_records_requested_dimensions_check",
			sql`(${table.requestedWidth} IS NULL AND ${table.requestedHeight} IS NULL) OR (${table.requestedWidth} IS NOT NULL AND ${table.requestedHeight} IS NOT NULL AND ${table.requestedWidth} > 0 AND ${table.requestedHeight} > 0)`
		),
		check(
			"provider_generation_records_actual_dimensions_check",
			sql`(${table.actualWidth} IS NULL AND ${table.actualHeight} IS NULL) OR (${table.actualWidth} IS NOT NULL AND ${table.actualHeight} IS NOT NULL AND ${table.actualWidth} > 0 AND ${table.actualHeight} > 0)`
		),
	]
);
