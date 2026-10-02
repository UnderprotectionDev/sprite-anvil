import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { assetVersionReviewEvents, assetVersions } from "./asset-versions";
import { user } from "./auth";
import { project } from "./project";
import { contextRevisions } from "./project-context";

export const dependencyLinks = pgTable(
	"dependency_links",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		sourceAssetVersionId: text("source_asset_version_id"),
		sourceContextRevisionId: text("source_context_revision_id"),
		targetAssetVersionId: text("target_asset_version_id").notNull(),
		facets: jsonb("facets").$type<string[]>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"dependency_links_single_source_check",
			sql`(${table.sourceAssetVersionId} IS NOT NULL) <> (${table.sourceContextRevisionId} IS NOT NULL)`
		),
		check(
			"dependency_links_distinct_versions_check",
			sql`${table.sourceAssetVersionId} IS NULL OR ${table.sourceAssetVersionId} <> ${table.targetAssetVersionId}`
		),
		foreignKey({
			name: "dependency_links_source_version_fk",
			columns: [table.projectId, table.sourceAssetVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "dependency_links_source_context_fk",
			columns: [table.projectId, table.sourceContextRevisionId],
			foreignColumns: [contextRevisions.projectId, contextRevisions.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "dependency_links_target_version_fk",
			columns: [table.projectId, table.targetAssetVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		uniqueIndex("dependency_links_version_target_idx").on(
			table.projectId,
			table.sourceAssetVersionId,
			table.targetAssetVersionId
		),
		uniqueIndex("dependency_links_context_target_idx").on(
			table.projectId,
			table.sourceContextRevisionId,
			table.targetAssetVersionId
		),
		index("dependency_links_project_idx").on(table.projectId),
	]
);

export const changeImpacts = pgTable(
	"change_impacts",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		sourceAssetVersionId: text("source_asset_version_id"),
		sourceContextRevisionId: text("source_context_revision_id"),
		facets: jsonb("facets").$type<string[]>().notNull(),
		affectedVersions: jsonb("affected_versions")
			.$type<
				{
					assetVersionId: string;
					assetRecordId: string;
					status: "revalidation_required";
					reason: "matching_dependency" | "incomplete_dependency";
					dependencySourceId: string;
				}[]
			>()
			.notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"change_impacts_single_source_check",
			sql`(${table.sourceAssetVersionId} IS NOT NULL) <> (${table.sourceContextRevisionId} IS NOT NULL)`
		),
		foreignKey({
			name: "change_impacts_source_version_fk",
			columns: [table.projectId, table.sourceAssetVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "change_impacts_source_context_fk",
			columns: [table.projectId, table.sourceContextRevisionId],
			foreignColumns: [contextRevisions.projectId, contextRevisions.id],
		}).onDelete("restrict"),
		index("change_impacts_project_created_idx").on(
			table.projectId,
			table.createdAt
		),
	]
);

export const derivativeRevalidationReviews = pgTable(
	"derivative_revalidation_reviews",
	{
		id: text("id")
			.primaryKey()
			.references(() => assetVersionReviewEvents.id, { onDelete: "restrict" }),
		projectId: text("project_id").notNull(),
		assetVersionId: text("asset_version_id").notNull(),
		contextRevisionId: text("context_revision_id").notNull(),
		canonicalDesignVersionId: text("canonical_design_version_id").notNull(),
		changeImpactIds: jsonb("change_impact_ids").$type<string[]>().notNull(),
	},
	(table) => [
		foreignKey({
			name: "derivative_reviews_version_fk",
			columns: [table.projectId, table.assetVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "derivative_reviews_context_fk",
			columns: [table.projectId, table.contextRevisionId],
			foreignColumns: [contextRevisions.projectId, contextRevisions.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "derivative_reviews_canonical_fk",
			columns: [table.projectId, table.canonicalDesignVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		check(
			"derivative_reviews_impacts_check",
			sql`jsonb_typeof(${table.changeImpactIds}) = 'array' AND jsonb_array_length(${table.changeImpactIds}) > 0`
		),
		index("derivative_reviews_project_version_idx").on(
			table.projectId,
			table.assetVersionId
		),
	]
);
