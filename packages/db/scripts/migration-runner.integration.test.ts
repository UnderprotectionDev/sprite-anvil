import { expect, test } from "bun:test";
import { join } from "node:path";
import { SQL, spawn } from "bun";

import { selectVerifiedDatabaseTarget } from "./migration-policy";

const databaseUrl = process.env.DATABASE_URL;
const isLocal = process.env.NEON_LOCAL === "true";
const isNeonTestBranch = Boolean(process.env.NEON_TEST_ENDPOINT_HOST);

test.skipIf(!(databaseUrl && (isLocal || isNeonTestBranch)))(
	"a second migration runner stops while the PostgreSQL lock is held",
	async () => {
		if (!databaseUrl) {
			throw new Error("DATABASE_URL is required for the lock test.");
		}
		const target = selectVerifiedDatabaseTarget(
			{ ...process.env, DB_MIGRATE_TARGET: isLocal ? "development" : "test" },
			"migrate"
		);
		const sql = new SQL(target, { max: 1 });
		const connection = await sql.reserve();
		try {
			const [lock] = await connection`
				SELECT pg_try_advisory_lock(187733697, 129934395) AS locked
			`;
			expect(lock?.locked).toBe(true);
			const child = spawn(["bun", "scripts/migration-runner.ts", "migrate"], {
				cwd: join(import.meta.dir, ".."),
				env: {
					...process.env,
					DATABASE_URL: databaseUrl,
					DB_MIGRATE_TARGET: isLocal ? "development" : "test",
				},
				stdout: "pipe",
				stderr: "pipe",
			});
			const [stdout, stderr, exitCode] = await Promise.all([
				new Response(child.stdout).text(),
				new Response(child.stderr).text(),
				child.exited,
			]);
			expect(exitCode).not.toBe(0);
			expect(`${stdout}${stderr}`).toContain(
				"Another migration runner holds the database lock."
			);
		} finally {
			await connection`SELECT pg_advisory_unlock(187733697, 129934395)`;
			connection.release();
			await sql.close();
		}
	}
);
