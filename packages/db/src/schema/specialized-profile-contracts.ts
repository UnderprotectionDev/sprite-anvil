import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { specializedProfileIds } from "../specialized-profile-ids";
import { user } from "./auth";
import { project } from "./project";

export const specializedProfileContractRevisions = pgTable(
	"specialized_profile_contract_revisions",
	{
		id: text("id").primaryKey(),
		profileId: text("profile_id").notNull(),
		contractSchemaVersion: text("contract_schema_version").notNull(),
		contractVersion: text("contract_version").notNull(),
		definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex(
			"specialized_profile_contract_revisions_profile_version_idx"
		).on(table.profileId, table.contractVersion),
		uniqueIndex("specialized_profile_contract_revisions_profile_id_id_idx").on(
			table.profileId,
			table.id
		),
		check(
			"specialized_profile_contract_revisions_profile_id_check",
			sql`${table.profileId} in (${sql.join(
				specializedProfileIds.map((profileId) => sql`${profileId}`),
				sql`, `
			)})`
		),
		check(
			"specialized_profile_contract_revisions_schema_version_check",
			sql`${table.contractSchemaVersion} = 'asset-profile/1.0.0'`
		),
		check(
			"specialized_profile_contract_revisions_version_check",
			sql`${table.contractVersion} ~ '^[0-9]+\\.[0-9]+\\.[0-9]+$'`
		),
	]
);

export const projectSpecializedProfileContracts = pgTable(
	"project_specialized_profile_contracts",
	{
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		profileId: text("profile_id").notNull(),
		contractRevisionId: text("contract_revision_id").notNull(),
		activatedByUserId: text("activated_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		activatedAt: timestamp("activated_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({
			name: "project_specialized_profile_contracts_pk",
			columns: [table.projectId, table.profileId],
		}),
		foreignKey({
			name: "project_specialized_profile_contracts_revision_fk",
			columns: [table.profileId, table.contractRevisionId],
			foreignColumns: [
				specializedProfileContractRevisions.profileId,
				specializedProfileContractRevisions.id,
			],
		}).onDelete("restrict"),
		check(
			"project_specialized_profile_contracts_profile_id_check",
			sql`${table.profileId} in (${sql.join(
				specializedProfileIds.map((profileId) => sql`${profileId}`),
				sql`, `
			)})`
		),
		index("project_specialized_profile_contracts_activated_by_idx").on(
			table.activatedByUserId
		),
	]
);
