import "varlock/auto-load";

import { runReadyDevelopment } from "./development-command";
import { developmentEnvironment } from "./development-environment";
import { selectDevelopmentTargets } from "./development-targets";
import { repositoryDirectory, sourceOptions } from "./migration-options";
import { MigrationSafetyError } from "./migration-safety-error";
import { readValidatedSource } from "./migration-source";

if (import.meta.main) {
	try {
		const mode = process.argv[2] ?? "all";
		if (mode !== "all" && mode !== "server") {
			throw new MigrationSafetyError(
				"Choose all or server for development startup."
			);
		}
		const source = await readValidatedSource(sourceOptions);
		const targets = selectDevelopmentTargets(process.env);
		const environment = developmentEnvironment(process.env);
		console.info(
			`Configured development URLs: API ${environment.VITE_SERVER_URL}; Web ${environment.CORS_ORIGIN}; Docs port ${environment.DOCS_PORT ?? "4000"}.`
		);
		const launch =
			mode === "all"
				? {
						cwd: repositoryDirectory,
						command: ["bun", "run", "turbo", "run", "dev", "--env-mode=loose"],
					}
				: {
						cwd: `${repositoryDirectory}/apps/server`,
						command: ["bun", "run", "--hot", "src/index.ts"],
					};
		process.exitCode = await runReadyDevelopment(source, targets, {
			...launch,
			env: environment,
		});
	} catch (error) {
		console.error(
			error instanceof MigrationSafetyError
				? error.message
				: "Development readiness failed; check the configured targets securely."
		);
		console.error(
			"Run/dev did not apply migrations or repair the database. Resolve the reason and run bun run db:prepare, then retry Run."
		);
		process.exitCode = 1;
	}
}
