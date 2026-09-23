import { defineRelationsPart } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const project = pgTable(
	"project",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("project_owner_id_idx").on(table.ownerId)]
);

export const projectRelations = defineRelationsPart({ project, user }, (r) => ({
	project: {
		owner: r.one.user({ from: r.project.ownerId, to: r.user.id }),
	},
	user: {
		projects: r.many.project({ from: r.user.id, to: r.project.ownerId }),
	},
}));
