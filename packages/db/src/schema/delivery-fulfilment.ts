import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { deliveryTargetRevisions } from "./delivery-planning";
import { project } from "./project";

/** One requirement's bundle as proposed: the exact Asset Versions the bundle pins for it. */
export interface FulfilmentDraftCandidate {
	assetVersionIds: string[];
	bundleId: string;
	manifestDigest: string;
}

/** A bundle's runtime validation check as computed when the draft was prepared. */
export interface FulfilmentDraftBundleCheck {
	bundleId: string;
	createdAt: string;
	manifestDigest: string;
	runtimeValidation: unknown;
}

/**
 * One system-prepared mapping draft for one Delivery Target revision. It is a
 * proposal, never a Delivery Fulfilment: it holds no user decision and gives no
 * delivery status. Rows are inserted once, never updated; preparing again
 * writes another draft.
 */
export const deliveryFulfilmentDrafts = pgTable(
	"delivery_fulfilment_drafts",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		deliveryTargetId: text("delivery_target_id").notNull(),
		revisionId: text("revision_id")
			.notNull()
			.references(() => deliveryTargetRevisions.id, { onDelete: "cascade" }),
		revisionNumber: integer("revision_number").notNull(),
		bundleChecks: jsonb("bundle_checks")
			.$type<FulfilmentDraftBundleCheck[]>()
			.notNull(),
		/** Digest of the prepare request, so a repeated key with other content is a conflict. */
		requestDigest: text("request_digest").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("delivery_fulfilment_drafts_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		check(
			"delivery_fulfilment_drafts_revision_number_check",
			sql`${table.revisionNumber} > 0`
		),
	]
);

/** One required item of the draft's revision, with the bundles that meet it. Rows are only inserted. */
export const deliveryFulfilmentDraftRequirements = pgTable(
	"delivery_fulfilment_draft_requirements",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		draftId: text("draft_id").notNull(),
		position: integer("position").notNull(),
		assetFamilyId: text("asset_family_id").notNull(),
		assetFamilyName: text("asset_family_name").notNull(),
		itemId: text("item_id").notNull(),
		itemKind: text("item_kind").notNull(),
		itemName: text("item_name").notNull(),
		requiredSetRevisionId: text("required_set_revision_id").notNull(),
		status: text("status")
			.$type<"mapped" | "agreed" | "conflict" | "missing">()
			.notNull(),
		proposedBundleId: text("proposed_bundle_id"),
		candidates: jsonb("candidates")
			.$type<FulfilmentDraftCandidate[]>()
			.notNull(),
	},
	(table) => [
		foreignKey({
			name: "delivery_fulfilment_draft_requirements_draft_fk",
			columns: [table.projectId, table.draftId],
			foreignColumns: [
				deliveryFulfilmentDrafts.projectId,
				deliveryFulfilmentDrafts.id,
			],
		}).onDelete("cascade"),
		uniqueIndex("delivery_fulfilment_draft_requirements_item_idx").on(
			table.draftId,
			table.assetFamilyId,
			table.itemId
		),
		uniqueIndex("delivery_fulfilment_draft_requirements_position_idx").on(
			table.draftId,
			table.position
		),
	]
);
