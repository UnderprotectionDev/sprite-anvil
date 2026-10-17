import { spawn } from "bun";

import {
	inspectDevelopmentCompatibility,
	withDevelopmentCompatibility,
} from "./database-preparation";
import {
	type Connection,
	readSchemaFingerprint,
	verifyDatabaseLease,
} from "./database-state";
import type { DevelopmentTarget } from "./development-targets";
import { MigrationSafetyError } from "./migration-safety-error";
import type { ValidatedSource } from "./migration-source";
import { createInspectionGate } from "./runtime-inspection-gate";

// The lease check is a tiny query and runs every tick. The database digest
// runs at most this often unless the local source changed; a full catalog read
// happens only when the source or database digest differs from the last pass.
const DATABASE_DIGEST_INTERVAL_MS = 30_000;

async function verifyRuntimeTarget(
	source: ValidatedSource,
	connection: Connection,
	pid: number,
	name: string,
	verified: string | undefined,
	checkDatabase: boolean
): Promise<string | undefined> {
	try {
		if (!(await verifyDatabaseLease(connection, pid, true))) {
			throw new MigrationSafetyError(
				"The development database lease was lost."
			);
		}
		if (!checkDatabase) {
			return verified;
		}
		// Read the digest before inspecting so a concurrent change is seen next pass.
		const state = `${source.fingerprint}:${await readSchemaFingerprint(connection)}`;
		if (state !== verified) {
			await inspectDevelopmentCompatibility(source, connection);
		}
		return state;
	} catch (error) {
		const reason =
			error instanceof MigrationSafetyError
				? error.message
				: "Runtime compatibility could not be reverified; inspect connectivity securely.";
		throw new MigrationSafetyError(`${name}: ${reason}`, { cause: error });
	}
}

export async function runReadyDevelopment(
	source: ValidatedSource,
	targets: DevelopmentTarget[],
	launch: {
		command: string[];
		cwd: string;
		env: Record<string, string | undefined>;
		revalidateSource?: () => Promise<ValidatedSource>;
	}
): Promise<number> {
	return await withDevelopmentCompatibility(
		source,
		targets,
		async (connections) => {
			const identities = await Promise.all(
				connections.map(async (connection) => {
					const [identity] = await connection`SELECT pg_backend_pid() AS pid`;
					return Number(identity?.pid);
				})
			);
			console.info(
				"Runtime compatibility verified; starting only this workspace's development processes."
			);
			const child = spawn(launch.command, {
				cwd: launch.cwd,
				env: launch.env,
				stdin: "inherit",
				stdout: "inherit",
				stderr: "inherit",
			});
			let compatibilityFailed = false;
			let failureReason = "";
			let check: Promise<void> | undefined;
			const databaseDue = createInspectionGate(DATABASE_DIGEST_INTERVAL_MS);
			const verified: (string | undefined)[] = [];
			let verifiedSource = source.fingerprint;
			const verifyRuntime = async () => {
				const currentSource = launch.revalidateSource
					? await launch.revalidateSource()
					: source;
				if (!launch.revalidateSource) {
					await currentSource.assertUnchanged();
				}
				const checkDatabase =
					currentSource.fingerprint !== verifiedSource || databaseDue();
				for (const [index, connection] of connections.entries()) {
					verified[index] = await verifyRuntimeTarget(
						currentSource,
						connection,
						identities[index] ?? 0,
						targets[index]?.name ?? "development",
						verified[index],
						checkDatabase
					);
				}
				verifiedSource = currentSource.fingerprint;
			};
			const keepLease = setInterval(() => {
				if (check) {
					return;
				}
				check = verifyRuntime()
					.catch((error: unknown) => {
						failureReason =
							error instanceof MigrationSafetyError
								? error.message
								: "Runtime source inspection failed.";
						compatibilityFailed = true;
						child.kill("SIGTERM");
					})
					.finally(() => {
						check = undefined;
					});
			}, 1000);
			const stop = () => child.kill("SIGTERM");
			process.on("SIGINT", stop);
			process.on("SIGTERM", stop);
			try {
				const exitCode = await child.exited;
				clearInterval(keepLease);
				await check;
				if (compatibilityFailed) {
					throw new MigrationSafetyError(
						`Database lease lost or runtime compatibility failed; this development process was stopped. ${failureReason} Other workspaces were not terminated; independent implementation and DB-free tests can continue.`
					);
				}
				return exitCode;
			} finally {
				clearInterval(keepLease);
				await check;
				process.off("SIGINT", stop);
				process.off("SIGTERM", stop);
			}
		}
	);
}
