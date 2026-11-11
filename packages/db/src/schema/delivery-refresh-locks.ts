import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { exportBundles } from "./export-bundles";
import { project } from "./project";

/**
 * One Delivery Refresh Lock: the exact Export Bundle applied to one delivery
 * destination, with the profile revision it was built from. The row id is
 * derived from the client's idempotency key. It holds no absolute path and no
 * secret; the destination is a human label. Rows are inserted once, never updated.
 */
export const deliveryRefreshLocks = pgTable(
	"delivery_refresh_locks",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		bundleId: text("bundle_id").notNull(),
		profileId: text("profile_id").notNull(),
		profileRevisionId: text("profile_revision_id").notNull(),
		bundleManifestDigest: text("bundle_manifest_digest").notNull(),
		contractVersion: text("contract_version").notNull(),
		lockDigest: text("lock_digest").notNull(),
		requestDigest: text("request_digest").notNull(),
		destinationLabel: text("destination_label").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("delivery_refresh_locks_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		foreignKey({
			name: "delivery_refresh_locks_bundle_fk",
			columns: [table.projectId, table.bundleId],
			foreignColumns: [exportBundles.projectId, exportBundles.id],
		}).onDelete("cascade"),
	]
);

/** One path Sprite Anvil owns in the destination, with the digest it wrote. */
export const deliveryRefreshLockFiles = pgTable(
	"delivery_refresh_lock_files",
	{
		lockId: text("lock_id")
			.notNull()
			.references(() => deliveryRefreshLocks.id, { onDelete: "cascade" }),
		path: text("path").notNull(),
		sha256: text("sha256").notNull(),
		byteSize: integer("byte_size").notNull(),
	},
	(table) => [
		primaryKey({
			name: "delivery_refresh_lock_files_pk",
			columns: [table.lockId, table.path],
		}),
		check("delivery_refresh_lock_files_size_check", sql`${table.byteSize} > 0`),
	]
);
