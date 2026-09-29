import {
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { project } from "./project";

type SpecializedProfileId =
	| "character_creature_animation"
	| "object_weapon_equipment_states"
	| "icon"
	| "visual_effect_projectile_shadow_mark"
	| "tileset_terrain_texture"
	| "background_parallax"
	| "ui"
	| "portrait_logo_marketing";

export const specializedProfileContractRevisions = pgTable(
	"specialized_profile_contract_revisions",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		profileId: text("profile_id").$type<SpecializedProfileId>().notNull(),
		revisionNumber: integer("revision_number").notNull(),
		templateRevisionNumber: integer("template_revision_number").notNull(),
		contract: jsonb("contract").$type<Record<string, unknown>>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "specialized_profile_contract_revisions_project_fk",
			columns: [table.projectId],
			foreignColumns: [project.id],
		}).onDelete("restrict"),
		uniqueIndex(
			"specialized_profile_contract_revisions_project_profile_id_idx"
		).on(table.projectId, table.profileId, table.id),
		uniqueIndex("specialized_profile_contract_revisions_number_idx").on(
			table.projectId,
			table.profileId,
			table.revisionNumber
		),
		uniqueIndex("specialized_profile_contract_revisions_template_idx").on(
			table.projectId,
			table.profileId,
			table.templateRevisionNumber
		),
		index("specialized_profile_contract_revisions_created_idx").on(
			table.projectId,
			table.profileId,
			table.createdAt
		),
	]
);

export const specializedProfileContractHeads = pgTable(
	"specialized_profile_contract_heads",
	{
		projectId: text("project_id").notNull(),
		profileId: text("profile_id").$type<SpecializedProfileId>().notNull(),
		activeRevisionId: text("active_revision_id"),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "specialized_profile_contract_heads_project_fk",
			columns: [table.projectId],
			foreignColumns: [project.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "specialized_profile_contract_heads_revision_fk",
			columns: [table.projectId, table.profileId, table.activeRevisionId],
			foreignColumns: [
				specializedProfileContractRevisions.projectId,
				specializedProfileContractRevisions.profileId,
				specializedProfileContractRevisions.id,
			],
		}).onDelete("restrict"),
		uniqueIndex("specialized_profile_contract_heads_project_profile_idx").on(
			table.projectId,
			table.profileId
		),
	]
);

export const specializedProfileContractActivations = pgTable(
	"specialized_profile_contract_activations",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		profileId: text("profile_id").$type<SpecializedProfileId>().notNull(),
		revisionId: text("revision_id").notNull(),
		activatedByUserId: text("activated_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		activatedAt: timestamp("activated_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "specialized_profile_contract_activations_revision_fk",
			columns: [table.projectId, table.profileId, table.revisionId],
			foreignColumns: [
				specializedProfileContractRevisions.projectId,
				specializedProfileContractRevisions.profileId,
				specializedProfileContractRevisions.id,
			],
		}).onDelete("restrict"),
		index("specialized_profile_contract_activations_history_idx").on(
			table.projectId,
			table.profileId,
			table.activatedAt
		),
	]
);
