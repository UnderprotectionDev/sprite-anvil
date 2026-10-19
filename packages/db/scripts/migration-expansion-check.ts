import { join } from "node:path";

import {
	assertExpansionOnly,
	checkMigrationExpansion,
	formatContractWarnings,
	formatExpansionFailure,
} from "./migration-expansion";
import { MigrationSafetyError } from "./migration-safety-error";

const migrationDirectory = join(import.meta.dir, "..", "src", "migrations");

// Reads migration files only; this check never connects to a database.
function run(): void {
	const afterIndex = process.argv.indexOf("--after");
	// `--after <name>` audits history as if the rule had started at <name>.
	const after = afterIndex === -1 ? undefined : process.argv[afterIndex + 1];
	if (afterIndex !== -1 && !after) {
		throw new MigrationSafetyError("Pass a migration name after --after.");
	}
	const result = after
		? checkMigrationExpansion(migrationDirectory, (name) => name > after)
		: assertExpansionOnly(migrationDirectory);
	for (const warning of formatContractWarnings(result)) {
		console.warn(warning);
	}
	if (result.violations.length > 0) {
		throw new MigrationSafetyError(formatExpansionFailure(result));
	}
	console.info(
		`Parallel-safety check passed: ${result.checked.length} migration(s) after the expansion baseline are expansion-only. No database was contacted.`
	);
}

if (import.meta.main) {
	try {
		run();
	} catch (error) {
		console.error(
			error instanceof MigrationSafetyError
				? error.message
				: "Migration parallel-safety check failed unexpectedly; inspect the migration files."
		);
		process.exitCode = 1;
	}
}
