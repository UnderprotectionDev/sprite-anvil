import { sql } from "drizzle-orm";
import {
	check,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

type MeasurementEventFamily =
	| "production_workflow"
	| "review_and_repair"
	| "import_mapping"
	| "export_delivery"
	| "runtime_validation"
	| "offline_verification";

export interface MeasurementScope {
	projects:
		| { kind: "all_projects" }
		| { kind: "listed_projects"; projectIds: string[] };
	surfaces: ("web" | "desktop")[];
	users: "owner_only" | "all_users";
}

export interface MeasurementRatioTerm {
	outcomeClass: string;
}

/**
 * One immutable version of a metric's Measurement Definition. A new
 * definition for the same metric is another row with the next version number;
 * rows are never updated, so an earlier baseline series keeps the definition
 * it was collected under. Activation time is the server clock.
 */
export const measurementDefinitions = pgTable(
	"measurement_definitions",
	{
		id: text("id").primaryKey(),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		metricId: text("metric_id").notNull(),
		version: integer("version").notNull(),
		/** The full contract version the definition was written against, as major.minor. */
		contractVersion: text("contract_version").notNull(),
		eventFamily: text("event_family").$type<MeasurementEventFamily>().notNull(),
		startEvent: text("start_event").notNull(),
		endEvent: text("end_event").notNull(),
		scope: jsonb("scope").$type<MeasurementScope>().notNull(),
		numerator: jsonb("numerator").$type<MeasurementRatioTerm>().notNull(),
		denominator: jsonb("denominator").$type<MeasurementRatioTerm>().notNull(),
		exclusions: jsonb("exclusions").$type<string[]>().notNull(),
		timeWindowDays: integer("time_window_days").notNull(),
		retentionDays: integer("retention_days").notNull(),
		decisionUse: text("decision_use").notNull(),
		activatedAt: timestamp("activated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("measurement_definitions_owner_metric_version_idx").on(
			table.ownerUserId,
			table.metricId,
			table.version
		),
		check("measurement_definitions_version_check", sql`${table.version} > 0`),
		check(
			"measurement_definitions_event_family_check",
			sql`${table.eventFamily} in ('production_workflow', 'review_and_repair', 'import_mapping', 'export_delivery', 'runtime_validation', 'offline_verification')`
		),
		check(
			"measurement_definitions_window_check",
			sql`${table.timeWindowDays} > 0 and ${table.retentionDays} > 0`
		),
		check(
			"measurement_definitions_events_check",
			sql`${table.startEvent} <> ${table.endEvent}`
		),
	]
);
