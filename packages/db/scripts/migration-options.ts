import { join } from "node:path";

import * as schema from "../src/schema";
import { databasePackageDirectory } from "./drizzle-command";
import type { SourceOptions } from "./migration-source";

export const repositoryDirectory = join(databasePackageDirectory, "..", "..");

export const sourceOptions: SourceOptions = {
	schema,
	migrationDirectory: join(databasePackageDirectory, "src", "migrations"),
	proofPath: join(repositoryDirectory, ".context", "db-source-validation.json"),
	historicalInventoryPath: join(
		import.meta.dir,
		"historical-schema-inventory.json"
	),
};
