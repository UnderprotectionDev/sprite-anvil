import { join } from "node:path";
import { sleep, spawn } from "bun";
import { MigrationSafetyError } from "./migration-safety-error";
import type { ValidatedSource } from "./migration-source";

const MAX_PROBE_ATTEMPTS = 3;
const PROBE_RETRY_DELAY_MS = 100;

async function runSourceProbe(
	optionsModule: string,
	migrationDirectory?: string
) {
	const child = spawn(
		[
			process.execPath,
			join(import.meta.dir, "runtime-source-probe.ts"),
			optionsModule,
			...(migrationDirectory ? [migrationDirectory] : []),
		],
		{
			env: { ...process.env },
			stdout: "pipe",
			stderr: "pipe",
		}
	);
	const [output, reason, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return { output, reason: reason.trim(), exitCode };
}

async function readProbeOutput(
	optionsModule: string,
	migrationDirectory?: string
) {
	for (let attempt = 1; attempt <= MAX_PROBE_ATTEMPTS; attempt += 1) {
		// Retry only after the previous process has exited.
		const { output, reason, exitCode } = await runSourceProbe(
			optionsModule,
			migrationDirectory
		);
		if (exitCode === 0) {
			return output;
		}
		// A reported schema/configuration failure is authoritative; do not retry it.
		if (reason) {
			throw new MigrationSafetyError(reason);
		}
		// An interrupted probe has no result. Retry boundedly, never accept cached source.
		if (attempt < MAX_PROBE_ATTEMPTS) {
			console.warn(
				`Fresh source inspection interrupted (exit ${exitCode}); retrying (${attempt}/${MAX_PROBE_ATTEMPTS - 1}).`
			);
			// Allow transient resource contention to settle before respawning.
			await sleep(PROBE_RETRY_DELAY_MS);
			continue;
		}
		throw new MigrationSafetyError(
			`Fresh source inspection failed after ${MAX_PROBE_ATTEMPTS} attempts (exit ${exitCode}).`
		);
	}
	throw new MigrationSafetyError("Fresh source inspection failed.");
}

// Each probe reloads the entire import graph, including re-exported modules.
// A cache-busting URL on the root module alone would retain cached dependencies.
export async function readFreshRuntimeSource(
	optionsModule = join(import.meta.dir, "migration-options.ts"),
	migrationDirectory?: string
): Promise<ValidatedSource> {
	const output = await readProbeOutput(optionsModule, migrationDirectory);
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
