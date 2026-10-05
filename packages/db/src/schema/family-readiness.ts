import { sql } from "drizzle-orm";
import {
	boolean,
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

import { assetFamilies } from "./asset-records";
import {
	assetVersions,
	compositeVersions,
	unitVersions,
} from "./asset-versions";
import { user } from "./auth";
import { contextRevisions } from "./project-context";

export const familyRequiredSetRevisions = pgTable(
	"family_required_set_revisions",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		revisionNumber: integer("revision_number").notNull(),
		items: jsonb("items").$type<unknown[]>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "family_required_set_revisions_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("restrict"),
		uniqueIndex("family_required_set_revisions_project_family_id_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.id
		),
		uniqueIndex("family_required_set_revisions_family_number_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.revisionNumber
		),
		index("family_required_set_revisions_family_created_idx").on(
			table.assetFamilyId,
			table.createdAt
		),
	]
);

export const familyRequiredSetHeads = pgTable(
	"family_required_set_heads",
	{
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		activeRevisionId: text("active_revision_id"),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "family_required_set_heads_family_fk",
			columns: [table.projectId, table.assetFamilyId],
			foreignColumns: [assetFamilies.projectId, assetFamilies.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "family_required_set_heads_active_revision_fk",
			columns: [table.projectId, table.assetFamilyId, table.activeRevisionId],
			foreignColumns: [
				familyRequiredSetRevisions.projectId,
				familyRequiredSetRevisions.assetFamilyId,
				familyRequiredSetRevisions.id,
			],
		}).onDelete("restrict"),
		uniqueIndex("family_required_set_heads_family_idx").on(
			table.projectId,
			table.assetFamilyId
		),
	]
);

export const familyRequiredSetActivations = pgTable(
	"family_required_set_activations",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		revisionId: text("revision_id").notNull(),
		activatedByUserId: text("activated_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		activatedAt: timestamp("activated_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "family_required_set_activations_revision_fk",
			columns: [table.projectId, table.assetFamilyId, table.revisionId],
			foreignColumns: [
				familyRequiredSetRevisions.projectId,
				familyRequiredSetRevisions.assetFamilyId,
				familyRequiredSetRevisions.id,
			],
		}).onDelete("restrict"),
		index("family_required_set_activations_family_revision_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.revisionId,
			table.activatedAt
		),
	]
);

