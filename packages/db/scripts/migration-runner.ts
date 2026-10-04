import "varlock/auto-load";

import {
	prepareTargets,
	withDevelopmentCompatibility,
	withDevelopmentReadiness,
} from "./database-preparation";
import {
	selectDeploymentTarget,
	selectDevelopmentTargets,
} from "./development-targets";
import { runDrizzle } from "./drizzle-command";
import { sourceOptions } from "./migration-options";
import { selectVerifiedDatabaseTarget } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";
import {
	readValidatedSource,
	validateMigrationSource,
} from "./migration-source";

async function run(): Promise<void> {
	const [, , mode] = process.argv;
	if (mode === "push") {
		await runDrizzle("push", selectVerifiedDatabaseTarget(process.env, "push"));
		console.info(
			"Disposable local schema push completed. This does not prepare a shared database."
		);
		return;
	}
	if (mode === "ready" || mode === "runtime") {
		const source = await readValidatedSource(sourceOptions);
		const inspect =
			mode === "ready"
				? withDevelopmentReadiness
				: withDevelopmentCompatibility;
		await inspect(source, selectDevelopmentTargets(process.env), () => {
			console.info(
				mode === "ready"
					? `Development databases are ready: ${source.migrations.length} reviewed migrations and real schema verified. No migration was applied.`
					: "Development runtime compatibility verified. This does not establish delivery readiness; no migration was applied."
			);
		});
		return;
	}
	if (
		mode !== "prepare" &&
		mode !== "migrate" &&
		mode !== "deploy" &&
		mode !== "validate"
	) {
		throw new MigrationSafetyError(
			"Choose prepare, ready, runtime, validate, migrate, deploy, or push."
		);
	}
	const source = await validateMigrationSource(sourceOptions);
	console.info(
		`Source SQL, snapshots, schema and historical inventory verified in disposable PostgreSQL: ${source.migrations.length} migrations.`
	);
	if (mode === "validate") {
		return;
	}
	const targets =
		mode === "deploy"
			? [
					{
						name: "production",
						url: selectDeploymentTarget(process.env),
					},
				]
			: selectDevelopmentTargets(process.env);
	const results = await prepareTargets(source, targets);
	for (const result of results) {
		console.info(
			result.status === "ready"
				? `${result.name}: ready; applied ${result.applied} pending migration(s), then verified history and schema.`
				: `${result.name}: FAILED; ${result.reason}`
		);
	}
	if (results.some((result) => result.status === "failed")) {
		throw new MigrationSafetyError(
			"Preparation is incomplete. Targets are independent: successful migrations are not rolled back when another target fails. Recheck each target before retrying; ready delivery remains blocked. Independent implementation and DB-free tests can continue."
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
				: "Database verification failed; inspect connectivity or configuration securely. No automatic repair was attempted."
		);
		process.exitCode = 1;
	}
}
