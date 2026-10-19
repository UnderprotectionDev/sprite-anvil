import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQL } from "bun";
import { describeConnectionFailure } from "./database-connection-error";
import {
	type Connection,
	catalogHash,
	readDatabaseHistory,
	readSchemaCatalog,
	verifyDatabaseLease,
} from "./database-state";
import {
	classifyDevelopmentHistory,
	type DevelopmentHistory,
} from "./development-history";
import { applyDevelopmentMigrations } from "./development-migrator";
import type { DevelopmentTarget } from "./development-targets";
import { runDrizzle } from "./drizzle-command";
import { assertMigrationHistory } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";
import type { ValidatedSource } from "./migration-source";
import { assertRuntimeCatalog } from "./runtime-compatibility";

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
			: new MigrationSafetyError(describeConnectionFailure(target.name, error));
	}
}

export type HistoryPolicy = "development" | "deployment";
type Inspection = "prepare" | "ready" | "runtime";

export interface TargetHistory {
	foreign: number;
	name: string;
	rebased: number;
}

function planHistory(
	source: ValidatedSource,
	state: Awaited<ReturnType<typeof readDatabaseHistory>>,
	policy: HistoryPolicy
): DevelopmentHistory {
	if (policy === "deployment") {
		// Production applies main in order: any extra or reordered record is an error.
		assertMigrationHistory(
			source.migrations,
			state.applied,
			state.hasApplicationTables
		);
		return {
			foreign: [],
			pending: source.migrations.slice(state.applied.length),
			rebased: [],
		};
	}
	return classifyDevelopmentHistory(
		source.migrations,
		state.applied,
		state.hasApplicationTables
	);
}

async function inspectTarget(
	source: ValidatedSource,
	connection: Connection,
	inspection: Inspection,
	policy: HistoryPolicy = "development"
): Promise<DevelopmentHistory> {
	await connection`BEGIN READ ONLY`;
	try {
		return await inspectWithinTransaction(
			source,
			connection,
			inspection,
			policy
		);
	} finally {
		await connection`ROLLBACK`;
	}
}

async function inspectWithinTransaction(
	source: ValidatedSource,
	connection: Connection,
	inspection: Inspection,
	policy: HistoryPolicy,
	uncommitted = false
): Promise<DevelopmentHistory> {
	const history = planHistory(
		source,
		await readDatabaseHistory(connection),
		policy
	);
	const [next] = history.pending;
	if (next && inspection === "runtime") {
		throw new MigrationSafetyError(
			`Pending migration ${next.name}. Run bun run db:prepare; records from other branches do not block it.`
		);
	}
	if (next && inspection === "ready") {
		throw new MigrationSafetyError(
			`${history.pending.length} pending migration(s). Run bun run db:prepare.`
		);
	}
	const foreign = history.foreign.length > 0;
	if (source.verification === "shared") {
		if (inspection !== "runtime" && source.verifyCatalog === undefined) {
			throw new MigrationSafetyError(
				"Shared schema verification is unavailable; run bun run db:doctor."
			);
		}
		await source.verifyCatalog?.(connection, {
			pending: history.pending,
			foreign,
			runtime: inspection === "runtime",
			deployment: policy === "deployment",
			uncommitted,
		});
		if (inspection === "runtime") {
			const catalog = await readSchemaCatalog(connection);
			assertRuntimeCatalog(source.catalog, catalog);
			if (!foreign && catalogHash(source.catalog) !== catalogHash(catalog)) {
				throw new MigrationSafetyError(
					"Shared schema contains untracked changes without another branch's migration record; run bun run db:doctor."
				);
			}
		}
		return history;
	}
	const catalog = await readSchemaCatalog(connection);
	if (foreign) {
		if (history.pending.length > 0) {
			throw new MigrationSafetyError(
				"A replay-verified source cannot prepare beside other branches' migration records; use shared verification with bun run db:prepare."
			);
		}
		assertRuntimeCatalog(source.catalog, catalog);
		return history;
	}
	const appliedCount = source.migrations.length - history.pending.length;
	if (
		history.pending.some(
			(migration, index) =>
				migration !== source.migrations[appliedCount + index]
		) ||
		catalogHash(catalog) !== source.prefixCatalogHashes[appliedCount]
	) {
		throw new MigrationSafetyError(
			"The real database schema differs from its verified migration history. Inspect drift; preparation will not repair or db:push this target."
		);
	}
	return history;
}

