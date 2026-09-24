import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

export const externalVisualAnalysisCategory = pgEnum(
	"external_visual_analysis_category",
	["identity", "theme", "style"]
);

export const externalVisualAnalysisPermission = pgTable(
	"external_visual_analysis_permission",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		category: externalVisualAnalysisCategory("category").notNull(),
		purpose: text("purpose").notNull(),
		grantedByUserId: text("granted_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		revokedAt: timestamp("revoked_at"),
	},
	(table) => [
		index("external_visual_analysis_permission_project_idx").on(
			table.projectId
		),
		index("external_visual_analysis_permission_project_category_idx").on(
			table.projectId,
			table.category
		),
	]
);
