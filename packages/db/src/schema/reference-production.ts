import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { assetRecords } from "./asset-records";
import { user } from "./auth";

type ReferenceRole =
	| "identity"
	| "pose"
	| "style"
	| "palette"
	| "equipment"
	| "composition"
	| "theme"
	| "avoid"
	| "custom";

type ReferenceFeature =
	| "identity"
	| "pose"
	| "style"
	| "palette"
	| "equipment"
	| "composition"
	| "theme";

export const referenceBoardImages = pgTable(
	"reference_board_images",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		objectKey: text("object_key").notNull(),
		fileName: text("file_name").notNull(),
		contentType: text("content_type")
			.$type<"image/png" | "image/webp">()
			.notNull(),
		contentLength: integer("content_length").notNull(),
		sha256: text("sha256").notNull(),
		role: text("role").$type<ReferenceRole>().notNull(),
		customPurpose: text("custom_purpose"),
		transferredFeatures: text("transferred_features")
			.array()
			.$type<ReferenceFeature>()
			.notNull(),
		forbiddenFeatures: text("forbidden_features")
			.array()
			.$type<ReferenceFeature>()
			.notNull(),
		contextOverrideRationale: text("context_override_rationale"),
		notes: text("notes"),
		sortOrder: integer("sort_order").notNull().default(0),
		revision: integer("revision").notNull().default(1),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		foreignKey({
			name: "reference_board_images_record_fk",
			columns: [table.projectId, table.assetRecordId],
			foreignColumns: [assetRecords.projectId, assetRecords.id],
		}).onDelete("restrict"),
		uniqueIndex("reference_board_images_project_asset_id_idx").on(
			table.projectId,
			table.assetRecordId,
			table.id
		),
		index("reference_board_images_record_created_idx").on(
			table.projectId,
			table.assetRecordId,
			table.sortOrder,
			table.createdAt
		),
		check(
			"reference_board_images_role_check",
			sql`${table.role} IN ('identity', 'pose', 'style', 'palette', 'equipment', 'composition', 'theme', 'avoid', 'custom')`
		),
		check(
			"reference_board_images_custom_purpose_check",
			sql`(${table.role} = 'custom' AND ${table.customPurpose} IS NOT NULL AND length(trim(${table.customPurpose})) > 0) OR (${table.role} <> 'custom' AND ${table.customPurpose} IS NULL)`
		),
		check(
			"reference_board_images_features_nonempty_check",
			sql`cardinality(${table.transferredFeatures}) + cardinality(${table.forbiddenFeatures}) >= 1`
		),
		check("reference_board_images_revision_check", sql`${table.revision} > 0`),
		check(
			"reference_board_images_content_check",
			sql`${table.contentType} IN ('image/png', 'image/webp') AND ${table.contentLength} > 0 AND ${table.contentLength} <= 5242880 AND ${table.sha256} ~ '^[a-f0-9]{64}$'`
		),
		check(
			"reference_board_images_identity_override_check",
			sql`${table.contextOverrideRationale} IS NULL OR ('identity' = ANY(${table.transferredFeatures}) AND NOT ('identity' = ANY(${table.forbiddenFeatures})) AND length(trim(${table.contextOverrideRationale})) > 0)`
		),
	]
);

export const referenceBoardImageHistory = pgTable(
	"reference_board_image_history",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id").notNull(),
		assetRecordId: text("asset_record_id").notNull(),
		referenceId: text("reference_id").notNull(),
		revision: integer("revision").notNull(),
		role: text("role").$type<ReferenceRole>().notNull(),
		customPurpose: text("custom_purpose"),
		transferredFeatures: text("transferred_features")
			.array()
			.$type<ReferenceFeature>()
			.notNull(),
		forbiddenFeatures: text("forbidden_features")
			.array()
			.$type<ReferenceFeature>()
			.notNull(),
		contextOverrideRationale: text("context_override_rationale"),
		notes: text("notes"),
		recordedByUserId: text("recorded_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		recordedAt: timestamp("recorded_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			name: "reference_board_image_history_reference_fk",
			columns: [table.projectId, table.assetRecordId, table.referenceId],
			foreignColumns: [
				referenceBoardImages.projectId,
				referenceBoardImages.assetRecordId,
				referenceBoardImages.id,
			],
		}).onDelete("restrict"),
		uniqueIndex("reference_board_image_history_revision_idx").on(
			table.referenceId,
			table.revision
		),
		index("reference_board_image_history_recorded_idx").on(
			table.referenceId,
			table.recordedAt
		),
		check(
			"reference_board_image_history_custom_purpose_check",
			sql`(${table.role} = 'custom' AND ${table.customPurpose} IS NOT NULL AND length(trim(${table.customPurpose})) > 0) OR (${table.role} <> 'custom' AND ${table.customPurpose} IS NULL)`
		),
		check(
			"reference_board_image_history_role_check",
			sql`${table.role} IN ('identity', 'pose', 'style', 'palette', 'equipment', 'composition', 'theme', 'avoid', 'custom')`
		),
		check(
			"reference_board_image_history_revision_check",
			sql`${table.revision} > 0`
		),
		check(
			"reference_board_image_history_features_check",
			sql`cardinality(${table.transferredFeatures}) + cardinality(${table.forbiddenFeatures}) >= 1`
		),
		check(
			"reference_board_image_history_identity_override_check",
			sql`${table.contextOverrideRationale} IS NULL OR ('identity' = ANY(${table.transferredFeatures}) AND NOT ('identity' = ANY(${table.forbiddenFeatures})) AND length(trim(${table.contextOverrideRationale})) > 0)`
		),
	]
);
