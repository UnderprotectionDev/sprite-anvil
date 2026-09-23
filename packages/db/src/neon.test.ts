import { expect, test } from "bun:test";
import { neon } from "@neondatabase/serverless";

test("the isolated Neon branch contains the auth and project schema", async () => {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL must point to the CI test branch");
	}
	const sql = neon(databaseUrl);
	const rows = await sql`
		select
			to_regclass('public.user') IS NOT NULL as has_user_table,
			to_regclass('public.project') IS NOT NULL as has_project_table
	`;
	expect(rows[0]?.has_user_table).toBe(true);
	expect(rows[0]?.has_project_table).toBe(true);
});
