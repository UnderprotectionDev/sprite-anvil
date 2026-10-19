import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pushSchema } from "drizzle-kit/api-postgres";
import { drizzle } from "drizzle-orm/pg-proxy";
import type { Connection } from "./database-state";
import { readSchemaCatalog } from "./database-state";
import type { LocalMigration } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";
import type { SourceOptions } from "./migration-source";
import { assertRuntimeCatalog } from "./runtime-compatibility";
import { assertSourceConstraints } from "./shared-constraints";
import {
	checkSharedSchemaDiff,
	projectRequiredCatalog,
	redefinedChecks,
	withoutCheckRedefinitions,
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

export interface CatalogContext {
	/** Production keeps its exact verification; no development redefinition handling. */
	deployment?: boolean;
	/** Other branches' migration records exist, so their additions are accepted. */
	foreign: boolean;
	/** This workspace's migrations without a shared record, in directory order. */
	pending: LocalMigration[];
}

// Enums whose shared values extend the source values: another branch added values.
function widenedEnums(snapshot: Snapshot, actual: string[]): Set<string> {
	const widened = new Set<string>();
	for (const entity of snapshot.ddl) {
		if (entity.entityType !== "enums") {
			continue;
		}
		const values = actual
			.map((entry) => JSON.parse(entry) as unknown[])
			.find(
				(object) =>
					object[0] === "enum" &&
					object[1] === entity.schema &&
					object[2] === entity.name
			)?.[3];
		if (
			Array.isArray(values) &&
			values.length > entity.values.length &&
			entity.values.every((value) => values.includes(value))
		) {
			widened.add(`${entity.schema}.${entity.name}`);
		}
	}
	return widened;
}

export async function verifySharedCatalog(
	connection: Connection,
	options: SourceOptions,
	snapshot: Snapshot,
	migrations: LocalMigration[],
	context: CatalogContext
): Promise<string[]> {
	const actual = await readSchemaCatalog(connection);
	const inventory = readHistoricalInventory(options);
	assertHistoricalInventory(inventory, migrations, actual);
	assertCatalogIntegrity(actual, inventory?.replayedOnly ?? []);
	const pendingStatements = context.pending.flatMap((migration) =>
		readFileSync(
			join(options.migrationDirectory, migration.name, "migration.sql"),
			"utf8"
		)
			.split("--> statement-breakpoint")
			.filter((statement) => statement.trim())
	);
	const existingChecks = new Set(
		actual
			.map((entry) => JSON.parse(entry) as unknown[])
			.filter(
				(object) =>
					object[0] === "constraint" && String(object[4]).startsWith("CHECK")
			)
			.map((object) => object.slice(1, 4).join("."))
	);
	// Pending SQL that redefines an existing CHECK is verified after it is
	// applied, inside the migration transaction.
	const redefined = context.deployment
		? new Set<string>()
		: redefinedChecks(pendingStatements, existingChecks);
	await assertSourceConstraints(
		connection,
		snapshot,
		context.foreign,
		redefined
	);
	const required = projectRequiredCatalog(
		snapshot.ddl,
		actual,
		inventory?.replayedOnly ?? []
	);
	if (context.foreign && context.pending.length > 0) {
		// Drizzle cannot diff beside other branches' additions while this branch
		// adds objects: it needs a rename-or-create hint. Preparation applies the
		// pending SQL in one transaction and verifies the result before COMMIT.
		return required;
	}
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
	const pending = context.deployment
		? pendingStatements
		: withoutCheckRedefinitions(pendingStatements, existingChecks);
	checkSharedSchemaDiff(
		diff.sqlStatements,
		pending,
		inventory?.introspectionStatements ?? [],
		required,
		actual,
		context.foreign,
		context.foreign ? widenedEnums(snapshot, actual) : new Set()
	);
	if (context.foreign) {
		assertRuntimeCatalog(required, actual);
	}
	return required;
}
