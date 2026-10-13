import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { project } from "./project";
export const sceneQaPlaygrounds = pgTable(
	"scene_qa_playgrounds",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "restrict" }),
		record: jsonb("record").$type<Record<string, unknown>>().notNull(),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("scene_qa_playgrounds_project_idx").on(
			table.projectId,
			table.createdAt
		),
	]
);
