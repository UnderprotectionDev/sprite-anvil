import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { exportBundles } from "./export-bundles";
import { project } from "./project";

/**
 * One Platform Equivalence Run: the evidence a surface derived from one Export
 * Bundle. The surface is declared by the client and the server cannot verify
 * it. The row id is derived from the client's idempotency key, and rows are
 * inserted once, never updated.
 */
export const platformEquivalenceRuns = pgTable(
	"platform_equivalence_runs",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		surface: text("surface").notNull(),
		bundleId: text("bundle_id").notNull(),
		inputDigest: text("input_digest").notNull(),
		/** Input and per-section evidence, as derived from the bundle. */
		evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull(),
		requestDigest: text("request_digest").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("platform_equivalence_runs_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		check(
			"platform_equivalence_runs_surface_check",
			sql`${table.surface} in ('web', 'desktop')`
		),
		foreignKey({
			name: "platform_equivalence_runs_bundle_fk",
			columns: [table.projectId, table.bundleId],
			foreignColumns: [exportBundles.projectId, exportBundles.id],
		}).onDelete("cascade"),
	]
);

/**
 * One immutable Platform Equivalence Report: the comparison of the chosen web
 * and desktop runs. It is Phase 3 interim evidence and never full acceptance.
 */
export const platformEquivalenceReports = pgTable(
	"platform_equivalence_reports",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		webRunId: text("web_run_id").references(() => platformEquivalenceRuns.id, {
			onDelete: "cascade",
		}),
		desktopRunId: text("desktop_run_id").references(
			() => platformEquivalenceRuns.id,
			{ onDelete: "cascade" }
		),
		comparison: jsonb("comparison").$type<Record<string, unknown>>().notNull(),
		requestDigest: text("request_digest").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("platform_equivalence_reports_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);
