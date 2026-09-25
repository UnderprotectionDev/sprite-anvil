import { sql } from "drizzle-orm";
import {
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

export const visualWorlds = pgTable(
	"visual_worlds",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("visual_worlds_project_id_id_idx").on(
			table.projectId,
			table.id
		),
		uniqueIndex("visual_worlds_project_name_idx").on(
			table.projectId,
			sql`lower(${table.name})`
		),
		index("visual_worlds_created_by_user_id_idx").on(table.createdByUserId),
	]
);

export const themes = pgTable(
	"themes",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		projectId: text("project_id").notNull(),
		visualWorldId: text("visual_world_id").notNull(),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("themes_project_visual_world_id_idx").on(
			table.projectId,
			table.visualWorldId,
			table.id
		),
		foreignKey({
			name: "themes_project_visual_world_fk",
			columns: [table.projectId, table.visualWorldId],
			foreignColumns: [visualWorlds.projectId, visualWorlds.id],
		}).onDelete("cascade"),
		uniqueIndex("themes_visual_world_name_idx").on(
			table.visualWorldId,
			sql`lower(${table.name})`
		),
		index("themes_created_by_user_id_idx").on(table.createdByUserId),
	]
);
