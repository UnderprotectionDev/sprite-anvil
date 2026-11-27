import { expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { generateDrizzleJson } from "drizzle-kit/api-postgres";
import { pgTable, text } from "drizzle-orm/pg-core";

import { catalogHash } from "./database-state";
import { validateMigrationSource } from "./migration-source";
import { readFreshRuntimeSource } from "./runtime-source";

test.each([false, true])(
	"fresh runtime inspection inherits environment values and recovers from an interrupted probe (interrupt: %s)",
	async (interrupt) => {
		const directory = mkdtempSync(join(import.meta.dir, "runtime-fixture-"));
		const migrationDirectory = join(directory, "migrations");
		const proofPath = join(directory, "proof.json");
		const optionsModule = join(directory, "options.ts");
		const interruptedMarker = join(directory, "interrupted");
		const marker = crypto.randomUUID();
		const previous = process.env.RUNTIME_SOURCE_TEST_MARKER;
		process.env.RUNTIME_SOURCE_TEST_MARKER = marker;
		try {
			const schema = {
				records: pgTable("records", { id: text().primaryKey() }),
			};
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
				`import { existsSync, writeFileSync } from "node:fs";
import { pgTable, text } from "drizzle-orm/pg-core";
if (${JSON.stringify(interrupt)} && !existsSync(${JSON.stringify(interruptedMarker)})) {
 writeFileSync(${JSON.stringify(interruptedMarker)}, "interrupted");
 process.exit(137);
}
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
	}
);

test.each([
	{
		label: "silent repeated interruption",
		statement: "process.exit(137)",
		attempts: 3,
		error: "Fresh source inspection failed",
	},
	{
		label: "explicit source failure",
		statement: 'throw new Error("Invalid source")',
		attempts: 1,
		error: "Check schema imports and configuration",
	},
])(
	"fresh runtime inspection fails closed on $label",
	async ({ statement, attempts, error }) => {
		const directory = mkdtempSync(join(import.meta.dir, "runtime-fixture-"));
		const optionsModule = join(directory, "options.ts");
		const countPath = join(directory, "attempts");
		try {
			writeFileSync(
				optionsModule,
				`import { appendFileSync } from "node:fs";
appendFileSync(${JSON.stringify(countPath)}, "x");
${statement};`
			);
			await expect(readFreshRuntimeSource(optionsModule)).rejects.toThrow(
				error
			);
			expect(readFileSync(countPath, "utf8")).toHaveLength(attempts);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}
);
