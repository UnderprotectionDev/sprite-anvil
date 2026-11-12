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

import { deliveryFulfilments } from "./delivery-fulfilment";
import { project } from "./project";
import { rightsRecords } from "./rights-records";

export interface HistoricalRiskPinnedPolicy {
	acceptableStates: string[];
	requireRecordFor: string[];
}

export interface HistoricalRiskPinnedRights {
	rightsRecordId: string;
	state: string;
	versionNumber: number;
}

export interface HistoricalRiskAffectedUsage {
	assetFamilyId: string;
	assetFamilyName: string;
	bundleId: string;
	itemId: string;
	itemName: string;
}

/**
 * One immutable Historical Risk Notice: a new Rights Record revision that the
 * policy pinned by a past Delivery Fulfilment does not accept. Rows are only
 * inserted, never updated or deleted, and no column changes the Fulfilment's
 * Delivered state or the evidence it pinned.
 */
export const historicalRiskNotices = pgTable(
	"historical_risk_notices",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		deliveryTargetId: text("delivery_target_id").notNull(),
		fulfilmentId: text("fulfilment_id").notNull(),
		revisionId: text("revision_id").notNull(),
		revisionNumber: integer("revision_number").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		rightsRecordId: text("rights_record_id")
			.notNull()
			.references(() => rightsRecords.id, { onDelete: "restrict" }),
		rightsRecordVersionNumber: integer(
			"rights_record_version_number"
		).notNull(),
		rightsRecordState: text("rights_record_state").notNull(),
		pinnedPolicy: jsonb("pinned_policy")
			.$type<HistoricalRiskPinnedPolicy>()
			.notNull(),
		pinnedRights: jsonb(
			"pinned_rights"
		).$type<HistoricalRiskPinnedRights | null>(),
		affectedUsage: jsonb("affected_usage")
			.$type<HistoricalRiskAffectedUsage[]>()
			.notNull(),
		detectedAt: timestamp("detected_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "historical_risk_notices_fulfilment_fk",
			columns: [table.projectId, table.fulfilmentId],
			foreignColumns: [deliveryFulfilments.projectId, deliveryFulfilments.id],
		}).onDelete("cascade"),
		uniqueIndex("historical_risk_notices_fulfilment_rights_idx").on(
			table.fulfilmentId,
			table.rightsRecordId
		),
		index("historical_risk_notices_target_idx").on(
			table.projectId,
			table.deliveryTargetId
		),
		check(
			"historical_risk_notices_version_check",
			sql`${table.revisionNumber} > 0 AND ${table.rightsRecordVersionNumber} > 0`
		),
	]
);
