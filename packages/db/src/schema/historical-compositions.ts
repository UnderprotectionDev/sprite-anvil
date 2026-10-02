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
import { assetVersions, compositeVersions } from "./asset-versions";
import { user } from "./auth";
import { project } from "./project";
import { contextRevisions } from "./project-context";

export const historicalCompositionPins = pgTable(
	"historical_composition_pins",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		idempotencyKey: text("idempotency_key").notNull(),
		compositeVersionId: text("composite_version_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		contextRevisionId: text("context_revision_id").notNull(),
		canonicalDesignVersionId: text("canonical_design_version_id").notNull(),
		snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.projectId, table.compositeVersionId, table.assetRecordId],
			foreignColumns: [
				compositeVersions.projectId,
				compositeVersions.id,
				compositeVersions.assetRecordId,
			],
			name: "historical_pins_composite_fk",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.projectId, table.contextRevisionId],
			foreignColumns: [contextRevisions.projectId, contextRevisions.id],
			name: "historical_pins_context_fk",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.projectId, table.canonicalDesignVersionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
			name: "historical_pins_canonical_fk",
		}).onDelete("restrict"),
		uniqueIndex("historical_pins_idempotency_idx").on(
			table.projectId,
			table.idempotencyKey
		),
		index("historical_pins_project_created_idx").on(
			table.projectId,
			table.createdAt
		),
		check(
			"historical_pins_snapshot_check",
			sql`jsonb_typeof(${table.snapshot}) = 'object'`
		),
	]
);
