import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateDrizzleJson } from "drizzle-kit/api-postgres";
import { pgTable, text } from "drizzle-orm/pg-core";

import { catalogHash } from "./database-state";
import { validateMigrationSource } from "./migration-source";
import { readFreshRuntimeSource } from "./runtime-source";

test("fresh runtime inspection inherits environment values loaded after process startup", async () => {
	const directory = mkdtempSync(join(import.meta.dir, "runtime-fixture-"));
	const migrationDirectory = join(directory, "migrations");
	const proofPath = join(directory, "proof.json");
	const optionsModule = join(directory, "options.ts");
	const marker = crypto.randomUUID();
	const previous = process.env.RUNTIME_SOURCE_TEST_MARKER;
	process.env.RUNTIME_SOURCE_TEST_MARKER = marker;
	try {
		const schema = { records: pgTable("records", { id: text().primaryKey() }) };
		const migrationPath = join(migrationDirectory, "20261002000001_records");
		mkdirSync(migrationPath, { recursive: true });
		writeFileSync(
			join(migrationPath, "migration.sql"),
			'CREATE TABLE "records" ("id" text PRIMARY KEY);'
		);
		writeFileSync(
			join(migrationPath, "snapshot.json"),
			JSON.stringify(await generateDrizzleJson(schema))
		);
		const source = await validateMigrationSource({
			schema,
			migrationDirectory,
			proofPath,
		});
		// A cached fixture receipt keeps this process-boundary test DB-free.
		writeFileSync(
			proofPath,
			JSON.stringify({
				version: 3,
				fingerprint: source.fingerprint,
				catalog: [],
				catalogHash: catalogHash([]),
			})
		);
		writeFileSync(
			optionsModule,
			`import { pgTable, text } from "drizzle-orm/pg-core";
if (process.env.RUNTIME_SOURCE_TEST_MARKER !== ${JSON.stringify(marker)}) {
 throw new Error("Runtime source environment was not inherited.");
}
export const sourceOptions = {
 schema: { records: pgTable("records", { id: text().primaryKey() }) },
 migrationDirectory: ${JSON.stringify(migrationDirectory)},
 proofPath: ${JSON.stringify(proofPath)}
};`
		);
		const inspected = await readFreshRuntimeSource(optionsModule);
		expect(inspected.fingerprint).toBe(source.fingerprint);
		expect(inspected.verification).toBe("shared");
		await inspected.assertUnchanged();
	} finally {
		if (previous === undefined) {
			delete process.env.RUNTIME_SOURCE_TEST_MARKER;
		} else {
			process.env.RUNTIME_SOURCE_TEST_MARKER = previous;
		}
		rmSync(directory, { recursive: true, force: true });
	}
});
