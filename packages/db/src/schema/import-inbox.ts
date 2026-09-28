import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { project } from "./project";

export const importInboxEntries = pgTable(
	"import_inbox_entries",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		fileName: text("file_name").notNull(),
		sourceContentType: text("source_content_type").notNull(),
		contentLength: bigint("content_length", { mode: "number" }).notNull(),
		sha256: text("sha256").notNull(),
		objectKey: text("object_key").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"import_inbox_entries_file_name_check",
			sql.raw('char_length("file_name") BETWEEN 1 AND 255')
		),
		check(
			"import_inbox_entries_source_content_type_check",
			sql.raw('char_length("source_content_type") BETWEEN 1 AND 127')
		),
		check(
			"import_inbox_entries_content_length_check",
			sql.raw('"content_length" >= 0')
		),
		check(
			"import_inbox_entries_sha256_check",
			sql.raw("\"sha256\" ~ '^[a-f0-9]{64}$'")
		),
		index("import_inbox_entries_project_created_at_idx").on(
			table.projectId,
			table.createdAt
		),
		uniqueIndex("import_inbox_entries_project_id_id_idx").on(
			table.projectId,
			table.id
		),
	]
);
