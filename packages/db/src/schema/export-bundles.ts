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
import { project } from "./project";

/**
 * One immutable Export Bundle. The row id is derived from the client's
 * idempotency key, so a repeated key finds the same row. The pinned profile
 * revision and context revision are recorded by id; the full manifest lives in
 * the bundle's `manifest.json` file row. Rows are inserted once, never updated.
 */
export const exportBundles = pgTable(
	"export_bundles",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		profileId: text("profile_id").notNull(),
		profileRevisionId: text("profile_revision_id").notNull(),
		contextRevisionId: text("context_revision_id").notNull(),
		/** Delivery Target revision the bundle fulfils; null for an ad hoc bundle. */
		deliveryTargetRevisionId: text("delivery_target_revision_id"),
		/** Verified Engine Adapter version; null while none applies. */
		adapterVersion: text("adapter_version"),
		contractVersion: text("contract_version").notNull(),
		manifestDigest: text("manifest_digest").notNull(),
		requestDigest: text("request_digest").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("export_bundles_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);

/** One file of a bundle directory. Generated text is kept in `content`; asset files are referenced by Asset Version. */
export const exportBundleFiles = pgTable(
	"export_bundle_files",
	{
		bundleId: text("bundle_id")
			.notNull()
			.references(() => exportBundles.id, { onDelete: "cascade" }),
		path: text("path").notNull(),
		sha256: text("sha256").notNull(),
		byteSize: integer("byte_size").notNull(),
		assetVersionId: text("asset_version_id"),
		content: text("content"),
	},
	(table) => [
		primaryKey({
			name: "export_bundle_files_pk",
			columns: [table.bundleId, table.path],
		}),
		check("export_bundle_files_size_check", sql`${table.byteSize} > 0`),
	]
);

/**
 * The movable latest-bundle marker. It is the only mutable row of the
 * feature and points at exactly one immutable bundle.
 */
export const exportBundleMarkers = pgTable(
	"export_bundle_markers",
	{
		projectId: text("project_id")
			.primaryKey()
			.references(() => project.id, { onDelete: "cascade" }),
		bundleId: text("bundle_id").notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "export_bundle_markers_bundle_fk",
			columns: [table.projectId, table.bundleId],
			foreignColumns: [exportBundles.projectId, exportBundles.id],
		}).onDelete("cascade"),
	]
);
