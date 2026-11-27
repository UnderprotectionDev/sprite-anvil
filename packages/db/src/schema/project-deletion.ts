import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Independent owner-scoped deletion receipt; survives removal of the Project row. */
export const projectDeletionJobs = pgTable(
	"project_deletion_jobs",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		scopeDigest: text("scope_digest").notNull(),
		impact: jsonb("impact")
			.$type<{
				records: { kind: string; count: number }[];
				managedObjects: number;
				sharedObjects: number;
			}>()
			.notNull(),
		plan: jsonb("plan")
			.$type<{ objectKeys: string[]; recordDigest: string }>()
			.notNull(),
		operationId: text("operation_id"),
		state: text("state")
			.$type<"approved" | "removing" | "completed" | "rejected">()
			.notNull()
			.default("approved"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		completedAt: timestamp("completed_at"),
	},
	(table) => [
		index("project_deletion_jobs_owner_idx").on(table.ownerUserId),
		index("project_deletion_jobs_scope_idx").on(
			table.projectId,
			table.scopeDigest
		),
	]
);
