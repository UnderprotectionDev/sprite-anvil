import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const project = pgTable(
	"project",
	{
		id: text("id").primaryKey(),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		generalArtDirection: text("general_art_direction").notNull().default(""),
		previewKey: text("preview_key"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("project_ownerUserId_idx").on(table.ownerUserId)]
);
