import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { measurementDefinitions } from "./measurement-definitions";

type MeasurementEventFamily =
	| "production_workflow"
	| "review_and_repair"
	| "import_mapping"
	| "export_delivery"
	| "runtime_validation"
	| "offline_verification";

/**
 * One privacy-preserving workflow event. The row holds only pseudonymous user
 * and project ids, labels, whole-number counters and the server time: no file
 * content, pixels, raw instructions, notes, local paths, asset names or
 * secrets, and no real user or project id. Rows are inserted, never updated.
 * It relates to the exact Measurement Definition version it was collected
 * under, so another version's events are never mixed into its series.
 */
export const measurementEvents = pgTable(
	"measurement_events",
	{
		id: text("id").primaryKey(),
		definitionId: text("definition_id")
			.notNull()
			.references(() => measurementDefinitions.id, { onDelete: "cascade" }),
		/** Copied from the definition at record time so a series reads without a join. */
		definitionVersion: integer("definition_version").notNull(),
		metricId: text("metric_id").notNull(),
		eventFamily: text("event_family").$type<MeasurementEventFamily>().notNull(),
		userPseudonym: text("user_pseudonym").notNull(),
		projectPseudonym: text("project_pseudonym").notNull(),
		workflowId: text("workflow_id").notNull(),
		recordKind: text("record_kind").notNull(),
		eventName: text("event_name").notNull(),
		surface: text("surface").$type<"web" | "desktop">().notNull(),
		outcomeClass: text("outcome_class").notNull(),
		counters: jsonb("counters").$type<Record<string, number>>().notNull(),
		occurredAt: timestamp("occurred_at").defaultNow().notNull(),
	},
	(table) => [
		index("measurement_events_definition_workflow_idx").on(
			table.definitionId,
			table.workflowId
		),
		check(
			"measurement_events_surface_check",
			sql`${table.surface} in ('web', 'desktop')`
		),
		check(
			"measurement_events_version_check",
			sql`${table.definitionVersion} > 0`
		),
	]
);
