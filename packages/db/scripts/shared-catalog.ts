import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pushSchema } from "drizzle-kit/api-postgres";
import { drizzle } from "drizzle-orm/pg-proxy";
import type { Connection } from "./database-state";
import { readSchemaCatalog } from "./database-state";
import type { AppliedMigration, LocalMigration } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";
import type { SourceOptions } from "./migration-source";
import { assertRuntimeCatalog } from "./runtime-compatibility";
import { assertSourceConstraints } from "./shared-constraints";
import {
	checkSharedSchemaDiff,
	projectRequiredCatalog,
} from "./shared-schema-policy";

type Snapshot = Awaited<
	ReturnType<typeof import("drizzle-kit/api-postgres").generateDrizzleJson>
>;

interface HistoricalInventory {
	introspectionCatalog?: string[];
	introspectionStatements?: string[];
	replayedOnly: string[];
	sourceMigrationHashes: Record<string, string>;
}

function readHistoricalInventory(
	options: SourceOptions
): HistoricalInventory | undefined {
	return options.historicalInventoryPath
		? (JSON.parse(
				readFileSync(options.historicalInventoryPath, "utf8")
			) as HistoricalInventory)
		: undefined;
}

function assertHistoricalInventory(
	inventory: HistoricalInventory | undefined,
	migrations: LocalMigration[],
	actual: string[]
): void {
	for (const [name, hash] of Object.entries(
		inventory?.sourceMigrationHashes ?? {}
	)) {
		if (
			migrations.find((migration) => migration.name === name)?.hash !== hash
		) {
			throw new MigrationSafetyError(
				`Historical schema inventory SQL changed at ${name}; preserve applied history.`
			);
		}
	}
	for (const entry of [
		...(inventory?.replayedOnly ?? []),
		...(inventory?.introspectionCatalog ?? []),
	]) {
		if (!actual.includes(entry)) {
			throw new MigrationSafetyError(
				`Historical schema object changed or missing: ${(JSON.parse(entry) as unknown[]).slice(0, 4).join(".")}. Run bun run db:doctor.`
			);
		}
	}
}

function assertCatalogIntegrity(actual: string[], historical: string[]): void {
	for (const entry of actual) {
		const object = JSON.parse(entry) as unknown[];
		if (
			object[0] === "constraint" &&
			object[5] !== true &&
			!historical.includes(entry)
		) {
			throw new MigrationSafetyError(
				`Unvalidated shared constraint: ${object.slice(1, 4).join(".")}. Run bun run db:doctor.`
			);
		}
		if (object[0] === "index" && (object[4] !== true || object[5] !== true)) {
			throw new MigrationSafetyError(
				`Invalid shared index: ${object.slice(1, 3).join(".")}. Run bun run db:doctor.`
			);
		}
		if (object[0] === "relation" && object[5] === true) {
			throw new MigrationSafetyError(
				`Forced row security requires explicit source reconciliation: ${object.slice(1, 3).join(".")}.`
			);
		}
		if (
			object[0] === "column" &&
			object[9] !== null &&
			object[9] !== "default"
		) {
			throw new MigrationSafetyError(
				`Custom shared collation requires explicit source reconciliation: ${object.slice(1, 4).join(".")}.`
			);
		}
	}
}

export async function verifySharedCatalog(
	connection: Connection,
	options: SourceOptions,
	snapshot: Snapshot,
	migrations: LocalMigration[],
	applied: AppliedMigration[],
	compatible: boolean
): Promise<string[]> {
	const actual = await readSchemaCatalog(connection);
	const inventory = readHistoricalInventory(options);
	assertHistoricalInventory(inventory, migrations, actual);
	assertCatalogIntegrity(actual, inventory?.replayedOnly ?? []);
	await assertSourceConstraints(connection, snapshot);
	const required = projectRequiredCatalog(
		snapshot.ddl,
		actual,
		inventory?.replayedOnly ?? []
	);
	// pg-proxy normally returns rows directly. This API requires the node-postgres
	// result shape; expose that shape without changing the driver's row contents.
	const db = drizzle(async (query, params) => {
		const rows = await connection.unsafe(query, params);
		return { rows: Object.assign(rows, { rows }) };
	});
	const diff = await pushSchema(options.schema, db, {
		schemas: ["public"],
		tables: ["*"],
		entities: undefined,
		extensions: undefined,
	});
	const pending = compatible
		? []
		: migrations.slice(applied.length).flatMap((migration) =>
				readFileSync(
					join(options.migrationDirectory, migration.name, "migration.sql"),
					"utf8"
				)
					.split("--> statement-breakpoint")
					.filter((statement) => statement.trim())
			);
	checkSharedSchemaDiff(
		diff.sqlStatements,
		pending,
		inventory?.introspectionStatements ?? [],
		required,
		actual,
		compatible
	);
	if (compatible) {
		assertRuntimeCatalog(required, actual);
	}
	return required;
}
