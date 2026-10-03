import { spawn } from "bun";

import { withDevelopmentReadiness } from "./database-preparation";
import { verifyDatabaseLease } from "./database-state";
import type { DevelopmentTarget } from "./development-targets";
import { MigrationSafetyError } from "./migration-safety-error";
import type { ValidatedSource } from "./migration-source";

export async function runReadyDevelopment(
	source: ValidatedSource,
	targets: DevelopmentTarget[],
	launch: {
		command: string[];
		cwd: string;
		env: Record<string, string | undefined>;
	}
): Promise<number> {
	return await withDevelopmentReadiness(
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
				"Readiness verified; starting only this workspace's development processes."
			);
			const child = spawn(launch.command, {
				cwd: launch.cwd,
				env: launch.env,
				stdin: "inherit",
				stdout: "inherit",
				stderr: "inherit",
			});
			let lostLease = false;
			let check: Promise<void> | undefined;
			const keepLease = setInterval(() => {
				if (check) {
					return;
				}
				check = (async () => {
					try {
						for (const [index, connection] of connections.entries()) {
							if (
								!(await verifyDatabaseLease(
									connection,
									identities[index] ?? 0,
									true
								))
							) {
								throw new MigrationSafetyError(
									"The development database lease was lost."
								);
							}
						}
					} catch {
						lostLease = true;
						child.kill("SIGTERM");
					} finally {
						check = undefined;
					}
				})();
			}, 1000);
			const stop = () => child.kill("SIGTERM");
			process.on("SIGINT", stop);
			process.on("SIGTERM", stop);
			try {
				const exitCode = await child.exited;
				if (lostLease) {
					throw new MigrationSafetyError(
						"Database lease lost; this development process was stopped. Other workspaces were not terminated. Recheck bun run db:ready."
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
