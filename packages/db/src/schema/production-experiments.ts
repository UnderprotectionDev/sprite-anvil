import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { assetRecords } from "./asset-records";
import { assetVersions } from "./asset-versions";
import { user } from "./auth";
import { generationPackages } from "./generation-packages";
import { project } from "./project";

export const productionExperiments = pgTable(
	"production_experiments",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		assetRecordId: text("asset_record_id").notNull(),
		title: text("title").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		outcome: text("outcome").$type<
			"selection_made" | "inconclusive" | "abandoned"
		>(),
		// Validated against the experiment's own trials by the store; a composite
		// foreign key would make the two tables reference each other.
		selectedTrialId: text("selected_trial_id"),
		outcomeNote: text("outcome_note"),
		concludedByUserId: text("concluded_by_user_id").references(() => user.id, {
			onDelete: "restrict",
		}),
		concludedAt: timestamp("concluded_at"),
	},
	(table) => [
		foreignKey({
			name: "production_experiments_project_asset_record_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("restrict"),
		uniqueIndex("production_experiments_project_record_id_idx").on(
			table.projectId,
			table.assetRecordId,
			table.id
		),
		index("production_experiments_project_record_created_at_idx").on(
			table.projectId,
			table.assetRecordId,
			table.createdAt
		),
		index("production_experiments_created_by_user_id_idx").on(
			table.createdByUserId
		),
		check(
			"production_experiments_conclusion_check",
			sql`(${table.outcome} IS NULL AND ${table.selectedTrialId} IS NULL AND ${table.concludedAt} IS NULL AND ${table.concludedByUserId} IS NULL) OR (${table.outcome} IN ('selection_made', 'inconclusive', 'abandoned') AND ${table.concludedAt} IS NOT NULL AND ${table.concludedByUserId} IS NOT NULL AND ((${table.outcome} = 'selection_made') = (${table.selectedTrialId} IS NOT NULL)))`
		),
	]
);

export const productionExperimentTrials = pgTable(
	"production_experiment_trials",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		experimentId: text("experiment_id").notNull(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		generationPackageId: text("generation_package_id").notNull(),
		assetVersionId: text("asset_version_id").notNull(),
		label: text("label").notNull(),
		position: integer("position").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "production_experiment_trials_experiment_fk",
			columns: [table.projectId, table.assetRecordId, table.experimentId],
			foreignColumns: [
				productionExperiments.projectId,
				productionExperiments.assetRecordId,
				productionExperiments.id,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "production_experiment_trials_generation_package_fk",
			columns: [
				table.projectId,
				table.assetRecordId,
				table.generationPackageId,
			],
			foreignColumns: [
				generationPackages.projectId,
				generationPackages.assetRecordId,
				generationPackages.id,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "production_experiment_trials_asset_version_fk",
			columns: [table.projectId, table.assetVersionId, table.assetRecordId],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.id,
				assetVersions.assetRecordId,
			],
		}).onDelete("restrict"),
		uniqueIndex("production_experiment_trials_experiment_package_idx").on(
			table.experimentId,
			table.generationPackageId
		),
		uniqueIndex("production_experiment_trials_experiment_version_idx").on(
			table.experimentId,
			table.assetVersionId
		),
		uniqueIndex("production_experiment_trials_experiment_position_idx").on(
			table.experimentId,
			table.position
		),
		uniqueIndex("production_experiment_trials_experiment_id_id_idx").on(
			table.experimentId,
			table.id
		),
		check(
			"production_experiment_trials_position_check",
			sql`${table.position} >= 0`
		),
	]
);