export type PreparationResult =
	| {
			name: string;
			status: "ready";
			applied: number;
			foreign: number;
			rebased: number;
	  }
	| { name: string; status: "failed"; reason: string };

export async function prepareTargets(
	source: ValidatedSource,
	targets: DevelopmentTarget[],
	beforeApply?: (
		pending: ValidatedSource["migrations"]
	) => void | Promise<void>,
	policy: HistoryPolicy = "development"
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
			const { pending } = await inspectTarget(
				source,
				lease.connection,
				"prepare",
				policy
			);
			if (pending.length > 0) {
				await beforeApply?.(pending);
				await source.assertUnchanged();
				await source.assertUnchanged(migrationDirectory);
				await lease.assertHeld();
				if (policy === "deployment") {
					const configPath = join(directory, "drizzle.config.ts");
					writeFileSync(
						configPath,
						`export default { dialect: "postgresql", out: ${JSON.stringify(migrationDirectory)}, dbCredentials: { url: process.env.DATABASE_URL } };`
					);
					await runDrizzle("migrate", target.url, configPath, lease.assertHeld);
				} else {
					const { connection } = lease;
					await applyDevelopmentMigrations(
						connection,
						migrationDirectory,
						pending,
						async () => {
							await inspectWithinTransaction(
								source,
								connection,
								"ready",
								policy,
								true
							);
						}
					);
				}
			}
			await lease.assertHeld();
			const verified = await inspectTarget(
				source,
				lease.connection,
				"ready",
				policy
			);
			results.push({
				name: target.name,
				status: "ready",
				applied: pending.length,
				foreign: verified.foreign.length,
				rebased: verified.rebased.length,
			});
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
	action: (
		connections: Connection[],
		histories: TargetHistory[]
	) => Result | Promise<Result>,
	compatible = false
): Promise<Result> {
	const leases: DatabaseLease[] = [];
	const histories: TargetHistory[] = [];
	try {
		for (const target of targets) {
			const lease = await acquireLease(target, true);
			leases.push(lease);
			try {
				const history = await inspectTarget(
					source,
					lease.connection,
					compatible ? "runtime" : "ready"
				);
				histories.push({
					name: target.name,
					foreign: history.foreign.length,
					rebased: history.rebased.length,
				});
			} catch (error) {
				const reason =
					error instanceof MigrationSafetyError
						? error.message
						: "History/schema inspection failed. Check database connectivity and catalog permissions securely.";
				throw new MigrationSafetyError(`${target.name}: ${reason}`, {
					cause: error,
				});
			}
		}
		await Promise.all(leases.map((lease) => lease.assertHeld()));
		return await action(
			leases.map((lease) => lease.connection),
			histories
		);
	} finally {
		await Promise.allSettled(leases.map((lease) => lease.release()));
	}
}

export async function inspectDevelopmentCompatibility(
	source: ValidatedSource,
	connection: Connection
): Promise<void> {
	await inspectTarget(source, connection, "runtime");
}

export async function withDevelopmentCompatibility<Result>(
	source: ValidatedSource,
	targets: DevelopmentTarget[],
	action: (
		connections: Connection[],
		histories: TargetHistory[]
	) => Result | Promise<Result>
): Promise<Result> {
	return await withDevelopmentReadiness(source, targets, action, true);
}

export async function validateSharedTargets(
	source: ValidatedSource,
	targets: DevelopmentTarget[]
): Promise<TargetHistory[]> {
	const histories: TargetHistory[] = [];
	for (const target of targets) {
		const lease = await acquireLease(target, true);
		try {
			const history = await inspectTarget(source, lease.connection, "prepare");
			histories.push({
				name: target.name,
				foreign: history.foreign.length,
				rebased: history.rebased.length,
			});
		} finally {
			await lease.release();
		}
	}
	return histories;
}