export const familyReadinessEvidence = pgTable(
	"family_readiness_evidence",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		revisionId: text("revision_id").notNull(),
		itemId: text("item_id").notNull(),
		kind: text("kind")
			.$type<"applicability" | "quality" | "usage_test">()
			.notNull(),
		result: text("result")
			.$type<
				| "applicable"
				| "inapplicable"
				| "passed"
				| "failed"
				| "inconclusive"
				| "waived"
			>()
			.notNull(),
		assetVersionIds: jsonb("asset_version_ids").$type<string[]>().notNull(),
		profileContractRevisionIds: jsonb("profile_contract_revision_ids")
			.$type<(string | null)[]>()
			.notNull()
			.default([]),
		contextRevisionId: text("context_revision_id"),
		visualWorldId: text("visual_world_id").notNull(),
		useContext: text("use_context").notNull(),
		canonicalDesignVersionId: text("canonical_design_version_id"),
		ruleId: text("rule_id"),
		ruleClass: text("rule_class").$type<
			| "integrity_gate"
			| "waivable_requirement"
			| "quality_advisory"
			| "human_review"
		>(),
		testId: text("test_id"),
		usageVariant: text("usage_variant"),
		targetWidth: integer("target_width"),
		targetHeight: integer("target_height"),
		grayscaleReviewed: boolean("grayscale_reviewed"),
		observedValue: text("observed_value"),
		unitVersionId: text("unit_version_id").references(() => unitVersions.id, {
			onDelete: "restrict",
		}),
		compositeVersionId: text("composite_version_id").references(
			() => compositeVersions.id,
			{ onDelete: "restrict" }
		),
		method: text("method"),
		rationale: text("rationale").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"family_readiness_evidence_version_target_check",
			sql`NOT (${table.unitVersionId} IS NOT NULL AND ${table.compositeVersionId} IS NOT NULL) AND ((${table.unitVersionId} IS NULL AND ${table.compositeVersionId} IS NULL) OR ${table.kind} = 'quality')`
		),
		foreignKey({
			name: "family_readiness_evidence_revision_fk",
			columns: [table.projectId, table.assetFamilyId, table.revisionId],
			foreignColumns: [
				familyRequiredSetRevisions.projectId,
				familyRequiredSetRevisions.assetFamilyId,
				familyRequiredSetRevisions.id,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "family_readiness_evidence_context_revision_fk",
			columns: [table.projectId, table.contextRevisionId],
			foreignColumns: [contextRevisions.projectId, contextRevisions.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "family_readiness_evidence_canonical_version_fk",
			columns: [
				table.projectId,
				table.assetFamilyId,
				table.canonicalDesignVersionId,
			],
			foreignColumns: [
				assetVersions.projectId,
				assetVersions.assetFamilyId,
				assetVersions.id,
			],
		}).onDelete("restrict"),
		check(
			"family_readiness_evidence_kind_result_check",
			sql`(${table.kind} = 'applicability' AND ${table.result} IN ('applicable', 'inapplicable')) OR (${table.kind} = 'quality' AND ${table.result} IN ('passed', 'failed', 'inconclusive', 'waived')) OR (${table.kind} = 'usage_test' AND ${table.result} IN ('passed', 'failed', 'inconclusive'))`
		),
		check(
			"family_readiness_evidence_target_dimensions_check",
			sql`(${table.targetWidth} IS NULL AND ${table.targetHeight} IS NULL) OR (${table.targetWidth} IS NOT NULL AND ${table.targetHeight} IS NOT NULL AND ${table.targetWidth} > 0 AND ${table.targetHeight} > 0)`
		),
		check(
			"family_readiness_evidence_usage_variant_check",
			sql`${table.usageVariant} IS NULL OR (${table.usageVariant} = btrim(${table.usageVariant}) AND char_length(${table.usageVariant}) BETWEEN 1 AND 120)`
		),
		check(
			"family_readiness_evidence_icon_usage_fields_check",
			sql`(${table.usageVariant} IS NULL AND ${table.targetWidth} IS NULL AND ${table.targetHeight} IS NULL AND ${table.grayscaleReviewed} IS NULL) OR (${table.testId} IS NOT NULL AND ${table.testId} = 'icon.light_dark_target_size' AND ${table.usageVariant} IS NOT NULL AND ${table.targetWidth} IS NOT NULL AND ${table.targetHeight} IS NOT NULL AND ${table.grayscaleReviewed} IS TRUE)`
		),
		check(
			"family_readiness_evidence_payload_check",
			sql`(${table.kind} = 'quality' AND ${table.ruleId} IS NOT NULL AND ${table.testId} IS NULL AND ${table.method} IS NOT NULL AND (${table.result} <> 'waived' OR ${table.observedValue} IS NOT NULL)) OR (${table.kind} = 'usage_test' AND ${table.ruleId} IS NULL AND ${table.ruleClass} IS NULL AND ${table.testId} IS NOT NULL AND ${table.observedValue} IS NULL AND ${table.method} IS NOT NULL) OR (${table.kind} = 'applicability' AND ${table.ruleId} IS NULL AND ${table.ruleClass} IS NULL AND ${table.testId} IS NULL AND ${table.observedValue} IS NULL AND ${table.method} IS NULL)`
		),
		index("family_readiness_evidence_item_created_idx").on(
			table.projectId,
			table.assetFamilyId,
			table.revisionId,
			table.itemId,
			table.kind,
			table.createdAt
		),
	]
);
