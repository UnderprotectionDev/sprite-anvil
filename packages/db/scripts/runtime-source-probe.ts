import { pathToFileURL } from "node:url";
import { MigrationSafetyError } from "./migration-safety-error";
import { readValidatedSource } from "./migration-source";

if (import.meta.main) {
	try {
		const [, , optionsModule, migrationDirectory] = process.argv;
		if (!optionsModule) {
			throw new MigrationSafetyError("Source options module is required.");
		}
		const { sourceOptions } = await import(pathToFileURL(optionsModule).href);
		const source = await readValidatedSource(
			migrationDirectory
				? { ...sourceOptions, migrationDirectory }
				: sourceOptions
		);
		console.log(JSON.stringify(source));
	} catch (error) {
		console.error(
			error instanceof MigrationSafetyError
				? error.message
				: "Fresh source inspection failed. Check schema imports and configuration; no database was changed."
		);
		process.exitCode = 1;
	}
}
