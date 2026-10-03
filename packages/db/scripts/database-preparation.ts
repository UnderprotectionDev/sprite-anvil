import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQL } from "bun";
import {
	type Connection,
	catalogHash,
	readDatabaseHistory,
	readSchemaCatalog,
	verifyDatabaseLease,
} from "./database-state";
import type { DevelopmentTarget } from "./development-targets";
import { runDrizzle } from "./drizzle-command";
import { assertMigrationHistory } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";
import type { ValidatedSource } from "./migration-source";

interface DatabaseLease {
	assertHeld: () => Promise<void>;
	connection: Connection;
	release: () => Promise<void>;
}

async function acquireLease(
	target: DevelopmentTarget,
	shared: boolean
): Promise<DatabaseLease> {
	let closed = false;
	const database = new SQL(target.url, {
		max: 1,
		connectionTimeout: 10,
		idleTimeout: 0,
		onclose: () => {
			closed = true;
		},
	});
	let connection: Connection | undefined;
	try {
		connection = await database.reserve();
		const [lock] = shared
			? await connection`SELECT pg_try_advisory_lock_shared(187733697, 129934395) AS locked`
			: await connection`SELECT pg_try_advisory_lock(187733697, 129934395) AS locked`;
		if (!lock?.locked) {
			throw new MigrationSafetyError(
				shared
					? `${target.name}: migration preparation is running. Retry bun run db:ready when it finishes.`
					: `${target.name}: another migration runner or development API holds the database lock. Ask its owner to Stop that workspace; no processes were terminated.`
			);
		}
		const reserved = connection;
		const [identity] = await reserved`SELECT pg_backend_pid() AS pid`;
		const pid = Number(identity?.pid);
		return {
			connection: reserved,
			assertHeld: async () => {
				if (closed || !(await verifyDatabaseLease(reserved, pid, shared))) {
					throw new MigrationSafetyError(
						`${target.name}: the database coordination lease was lost.`
					);
				}
			},
			release: async () => {
				try {
					await reserved.release();
				} finally {
					await database.close({ timeout: 1 });
				}
			},
		};
	} catch (error) {
		await connection?.release();
		await database.close({ timeout: 1 });
		throw error instanceof MigrationSafetyError
			? error
			: new MigrationSafetyError(
					`${target.name}: database connection failed. Check the declared development target and credentials in a secure environment.`
				);
	}
}

async function inspectTarget(
	source: ValidatedSource,
	connection: Connection,
	ready: boolean
): Promise<number> {
	await connection`BEGIN READ ONLY`;
	try {
		const state = await readDatabaseHistory(connection);
		assertMigrationHistory(
			source.migrations,
			state.applied,
			state.hasApplicationTables
		);
		if (
			catalogHash(await readSchemaCatalog(connection)) !==
			source.prefixCatalogHashes[state.applied.length]
		) {
			throw new MigrationSafetyError(
				"The real database schema differs from its verified migration history. Inspect drift; preparation will not repair or db:push this target."
			);
		}
		const pending = source.migrations.length - state.applied.length;
		if (ready && pending > 0) {
			throw new MigrationSafetyError(
				`${pending} pending migration(s). Run bun run db:prepare before Run/dev.`
			);
		}
		return pending;
	} finally {
		await connection`ROLLBACK`;
	}
}

export type PreparationResult =
	| { name: string; status: "ready"; applied: number }
	| { name: string; status: "failed"; reason: string };

export async function prepareTargets(
	source: ValidatedSource,
	targets: DevelopmentTarget[]
): Promise<PreparationResult[]> {
	const results: PreparationResult[] = [];
	for (const target of targets) {
		let lease: DatabaseLease | undefined;
		const directory = mkdtempSync(
			join(tmpdir(), "sprite-anvil-drizzle-config-")
		);
		try {
			const migrationDirectory = join(directory, "migrations");
			cpSync(source.migrationDirectory, migrationDirectory, {
				recursive: true,
			});
			await source.assertUnchanged(migrationDirectory);
			lease = await acquireLease(target, false);
			const pending = await inspectTarget(source, lease.connection, false);
			if (pending > 0) {
				const configPath = join(directory, "drizzle.config.ts");
				writeFileSync(
					configPath,
					`export default { dialect: "postgresql", out: ${JSON.stringify(migrationDirectory)}, dbCredentials: { url: process.env.DATABASE_URL } };`
				);
				await runDrizzle("migrate", target.url, configPath, lease.assertHeld);
			}
			await lease.assertHeld();
			await inspectTarget(source, lease.connection, true);
			results.push({ name: target.name, status: "ready", applied: pending });
		} catch (error) {
			results.push({
				name: target.name,
				status: "failed",
				reason:
					error instanceof MigrationSafetyError
						? error.message
						: "Database preparation failed; inspect connectivity securely. The target may already have applied migrations; recheck history before retrying.",
			});
		} finally {
			try {
				await lease?.release();
			} catch {
				results[results.length - 1] = {
					name: target.name,
					status: "failed",
					reason:
						"The database lease could not be released cleanly. This target may already be migrated; recheck readiness before retrying.",
				};
			}
			rmSync(directory, { recursive: true, force: true });
		}
	}
	return results;
}

export async function withDevelopmentReadiness<Result>(
	source: ValidatedSource,
	targets: DevelopmentTarget[],
	action: (connections: Connection[]) => Result | Promise<Result>
): Promise<Result> {
	const leases: DatabaseLease[] = [];
	try {
		for (const target of targets) {
			const lease = await acquireLease(target, true);
			leases.push(lease);
			try {
				await inspectTarget(source, lease.connection, true);
			} catch (error) {
				throw error instanceof MigrationSafetyError
					? new MigrationSafetyError(`${target.name}: ${error.message}`)
					: error;
			}
		}
		await Promise.all(leases.map((lease) => lease.assertHeld()));
		return await action(leases.map((lease) => lease.connection));
	} finally {
		await Promise.allSettled(leases.map((lease) => lease.release()));
	}
}
