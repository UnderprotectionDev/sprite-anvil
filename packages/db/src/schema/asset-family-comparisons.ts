import {
	foreignKey,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { assetFamilies } from "./asset-records";
import { user } from "./auth";
import { project } from "./project";

export const assetFamilyComparisons = pgTable(
	"asset_family_comparisons",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		assetFamilyId: text("asset_family_id").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		record: jsonb("record").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at").notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_family_comparisons_project_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("restrict"),
		index("asset_family_comparisons_project_family_created_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.createdAt
		),
		index("asset_family_comparisons_created_by_user_id_idx").on(
			table.createdByUserId
		),
	]
);
