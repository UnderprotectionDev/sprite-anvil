import { defineRelationsPart } from "drizzle-orm";
import {
	foreignKey,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { assetRecords } from "./asset-records";
import { user } from "./auth";
import { project } from "./project";

export const generationPackages = pgTable(
	"generation_packages",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		assetRecordId: text("asset_record_id").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "generation_packages_project_asset_record_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("restrict"),
		uniqueIndex("generation_packages_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("generation_packages_project_record_id_idx").on(
			table.projectId,
			table.assetRecordId,
			table.id
		),
		index("generation_packages_project_record_created_at_idx").on(
			table.projectId,
			table.assetRecordId,
			table.createdAt
		),
		index("generation_packages_created_by_user_id_idx").on(
			table.createdByUserId
		),
	]
);

export const generationPackageRelations = defineRelationsPart(
	{ generationPackages, assetRecords, project, user },
	(r) => ({
		generationPackages: {
			assetRecord: r.one.assetRecords({
				from: r.generationPackages.assetRecordId,
				to: r.assetRecords.id,
			}),
			creator: r.one.user({
				from: r.generationPackages.createdByUserId,
				to: r.user.id,
			}),
			project: r.one.project({
				from: r.generationPackages.projectId,
				to: r.project.id,
			}),
		},
	})
);
