import { defineRelationsPart } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const project = pgTable(
	"project",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		generalArtDirection: text("general_art_direction").notNull().default(""),
		previewKey: text("preview_key"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("project_ownerUserId_idx").on(table.ownerUserId)]
);

export const projectRelations = defineRelationsPart({ project, user }, (r) => ({
	project: {
		owner: r.one.user({ from: r.project.ownerUserId, to: r.user.id }),
	},
	user: {
		projects: r.many.project({ from: r.user.id, to: r.project.ownerUserId }),
	},
}));
