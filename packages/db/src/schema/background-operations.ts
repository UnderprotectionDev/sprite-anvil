import {
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

export const backgroundOperationKind = pgEnum("background_operation_kind", [
	"archive",
	"restore",
	"export",
	"verification",
	"deletion",
]);

export const backgroundOperationStatus = pgEnum("background_operation_status", [
	"pending",
	"running",
	"completed",
	"failed",
	"cancel_requested",
	"cancelled",
]);

/** The authoritative record of one Background Operation; no transport message replaces it. */
export const backgroundOperations = pgTable(
	"background_operations",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		kind: backgroundOperationKind("kind").notNull(),
		scopeSummary: text("scope_summary").notNull(),
		scopeTargetId: text("scope_target_id"),
		triggerSummary: text("trigger_summary").notNull(),
		triggeredByUserId: text("triggered_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: backgroundOperationStatus("status").default("pending").notNull(),
		attemptCount: integer("attempt_count").default(0).notNull(),
		maxAttempts: integer("max_attempts").default(3).notNull(),
		progressPercent: integer("progress_percent"),
		progressStep: text("progress_step"),
		resultSummary: text("result_summary"),
		failureSummary: text("failure_summary"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		startedAt: timestamp("started_at"),
		heartbeatAt: timestamp("heartbeat_at"),
		finishedAt: timestamp("finished_at"),
		cancelRequestedAt: timestamp("cancel_requested_at"),
	},
	(table) => [
		index("background_operations_project_created_at_idx").on(
			table.projectId,
			table.createdAt
		),
		index("background_operations_status_heartbeat_idx").on(
			table.status,
			table.heartbeatAt,
			table.updatedAt
		),
		index("background_operations_triggered_by_user_id_idx").on(
			table.triggeredByUserId
		),
	]
);

/** One message still owed to the transport; written in the same transaction as the state it announces. */
export const backgroundOperationOutbox = pgTable(
	"background_operation_outbox",
	{
		id: text("id").primaryKey(),
		backgroundOperationId: text("operation_id")
			.notNull()
			.references(() => backgroundOperations.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		publishedAt: timestamp("published_at"),
	},
	(table) => [
		index("background_operation_outbox_unpublished_idx").on(
			table.publishedAt,
			table.createdAt
		),
		index("background_operation_outbox_operation_id_idx").on(
			table.backgroundOperationId
		),
	]
);
