import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { familyRequiredSetRevisions } from "./family-readiness";
import { project } from "./project";
import { contextRevisions } from "./project-context";

type DeliveryTargetPurpose = "demo" | "chapter" | "update" | "other";
type ProductionEvidenceRequirement =
	| "full_generation_package_history"
	| "legacy_asset_attestation_acceptable"
	| "advisory";
type RightsRecordState =
	| "documented"
	| "assertion_only"
	| "unknown"
	| "restricted";
export interface ProductionEvidencePolicy {
	defaultRequirement: ProductionEvidenceRequirement;
	familyRequirements: {
		assetFamilyId: string;
		requirement: ProductionEvidenceRequirement;
	}[];
}
export interface RightsEvidencePolicy {
	acceptableStates: RightsRecordState[];
	requireRecordFor: ("references" | "results")[];
}

/** Required game environments and the freshness rule a Delivery Target accepts as runtime validation. */
export interface RuntimeValidationCriterion {
	environments: {
		adapterVersion: string | null;
		engineVersion: string;
		gameBuild: string;
	}[];
	freshness: "not_superseded";
}

/** The identity a user's versions of one delivery intent share. */
export const deliveryTargets = pgTable(
	"delivery_targets",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		purpose: text("purpose").$type<DeliveryTargetPurpose>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("delivery_targets_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		check(
			"delivery_targets_purpose_check",
			sql`${table.purpose} in ('demo', 'chapter', 'update', 'other')`
		),
	]
);

/**
 * An immutable, reviewable proposal of one Delivery Target scope. It pins a
 * Context Revision and, per Asset Family, a Required Items List revision, and
 * never an Asset Version. A draft changes no official state until activated.
 */
export const deliveryTargetDrafts = pgTable(
	"delivery_target_drafts",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		deliveryTargetId: text("delivery_target_id").notNull(),
		contextRevisionId: text("context_revision_id").notNull(),
		/** Pinned with the draft; an activated revision reads them from its draft. */
		productionEvidencePolicy: jsonb("production_evidence_policy")
			.$type<ProductionEvidencePolicy>()
			.notNull(),
		rightsEvidencePolicy: jsonb("rights_evidence_policy")
			.$type<RightsEvidencePolicy>()
			.notNull(),
		/** Null for a target without a runtime validation acceptance criterion. */
		runtimeValidationCriterion: jsonb(
			"runtime_validation_criterion"
		).$type<RuntimeValidationCriterion>(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "delivery_target_drafts_target_fk",
			columns: [table.projectId, table.deliveryTargetId],
			foreignColumns: [deliveryTargets.projectId, deliveryTargets.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "delivery_target_drafts_context_revision_fk",
			columns: [table.projectId, table.contextRevisionId],
			foreignColumns: [contextRevisions.projectId, contextRevisions.id],
		}).onDelete("cascade"),
		uniqueIndex("delivery_target_drafts_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		index("delivery_target_drafts_target_created_idx").on(
			table.deliveryTargetId,
			table.createdAt
		),
	]
);

export const deliveryTargetDraftFamilies = pgTable(
	"delivery_target_draft_families",
	{
		draftId: text("draft_id").notNull(),
		projectId: text("project_id").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		requiredSetRevisionId: text("required_set_revision_id").notNull(),
		position: integer("position").notNull(),
	},
	(table) => [
		primaryKey({
			name: "delivery_target_draft_families_pk",
			columns: [table.draftId, table.assetFamilyId],
		}),
		foreignKey({
			name: "delivery_target_draft_families_draft_fk",
			columns: [table.projectId, table.draftId],
			foreignColumns: [deliveryTargetDrafts.projectId, deliveryTargetDrafts.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "delivery_target_draft_families_required_set_fk",
			columns: [
				table.projectId,
				table.assetFamilyId,
				table.requiredSetRevisionId,
			],
			foreignColumns: [
				familyRequiredSetRevisions.projectId,
				familyRequiredSetRevisions.assetFamilyId,
				familyRequiredSetRevisions.id,
			],
		}).onDelete("cascade"),
		uniqueIndex("delivery_target_draft_families_position_idx").on(
			table.draftId,
			table.position
		),
	]
);

/**
 * A user activation of one draft: the next immutable Delivery Target version.
 * Its scope is the activated draft's pins, so it is never rewritten; moving to
 * a new rule base is another draft and another revision.
 */
export const deliveryTargetRevisions = pgTable(
	"delivery_target_revisions",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		deliveryTargetId: text("delivery_target_id").notNull(),
		revisionNumber: integer("revision_number").notNull(),
		draftId: text("draft_id").notNull(),
		activatedByUserId: text("activated_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		activatedAt: timestamp("activated_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "delivery_target_revisions_target_fk",
			columns: [table.projectId, table.deliveryTargetId],
			foreignColumns: [deliveryTargets.projectId, deliveryTargets.id],
		}).onDelete("cascade"),
		foreignKey({
			name: "delivery_target_revisions_draft_fk",
			columns: [table.projectId, table.draftId],
			foreignColumns: [deliveryTargetDrafts.projectId, deliveryTargetDrafts.id],
		}).onDelete("cascade"),
		uniqueIndex("delivery_target_revisions_draft_idx").on(table.draftId),
		uniqueIndex("delivery_target_revisions_target_number_idx").on(
			table.deliveryTargetId,
			table.revisionNumber
		),
		check(
			"delivery_target_revisions_number_check",
			sql`${table.revisionNumber} > 0`
		),
	]
);
