import { defineRelationsPart } from "drizzle-orm";
import {
	foreignKey,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

export const contextRevisions = pgTable(
	"context_revisions",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		revisionNumber: integer("revision_number").notNull(),
		state: text("state").$type<"baseline" | "active">().notNull(),
		contractVersion: text("contract_version").notNull(),
		rules: jsonb("rules").$type<unknown[]>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("context_revisions_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("context_revisions_project_revision_number_idx").on(
			table.projectId,
			table.revisionNumber
		),
	]
);

export const contextProposals = pgTable(
	"context_proposals",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		baseContextRevisionId: text("base_context_revision_id").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		contractVersion: text("contract_version").notNull(),
		sourceKind: text("source_kind")
			.$type<"structured_control" | "agent">()
			.notNull(),
		proposal: jsonb("proposal").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "context_proposals_project_revision_fk",
			columns: [table.projectId, table.baseContextRevisionId],
			foreignColumns: [contextRevisions.projectId, contextRevisions.id],
		}).onDelete("cascade"),
		index("context_proposals_project_created_at_idx").on(
			table.projectId,
			table.createdAt
		),
		index("context_proposals_created_by_user_id_idx").on(table.createdByUserId),
	]
);

export const projectContextRelations = defineRelationsPart(
	{ user, project, contextRevisions, contextProposals },
	(r) => ({
		user: {
			projects: r.many.project({
				from: r.user.id,
				to: r.project.ownerUserId,
			}),
			contextRevisions: r.many.contextRevisions({
				from: r.user.id,
				to: r.contextRevisions.createdByUserId,
			}),
			contextProposals: r.many.contextProposals({
				from: r.user.id,
				to: r.contextProposals.createdByUserId,
			}),
		},
		project: {
			owner: r.one.user({ from: r.project.ownerUserId, to: r.user.id }),
			revisions: r.many.contextRevisions({
				from: r.project.id,
				to: r.contextRevisions.projectId,
			}),
			proposals: r.many.contextProposals({
				from: r.project.id,
				to: r.contextProposals.projectId,
			}),
		},
		contextRevisions: {
			project: r.one.project({
				from: r.contextRevisions.projectId,
				to: r.project.id,
			}),
			creator: r.one.user({
				from: r.contextRevisions.createdByUserId,
				to: r.user.id,
			}),
			proposals: r.many.contextProposals({
				from: r.contextRevisions.id,
				to: r.contextProposals.baseContextRevisionId,
			}),
		},
		contextProposals: {
			project: r.one.project({
				from: r.contextProposals.projectId,
				to: r.project.id,
			}),
			baseContextRevision: r.one.contextRevisions({
				from: r.contextProposals.baseContextRevisionId,
				to: r.contextRevisions.id,
			}),
			creator: r.one.user({
				from: r.contextProposals.createdByUserId,
				to: r.user.id,
			}),
		},
	})
);
