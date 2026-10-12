import "varlock/auto-load";
import { SQL, spawn } from "bun";
import { readDatabaseHistory } from "./database-state";
import { selectDevelopmentTargets } from "./development-targets";
import { loadMigrations } from "./migration-files";
import { repositoryDirectory, sourceOptions } from "./migration-options";
import { assertMigrationHistory } from "./migration-policy";
import {
	findMissingMigrations,
	reconcileMigrationSources,
	runGit,
} from "./migration-reconciliation";
import { MigrationSafetyError } from "./migration-safety-error";

async function run() {
	const mode = process.argv[2] ?? "doctor";
	if (!["doctor", "sync", "generate"].includes(mode)) {
		throw new MigrationSafetyError("Choose doctor, sync or generate.");
	}
	const [target] = selectDevelopmentTargets(process.env);
	if (!target) {
		throw new MigrationSafetyError(
			"The shared development target is not configured."
		);
	}
	const database = new SQL(target.url, { max: 1, connectionTimeout: 10 });
	let applied: Awaited<ReturnType<typeof readDatabaseHistory>>;
	try {
		const connection = await database.reserve();
		try {
			await connection`BEGIN READ ONLY`;
			applied = await readDatabaseHistory(connection);
			await connection`ROLLBACK`;
		} finally {
			connection.release();
		}
	} finally {
		await database.close();
	}
	const local = loadMigrations(sourceOptions.migrationDirectory);
	if (mode === "generate") {
		assertMigrationHistory(
			local,
			applied.applied,
			applied.hasApplicationTables
		);
		const child = spawn(
			["bun", "run", "drizzle-kit", "generate", ...process.argv.slice(3)],
			{
				cwd: `${repositoryDirectory}/packages/db`,
				stdin: "inherit",
				stdout: "inherit",
				stderr: "inherit",
			}
		);
		process.exitCode = await child.exited;
		return;
	}
	if (mode === "sync" && !process.argv.includes("--check")) {
		await runGit(repositoryDirectory, ["fetch", "origin"]);
		await runGit(repositoryDirectory, [
			"fetch",
			"origin",
			"+refs/pull/*/head:refs/remotes/origin/pull/*",
		]);
	}
	const missing = await findMissingMigrations(
		repositoryDirectory,
		local,
		applied.applied
	);
	console.info(
		`${target.name}: shared database ${applied.applied.length} migrations; workspace ${local.length}. Read-only database inspection.`
	);
	for (const entry of missing) {
		console.info(
			`${entry.name}\n  hash: ${entry.hash}\n  source: ${entry.commit ?? "unresolved"} ${entry.subject ?? ""}\n  refs: ${entry.references?.join(", ") || "none"}`
		);
	}
	const pending = local.filter(
		(entry) =>
			!applied.applied.some(
				(row) => row.name === entry.name && row.hash === entry.hash
			)
	);
	for (const entry of pending) {
		console.info(
			`Workspace-only migration: ${entry.name}. Preserve it until applied status and ordering are reconciled.`
		);
	}
	if (mode === "sync" && !process.argv.includes("--check")) {
		await reconcileMigrationSources(repositoryDirectory, missing);
		const updated = loadMigrations(sourceOptions.migrationDirectory);
		assertMigrationHistory(
			updated,
			applied.applied,
			applied.hasApplicationTables
		);
		console.info(
			"Owning code, schema, SQL and snapshots reconciled together. Review the merge, then run bun run db:prepare. No database migration was applied by db:sync."
		);
	} else if (missing.length) {
		console.info(
			"Run bun run db:sync from a clean workspace to merge the verified owning commits. Unknown sources and real history conflicts remain blockers."
		);
	} else {
		console.info(
			"No missing applied migration identity/hash was found. Schema compatibility is checked by bun run db:runtime; delivery by bun run db:ready."
		);
	}
}
if (import.meta.main) {
	try {
		await run();
	} catch (error) {
		console.error(
			error instanceof MigrationSafetyError
				? error.message
				: "Migration diagnosis failed; inspect connection or configuration securely. No automatic database repair was attempted."
		);
		process.exitCode = 1;
	}
}
