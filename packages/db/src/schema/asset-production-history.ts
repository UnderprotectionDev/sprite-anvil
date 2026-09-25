import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { assetVersions } from "./asset-versions";
import { user } from "./auth";

export const legacyAssetAttestations = pgTable(
	"legacy_asset_attestations",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		versionId: text("version_id").notNull(),
		knownSource: text("known_source"),
		userRelationship: text("user_relationship")
			.$type<
				| "created_by_user"
				| "received_from_team"
				| "licensed_third_party"
				| "unknown"
			>()
			.notNull(),
		supportingEvidence: text("supporting_evidence"),
		historyUnknown: boolean("history_unknown").notNull(),
		attestedByUserId: text("attested_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "legacy_asset_attestations_version_fk",
			columns: [table.projectId, table.versionId],
			foreignColumns: [assetVersions.projectId, assetVersions.id],
		}).onDelete("restrict"),
		check(
			"legacy_asset_attestations_relationship_check",
			sql`${table.userRelationship} IN ('created_by_user', 'received_from_team', 'licensed_third_party', 'unknown')`
		),
		check(
			"legacy_asset_attestations_unknown_history_check",
			sql`${table.historyUnknown} = true`
		),
		index("legacy_asset_attestations_version_created_idx").on(
			table.versionId,
			table.createdAt
		),
	]
);
