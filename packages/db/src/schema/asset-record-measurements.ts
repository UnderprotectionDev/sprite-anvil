import {
	foreignKey,
	jsonb,
	pgTable,
	primaryKey,
	text,
} from "drizzle-orm/pg-core";
import { assetRecords } from "./asset-records";

export const assetRecordMeasurements = pgTable(
	"asset_record_measurements",
	{
		assetRecordId: text("asset_record_id").notNull(),
		measurements: jsonb("measurements")
			.$type<Record<string, unknown>>()
			.notNull(),
		projectId: text("project_id").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.projectId, table.assetRecordId],
			name: "asset_record_measurements_pkey",
		}),
		foreignKey({
			name: "asset_record_measurements_record_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("restrict"),
	]
);
