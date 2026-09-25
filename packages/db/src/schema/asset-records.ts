import { defineRelationsPart, sql } from "drizzle-orm";
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
import { themes, visualWorlds } from "./context-scopes";
import { project } from "./project";

type AssetRecordIdentityCriteria =
	| "independent_product_meaning"
	| "independent_lifecycle"
	| "delivery_identity";

type AssetRecordAvailability = "active" | "archived" | "erased";

export const subjectIdentities = pgTable(
	"subject_identities",
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
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		visualWorldId: text("visual_world_id").notNull(),
		canonicalVersionId: text("canonical_version_id"),
		subjectIdentityId: text("subject_identity_id"),
		name: text("name").notNull(),
		useContext: text("use_context").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("asset_families_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("asset_families_project_version_idx").on(
			table.projectId,
			table.id,
			table.canonicalVersionId
		),
		foreignKey({
			name: "asset_families_project_visual_world_fk",
			columns: [table.projectId, table.visualWorldId],
			foreignColumns: [visualWorlds.projectId, visualWorlds.id],
		}).onDelete("restrict"),
		uniqueIndex("asset_families_identity_name_idx").on(
			table.subjectIdentityId,
			sql`lower(${table.name})`
		),
		foreignKey({
			name: "asset_families_project_subject_identity_fk",
			columns: [table.projectId, table.subjectIdentityId],
			foreignColumns: [subjectIdentities.projectId, subjectIdentities.id],
		}).onDelete("restrict"),
	]
);

export const assetRecords = pgTable(
	"asset_records",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		assetFamilyId: text("asset_family_id"),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		name: text("name").notNull(),
		assetCategory: text("asset_category").$type<
			| "character_creature_animation"
			| "object_weapon_equipment_states"
			| "icon"
			| "visual_effect_projectile_shadow_mark"
			| "tileset_terrain_texture"
			| "background_parallax"
			| "ui"
			| "portrait_logo_marketing"
			| "other"
		>(),
		visualWorldId: text("visual_world_id"),
		themeId: text("theme_id"),
		tags: text("tags").array().notNull().default([]),
		identityCriteria: text("identity_criteria")
			.array()
			.$type<AssetRecordIdentityCriteria>(),
		supportLevel: text("support_level").$type<"general">().notNull(),
		availability: text("availability")
			.$type<AssetRecordAvailability>()
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"asset_records_identity_criteria_nonempty_check",
			sql`${table.identityCriteria} IS NULL OR cardinality(${table.identityCriteria}) >= 1`
		),
		check(
			"asset_records_availability_check",
			sql`${table.availability} IN ('active', 'archived', 'erased')`
		),
		check(
			"asset_records_category_check",
			sql`${table.assetCategory} IS NULL OR ${table.assetCategory} IN ('character_creature_animation', 'object_weapon_equipment_states', 'icon', 'visual_effect_projectile_shadow_mark', 'tileset_terrain_texture', 'background_parallax', 'ui', 'portrait_logo_marketing', 'other')`
		),
		check(
			"asset_records_theme_requires_visual_world_check",
			sql`${table.themeId} IS NULL OR ${table.visualWorldId} IS NOT NULL`
		),
		uniqueIndex("asset_records_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("asset_records_project_id_family_idx").on(
			table.projectId,
			table.id,
			table.assetFamilyId
		),
		uniqueIndex("asset_records_project_family_record_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.id
		),
		foreignKey({
			name: "asset_records_project_asset_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_records_project_visual_world_fk",
			columns: [table.projectId, table.visualWorldId],
			foreignColumns: [visualWorlds.projectId, visualWorlds.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "asset_records_project_visual_world_theme_fk",
			columns: [table.projectId, table.visualWorldId, table.themeId],
			foreignColumns: [themes.projectId, themes.visualWorldId, themes.id],
		}).onDelete("restrict"),
		index("asset_records_project_created_at_idx").on(
			table.projectId,
			table.createdAt
		),
		index("asset_records_project_category_idx").on(
			table.projectId,
			table.assetCategory
		),
		index("asset_records_project_availability_idx").on(
			table.projectId,
			table.availability
		),
		index("asset_records_created_by_user_id_idx").on(table.createdByUserId),
	]
);

export const assetRecordRelations = defineRelationsPart(
	{ user, project, assetRecords },
	(r) => ({
		assetRecords: {
			creator: r.one.user({
				from: r.assetRecords.createdByUserId,
				to: r.user.id,
			}),
			project: r.one.project({
				from: r.assetRecords.projectId,
				to: r.project.id,
			}),
		},
	})
);
