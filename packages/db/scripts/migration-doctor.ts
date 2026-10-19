import "varlock/auto-load";
import { SQL, spawn } from "bun";
import { readDatabaseHistory } from "./database-state";
import {
	classifyDevelopmentHistory,
	describeForeignRecords,
} from "./development-history";
import { selectDevelopmentTargets } from "./development-targets";
import {
	assertExpansionOnly,
	formatContractWarnings,
} from "./migration-expansion";
import { loadMigrations } from "./migration-files";
import { repositoryDirectory, sourceOptions } from "./migration-options";
import {
	findMissingMigrations,
	reconcileMigrationSources,
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
	// Records from other branches never block generation; changed applied SQL does.
	const history = classifyDevelopmentHistory(
		local,
		applied.applied,
		applied.hasApplicationTables
	);
	if (mode === "generate") {
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
		if (process.exitCode === 0) {
			const result = assertExpansionOnly(sourceOptions.migrationDirectory);
			for (const warning of formatContractWarnings(result)) {
				console.warn(warning);
			}
			console.info(
				"Generated migrations passed the parallel-safety check. Review the SQL and snapshot before bun run db:prepare."
			);
		}
		return;
	}
	const missing = await findMissingMigrations(
		repositoryDirectory,
		local,
		history.foreign,
		{ refresh: true }
	);
	console.info(
		`${target.name}: shared database ${applied.applied.length} migration record(s); workspace ${local.length}, ${history.pending.length} pending. ${describeForeignRecords(history.foreign.length, history.rebased.length)} Read-only database inspection.`
	);
	for (const entry of missing) {
		console.info(
			`${entry.name}\n  hash: ${entry.hash}\n  source: ${entry.commit ?? "unresolved after origin refresh"} ${entry.subject ?? ""}\n  refs: ${entry.references?.join(", ") || "none"}`
		);
	}
	for (const entry of history.pending) {
		console.info(
			`Pending workspace migration: ${entry.name}. bun run db:prepare applies it by SQL hash; records from other branches do not block it.`
		);
	}
	if (mode === "sync" && !process.argv.includes("--check")) {
		await reconcileMigrationSources(repositoryDirectory, missing);
		classifyDevelopmentHistory(
			loadMigrations(sourceOptions.migrationDirectory),
			applied.applied,
			applied.hasApplicationTables
		);
		console.info(
			"Owning code, schema, SQL and snapshots reconciled together. Review the merge, then run bun run db:prepare. No database migration was applied by db:sync."
		);
	} else if (missing.length) {
		console.info(
			"The records above belong to other branches and are accepted: generation, preparation and readiness continue. Origin main and PR heads were refreshed only to show their sources; bun run db:sync is optional when this workspace needs their code."
		);
	} else {
		console.info(
			"No records from other branches. Schema compatibility is checked by bun run db:runtime; delivery by bun run db:ready."
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
