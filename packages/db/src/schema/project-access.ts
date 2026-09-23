import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

export const toolAccessPrincipal = pgEnum("tool_access_principal", [
	"context_agent",
	"external_connection",
]);

export const toolAccessPermission = pgTable(
	"tool_access_permission",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		principal: toolAccessPrincipal("principal").notNull(),
		purpose: text("purpose").notNull(),
		scopes: text("scopes").array().notNull(),
		grantedByUserId: text("granted_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		revokedAt: timestamp("revoked_at"),
	},
	(table) => [
		index("tool_access_permission_project_idx").on(table.projectId),
		index("tool_access_permission_project_principal_idx").on(
			table.projectId,
			table.principal
		),
	]
);
