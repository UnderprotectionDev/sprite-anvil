import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { importInboxEntries } from "./import-inbox";
import { project } from "./project";

export const sourceMetadataMappingProposals = pgTable(
	"source_metadata_mapping_proposals",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		sourceEntryId: text("source_entry_id")
			.notNull()
			.references(() => importInboxEntries.id, { onDelete: "restrict" }),
		proposal: jsonb("proposal").notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("source_metadata_mapping_proposals_source_created_at_idx").on(
			table.projectId,
			table.sourceEntryId,
			table.createdAt
		),
	]
);
