import { defineRelationsPart } from "drizzle-orm";
import {
	foreignKey,
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { assetRecords } from "./asset-records";
import { user } from "./auth";
import { project } from "./project";

export const collections = pgTable(
	"collections",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		name: text("name").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("collections_project_id_id_idx").on(table.projectId, table.id),
		index("collections_project_name_idx").on(table.projectId, table.name),
		index("collections_created_by_user_id_idx").on(table.createdByUserId),
	]
);

export const collectionAssetRecords = pgTable(
	"collection_asset_records",
	{
		projectId: text("project_id").notNull(),
		collectionId: text("collection_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({
			name: "collection_asset_records_pk",
			columns: [table.projectId, table.collectionId, table.assetRecordId],
		}),
		foreignKey({
			name: "collection_asset_records_project_collection_fk",
			columns: [table.projectId, table.collectionId],
			foreignColumns: [collections.projectId, collections.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "collection_asset_records_project_asset_record_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("cascade"),
		index("collection_asset_records_project_asset_record_idx").on(
			table.projectId,
			table.assetRecordId
		),
		index("collection_asset_records_created_by_user_id_idx").on(
			table.createdByUserId
		),
	]
);

export const collectionRelations = defineRelationsPart(
	{ collections, collectionAssetRecords, assetRecords, project, user },
	(r) => ({
		collections: {
			project: r.one.project({
				from: r.collections.projectId,
				to: r.project.id,
			}),
			creator: r.one.user({
				from: r.collections.createdByUserId,
				to: r.user.id,
			}),
			memberships: r.many.collectionAssetRecords({
				from: r.collections.id,
				to: r.collectionAssetRecords.collectionId,
			}),
		},
		collectionAssetRecords: {
			collection: r.one.collections({
				from: r.collectionAssetRecords.collectionId,
				to: r.collections.id,
			}),
			assetRecord: r.one.assetRecords({
				from: r.collectionAssetRecords.assetRecordId,
				to: r.assetRecords.id,
			}),
			creator: r.one.user({
				from: r.collectionAssetRecords.createdByUserId,
				to: r.user.id,
			}),
		},
	})
);
