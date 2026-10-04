import {
	foreignKey,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { assetFamilyCanonicalDesigns } from "./asset-families";
import { assetFamilies } from "./asset-records";
import { user } from "./auth";
import { specializedProfileContractRevisions } from "./specialized-profile-contracts";

export const directionalReviews = pgTable(
	"directional_reviews",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		canonicalDesignId: text("canonical_design_id")
			.notNull()
			.references(() => assetFamilyCanonicalDesigns.id, {
				onDelete: "restrict",
			}),
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
			name: "directional_reviews_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("restrict"),
		index("directional_reviews_family_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.createdAt
		),
	]
);
