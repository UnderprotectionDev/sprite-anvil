import { expect, test } from "bun:test";
import { neon } from "@neondatabase/serverless";
import { desc, eq, sql } from "drizzle-orm";

import { createDb } from "./index";
import { project } from "./schema/project";
import { toolAccessPermission } from "./schema/project-access";

test("the isolated Neon branch contains the migrated auth schema", async () => {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL must point to the CI test branch");
	}
	const neonSql = neon(databaseUrl);
	const rows = await neonSql`
		select table_name
		from information_schema.tables
		where table_schema = 'public' and table_name = 'user'
	`;
	expect(rows[0]?.table_name).toBe("user");
});

test("the Neon branch supports project creation and tool permission reads", async () => {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL must point to the CI test branch");
	}
	const db = createDb({ DATABASE_URL: databaseUrl });
	const projects = await db
		.select()
		.from(project)
		.where(eq(project.ownerUserId, `migration-probe-${crypto.randomUUID()}`))
		.orderBy(desc(project.createdAt));
	const permissions = await db
		.select()
		.from(toolAccessPermission)
		.where(eq(toolAccessPermission.projectId, crypto.randomUUID()));
	const projectInsertPlan = await db.execute(
		sql`
			EXPLAIN INSERT INTO "project" (
				"id", "owner_user_id", "name", "created_at", "updated_at"
			) VALUES (
				${crypto.randomUUID()}, ${crypto.randomUUID()}, 'migration-probe', DEFAULT, DEFAULT
			) RETURNING "id"
		`
	);

	expect(projects).toEqual([]);
	expect(permissions).toEqual([]);
	expect(projectInsertPlan.rows.length).toBeGreaterThan(0);
});
