import { join } from "node:path";
import { spawn } from "bun";
import { MigrationSafetyError } from "./migration-safety-error";
import type { ValidatedSource } from "./migration-source";

// A new process reloads the entire import graph, including re-exported modules.
// A cache-busting URL on the root module alone would retain cached dependencies.
export async function readFreshRuntimeSource(
	optionsModule = join(import.meta.dir, "migration-options.ts"),
	migrationDirectory?: string
): Promise<ValidatedSource> {
	const child = spawn(
		[
			process.execPath,
			join(import.meta.dir, "runtime-source-probe.ts"),
			optionsModule,
			...(migrationDirectory ? [migrationDirectory] : []),
		],
		{
			stdout: "pipe",
			stderr: "pipe",
		}
	);
	const [output, reason, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (exitCode !== 0) {
		throw new MigrationSafetyError(
			reason.trim() || "Fresh source inspection failed."
		);
	}
	const source = JSON.parse(output) as Omit<ValidatedSource, "assertUnchanged">;
	return {
		...source,
		assertUnchanged: async (directory) => {
			if (
				(await readFreshRuntimeSource(optionsModule, directory)).fingerprint !==
				source.fingerprint
			) {
				throw new MigrationSafetyError(
					"Source changed during runtime inspection. Retry after validation."
				);
			}
		},
	};
}
