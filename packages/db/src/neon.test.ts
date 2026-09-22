import { expect, test } from "bun:test";
import { neon } from "@neondatabase/serverless";

test("the isolated Neon branch contains the migrated auth schema", async () => {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL must point to the CI test branch");
	}
	const sql = neon(databaseUrl);
	const rows = await sql`select to_regclass('public.user') as table_name`;
	expect(rows[0]?.table_name).toBe("user");
});
