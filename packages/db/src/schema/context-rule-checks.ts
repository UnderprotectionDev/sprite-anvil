import {
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { assetVersions } from "./asset-versions";
import { user } from "./auth";
import { contextRevisions } from "./project-context";

/** A cache of exact pixel facts; a new measurement version adds new rows. */
export const contextRuleMeasurements = pgTable(
	"context_rule_measurements",
	{
		projectId: text("project_id").notNull(),
		assetVersionId: text("asset_version_id").notNull(),
		measurementVersion: text("measurement_version").notNull(),
		contentDigest: text("content_digest").notNull(),
		colours: jsonb("colours").$type<unknown[]>().notNull(),
		outlineWidth: integer("outline_width"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({
			name: "context_rule_measurements_pk",
			columns: [table.assetVersionId, table.measurementVersion],
		}),
		foreignKey({
			name: "context_rule_measurements_version_fk",
			columns: [table.projectId, table.assetVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("cascade"),
		index("context_rule_measurements_project_idx").on(table.projectId),
	]
);

/** The production history of a Candidate Version created by a Colour Merge. */
export const colourMerges = pgTable(
	"colour_merges",
	{
		assetVersionId: text("asset_version_id").primaryKey(),
		projectId: text("project_id").notNull(),
		sourceAssetVersionId: text("source_asset_version_id").notNull(),
		contextRevisionId: text("context_revision_id").notNull(),
		steps: jsonb("steps").$type<unknown[]>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "colour_merges_version_fk",
			columns: [table.projectId, table.assetVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "colour_merges_source_version_fk",
			columns: [table.projectId, table.sourceAssetVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "colour_merges_context_revision_fk",
			columns: [table.projectId, table.contextRevisionId],
			foreignColumns: [contextRevisions.projectId, contextRevisions.id],
		}).onDelete("cascade"),
		index("colour_merges_project_idx").on(table.projectId),
	]
);
