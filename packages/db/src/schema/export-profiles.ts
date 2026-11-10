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
import { project } from "./project";

/** The identity a user's versions of one export setup share. */
export const exportProfiles = pgTable(
	"export_profiles",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("export_profiles_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);

/**
 * One immutable version of an Export Profile. The definition, its contract
 * version and the digest of both are written once; a change or a migration is
 * the next revision, never an update. The row id is the client's idempotency key.
 */
export const exportProfileRevisions = pgTable(
	"export_profile_revisions",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		profileId: text("profile_id").notNull(),
		revisionNumber: integer("revision_number").notNull(),
		contractVersion: text("contract_version").notNull(),
		definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
		contentDigest: text("content_digest").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "export_profile_revisions_profile_fk",
			columns: [table.projectId, table.profileId],
			foreignColumns: [exportProfiles.projectId, exportProfiles.id],
		}).onDelete("cascade"),
		uniqueIndex("export_profile_revisions_profile_number_idx").on(
			table.profileId,
			table.revisionNumber
		),
		check(
			"export_profile_revisions_number_check",
			sql`${table.revisionNumber} > 0`
		),
	]
);
