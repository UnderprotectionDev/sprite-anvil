import { join } from "node:path";
import { spawn } from "bun";

import { MigrationSafetyError } from "./migration-safety-error";

export const databasePackageDirectory = join(import.meta.dir, "..");

export async function runDrizzle(
	command: "migrate" | "push",
	target: string,
	configPath = "drizzle.config.ts",
	assertLease?: () => Promise<void>
): Promise<void> {
	await assertLease?.();
	const child = spawn(
		["bun", "run", "drizzle-kit", command, "--config", configPath],
		{
			cwd: databasePackageDirectory,
			env: {
				...process.env,
				DATABASE_URL: target,
				DATABASE_URL_UNPOOLED: target,
			},
			stdout: "pipe",
			stderr: "pipe",
		}
	);
	let lostLease = false;
	let check: Promise<void> | undefined;
	const heartbeat = assertLease
		? setInterval(() => {
				if (check) {
					return;
				}
				check = (async () => {
					try {
						await assertLease();
					} catch {
						lostLease = true;
						child.kill("SIGTERM");
					} finally {
						check = undefined;
					}
				})();
			}, 1000)
		: undefined;
	let result: [string, string, number];
	const stop = () => child.kill("SIGTERM");
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	try {
		result = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
	} finally {
		clearInterval(heartbeat);
		await check;
		process.off("SIGINT", stop);
		process.off("SIGTERM", stop);
	}
	if (lostLease) {
		throw new MigrationSafetyError(
			"The migration lease was lost and this runner was stopped. Recheck target history and schema before retrying; no other workspace was terminated."
		);
	}
	const [stdout, stderr, exitCode] = result;
	if (exitCode !== 0) {
		throw new MigrationSafetyError(
			"Drizzle Kit failed; inspect the target and reviewed migration SQL in a secure environment. No automatic repair was attempted.",
			{ cause: new Error(`${stderr}\n${stdout}`) }
		);
	}
}
