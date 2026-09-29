import { join } from "node:path";
import { SQL, spawn } from "bun";
import "varlock/auto-load";

import { loadMigrations } from "./migration-files";
import {
	type AppliedMigration,
	assertMigrationHistory,
	type LocalMigration,
	selectVerifiedDatabaseTarget,
} from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

const packageDirectory = join(import.meta.dir, "..");
const migrationDirectory = join(packageDirectory, "src", "migrations");

type Connection = Awaited<ReturnType<SQL["reserve"]>>;

async function readDatabaseHistory(connection: Connection): Promise<{
	applied: AppliedMigration[];
	hasApplicationTables: boolean;
}> {
	const [migrationTable] = await connection`
		SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present
	`;
	const [tables] = await connection`
		SELECT EXISTS (
			SELECT 1 FROM pg_class AS c
			JOIN pg_namespace AS n ON n.oid = c.relnamespace
			WHERE c.relkind IN ('r', 'p')
			AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'drizzle')
			AND n.nspname NOT LIKE 'pg_toast%'
		) AS present
	`;
	if (!migrationTable?.present) {
		return { applied: [], hasApplicationTables: Boolean(tables?.present) };
	}
	const [columns] = await connection`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'drizzle'
			AND table_name = '__drizzle_migrations'
			AND column_name = 'name'
		) AS has_name
	`;
	const rows = columns?.has_name
		? await connection`
			SELECT id, name, created_at, hash
			FROM drizzle.__drizzle_migrations ORDER BY id
		`
		: await connection`
			SELECT id, NULL::text AS name, created_at, hash
			FROM drizzle.__drizzle_migrations ORDER BY id
		`;
	return {
		hasApplicationTables: Boolean(tables?.present),
		applied: rows.map((row: Record<string, unknown>) => ({
			id: Number(row.id),
			name: row.name === null ? null : String(row.name),
			createdAt: Number(row.created_at),
			hash: String(row.hash),
		})),
	};
}

async function runDrizzle(command: "migrate" | "push", target: string) {
	const child = spawn(
		["bun", "run", "drizzle-kit", command, "--config", "drizzle.config.ts"],
		{
			cwd: packageDirectory,
			env: { ...process.env, DATABASE_URL: target },
			stdout: "pipe",
			stderr: "pipe",
		}
	);
	const [, , exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (exitCode !== 0) {
		// Drizzle errors can include a connection URL. Never surface its raw output.
		throw new MigrationSafetyError(
			"Drizzle Kit failed; inspect the target and migration files in a secure environment."
		);
	}
	console.info(
		command === "migrate"
			? "Migration application completed."
			: "Local schema push completed."
	);
}

async function run() {
	const [, , mode] = process.argv;
	if (mode !== "migrate" && mode !== "deploy" && mode !== "push") {
		throw new MigrationSafetyError("Choose migrate, deploy, or push.");
	}
	const target = selectVerifiedDatabaseTarget(process.env, mode);
	if (mode === "push") {
		await runDrizzle("push", target);
		return;
	}
	const local: LocalMigration[] = loadMigrations(migrationDirectory);
	const sql = new SQL(target, { max: 1 });
	try {
		const connection = await sql.reserve();
		let locked = false;
		try {
			const [result] = await connection`
				SELECT pg_try_advisory_lock(187733697, 129934395) AS locked
			`;
			locked = result?.locked === true;
			if (!locked) {
				throw new MigrationSafetyError(
					"Another migration runner holds the database lock."
				);
			}
			const before = await readDatabaseHistory(connection);
			assertMigrationHistory(
				local,
				before.applied,
				before.hasApplicationTables
			);
			await runDrizzle("migrate", target);
			const after = await readDatabaseHistory(connection);
			assertMigrationHistory(local, after.applied, after.hasApplicationTables);
			if (after.applied.length !== local.length) {
				throw new MigrationSafetyError(
					"Drizzle Kit did not record every local migration."
				);
			}
			console.info(`Verified ${after.applied.length} migration records.`);
		} finally {
			try {
				if (locked) {
					await connection`SELECT pg_advisory_unlock(187733697, 129934395)`;
				}
			} finally {
				connection.release();
			}
		}
	} finally {
		await sql.close();
	}
}

try {
	await run();
} catch (error) {
	// Query and driver errors may contain credentials. Only owned errors are safe.
	console.error(
		error instanceof MigrationSafetyError
			? error.message
			: "Migration runner failed; inspect database connectivity in a secure environment."
	);
	process.exitCode = 1;
}
