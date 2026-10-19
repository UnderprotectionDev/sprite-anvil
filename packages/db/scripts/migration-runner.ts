import "varlock/auto-load";

import {
	type PreparationResult,
	prepareTargets,
	validateSharedTargets,
	withDevelopmentCompatibility,
	withDevelopmentReadiness,
} from "./database-preparation";
import { describeForeignRecords } from "./development-history";
import {
	selectDeploymentTarget,
	selectDevelopmentTargets,
} from "./development-targets";
import { runDrizzle } from "./drizzle-command";
import {
	assertExpansionOnly,
	formatContractWarnings,
} from "./migration-expansion";
import { repositoryDirectory, sourceOptions } from "./migration-options";
import { selectVerifiedDatabaseTarget } from "./migration-policy";
import { assertPublishedMigrationSources } from "./migration-reconciliation";
import { MigrationSafetyError } from "./migration-safety-error";
import {
	readValidatedSource,
	validateMigrationSource,
} from "./migration-source";

async function inspectReadOnly(mode: "ready" | "runtime"): Promise<void> {
	console.info(
		mode === "runtime"
			? "Checking development runtime compatibility (read-only); no migrations will be applied."
			: "Checking development database readiness (read-only); no migrations will be applied."
	);
	const source = await readValidatedSource(sourceOptions);
	const inspect =
		mode === "ready" ? withDevelopmentReadiness : withDevelopmentCompatibility;
	await inspect(
		source,
		selectDevelopmentTargets(process.env),
		(_connections, histories) => {
			for (const history of histories) {
				console.info(
					`${history.name}: ${describeForeignRecords(history.foreign, history.rebased)}`
				);
			}
			console.info(
				mode === "ready"
					? `Development databases are ready: ${source.migrations.length} reviewed migrations and real schema verified. No migration was applied.`
					: "Development runtime compatibility verified. This does not establish delivery readiness; no migration was applied."
			);
		}
	);
}

function reportPreparation(
	results: PreparationResult[],
	mode: "deploy" | "development"
): void {
	for (const result of results) {
		if (result.status === "failed") {
			console.info(`${result.name}: FAILED; ${result.reason}`);
		} else if (mode === "deploy") {
			console.info(
				`${result.name}: ready; applied ${result.applied} pending migration(s) in exact order, then verified history and schema.`
			);
		} else {
			console.info(
				`${result.name}: ready; applied ${result.applied} pending migration(s) by SQL hash, then verified history and schema. ${describeForeignRecords(result.foreign, result.rebased)}`
			);
		}
	}
	if (results.some((result) => result.status === "failed")) {
		throw new MigrationSafetyError(
			"Preparation is incomplete. Targets are independent: successful migrations are not rolled back when another target fails. Recheck each target before retrying; ready delivery remains blocked. Independent implementation and DB-free tests can continue."
		);
	}
}

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
		await inspectReadOnly(mode);
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
	if (mode !== "deploy") {
		// Static and DB-free: no contracting migration reaches the shared database.
		const expansion = assertExpansionOnly(sourceOptions.migrationDirectory);
		for (const warning of formatContractWarnings(expansion)) {
			console.warn(warning);
		}
	}
	const source = await validateMigrationSource(sourceOptions);
	console.info(
		`Source migration identities and schema snapshot verified: ${source.migrations.length} migrations. No temporary PostgreSQL was created.`
	);
	if (mode === "validate") {
		const histories = await validateSharedTargets(
			source,
			selectDevelopmentTargets(process.env)
		);
		for (const history of histories) {
			console.info(
				`${history.name}: ${describeForeignRecords(history.foreign, history.rebased)}`
			);
		}
		console.info(
			"Shared database history inspected read-only. With other branches' records and pending migrations, the schema is verified against the source after the pending SQL is applied, inside the preparation transaction; otherwise it was compared with source and pending SQL now. No migration was applied."
		);
		return;
	}
	if (mode === "deploy") {
		const production = {
			name: "production",
			url: selectDeploymentTarget(process.env),
		};
		reportPreparation(
			await prepareTargets(source, [production], undefined, "deployment"),
			"deploy"
		);
		return;
	}
	reportPreparation(
		await prepareTargets(
			source,
			selectDevelopmentTargets(process.env),
			(pending) => assertPublishedMigrationSources(repositoryDirectory, pending)
		),
		"development"
	);
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
