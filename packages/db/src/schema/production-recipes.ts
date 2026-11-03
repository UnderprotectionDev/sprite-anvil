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

import { user } from "./auth";
import { project } from "./project";

export interface ProductionRecipeContentRecord {
	expectedOutputStructure: string;
	fields: {
		key: string;
		label: string;
		mode: "fixed" | "fill_in";
		value: string | null;
	}[];
	instructionSkeleton: string;
	referenceRoles: {
		customPurpose: string | null;
		forbiddenFeatures: string[];
		notes: string | null;
		role: string;
		transferredFeatures: string[];
	}[];
}

export const productionRecipes = pgTable(
	"production_recipes",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		// Where the recipe was derived from. These are plain provenance values with
		// no foreign key: a recipe must outlive its experiment and never gain the
		// experiment's review decision, rights evidence or pinned inputs.
		sourceAssetRecordId: text("source_asset_record_id"),
		sourceExperimentId: text("source_experiment_id"),
		sourceGenerationPackageId: text("source_generation_package_id"),
		sourceTrialId: text("source_trial_id"),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("production_recipes_project_id_idx").on(
			table.projectId,
			table.id
		),
		index("production_recipes_project_created_at_idx").on(
			table.projectId,
			table.createdAt
		),
		index("production_recipes_created_by_user_id_idx").on(
			table.createdByUserId
		),
	]
);

export const productionRecipeVersions = pgTable(
	"production_recipe_versions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		recipeId: text("recipe_id").notNull(),
		projectId: text("project_id").notNull(),
		versionNumber: integer("version_number").notNull(),
		note: text("note"),
		content: jsonb("content").$type<ProductionRecipeContentRecord>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "production_recipe_versions_recipe_fk",
			columns: [table.projectId, table.recipeId],
			foreignColumns: [productionRecipes.projectId, productionRecipes.id],
		}).onDelete("cascade"),
		// Version numbers are unique per recipe, so two concurrent edits from the
		// same base cannot both succeed.
		uniqueIndex("production_recipe_versions_recipe_number_idx").on(
			table.recipeId,
			table.versionNumber
		),
		index("production_recipe_versions_created_by_user_id_idx").on(
			table.createdByUserId
		),
		check(
			"production_recipe_versions_number_check",
			sql`${table.versionNumber} >= 1`
		),
	]
);
