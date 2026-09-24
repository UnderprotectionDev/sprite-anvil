import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { visualWorlds } from "./context-scopes";
import { project } from "./project";

export const subjectIdentities = pgTable(
	"subject_identities",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("subject_identities_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("subject_identities_project_name_idx").on(
			table.projectId,
			sql`lower(${table.name})`
		),
		index("subject_identities_created_by_user_id_idx").on(
			table.createdByUserId
		),
	]
);

export const assetFamilies = pgTable(
	"asset_families",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		subjectIdentityId: text("subject_identity_id").notNull(),
		name: text("name").notNull(),
		visualWorldId: text("visual_world_id").notNull(),
		useContext: text("use_context").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_families_project_subject_identity_fk",
			columns: [table.projectId, table.subjectIdentityId],
			foreignColumns: [subjectIdentities.projectId, subjectIdentities.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "asset_families_project_visual_world_fk",
			columns: [table.projectId, table.visualWorldId],
			foreignColumns: [visualWorlds.projectId, visualWorlds.id],
		}).onDelete("cascade"),
		uniqueIndex("asset_families_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("asset_families_identity_name_idx").on(
			table.subjectIdentityId,
			sql`lower(${table.name})`
		),
		index("asset_families_project_visual_world_idx").on(
			table.projectId,
			table.visualWorldId
		),
		index("asset_families_created_by_user_id_idx").on(table.createdByUserId),
	]
);

export const assetRecords = pgTable(
	"asset_records",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		name: text("name").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_records_project_asset_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("cascade"),
		uniqueIndex("asset_records_project_family_id_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.id
		),
		uniqueIndex("asset_records_family_name_idx").on(
			table.assetFamilyId,
			sql`lower(${table.name})`
		),
		index("asset_records_created_by_user_id_idx").on(table.createdByUserId),
	]
);

export const assetFamilyRelationships = pgTable(
	"asset_family_relationships",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		sourceAssetRecordId: text("source_asset_record_id").notNull(),
		targetAssetRecordId: text("target_asset_record_id").notNull(),
		type: text("type")
			.$type<"direction" | "animation" | "state" | "derivative">()
			.notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "asset_family_relationships_source_same_family_fk",
			columns: [
				table.projectId,
				table.assetFamilyId,
				table.sourceAssetRecordId,
			],
			foreignColumns: [
				assetRecords.projectId,
				assetRecords.assetFamilyId,
				assetRecords.id,
			],
		}).onDelete("cascade"),
		foreignKey({
			name: "asset_family_relationships_target_same_family_fk",
			columns: [
				table.projectId,
				table.assetFamilyId,
				table.targetAssetRecordId,
			],
			foreignColumns: [
				assetRecords.projectId,
				assetRecords.assetFamilyId,
				assetRecords.id,
			],
		}).onDelete("cascade"),
		check(
			"asset_family_relationships_distinct_records_check",
			sql`${table.sourceAssetRecordId} <> ${table.targetAssetRecordId}`
		),
		uniqueIndex("asset_family_relationships_unique_link_idx").on(
			table.assetFamilyId,
			table.sourceAssetRecordId,
			table.targetAssetRecordId,
			table.type
		),
		index("asset_family_relationships_project_family_idx").on(
			table.projectId,
			table.assetFamilyId
		),
		index("asset_family_relationships_created_by_user_id_idx").on(
			table.createdByUserId
		),
	]
);
