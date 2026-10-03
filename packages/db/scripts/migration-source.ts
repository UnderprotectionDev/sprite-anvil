import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { SQL } from "bun";
import {
	generateDrizzleJson,
	generateMigration,
} from "drizzle-kit/api-postgres";
import { z } from "zod";

import {
	type Connection,
	catalogHash,
	readDatabaseHistory,
	readSchemaCatalog,
} from "./database-state";
import { withDisposablePostgres } from "./disposable-postgres";
import { runDrizzle } from "./drizzle-command";
import { assertSourceCatalogMatches } from "./historical-schema";
import { loadMigrations } from "./migration-files";
import {
	assertMigrationHistory,
	type LocalMigration,
} from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

export interface SourceOptions {
	historicalInventoryPath?: string;
	migrationDirectory: string;
	proofPath: string;
	schema: Record<string, unknown>;
}

const proofSchema = z.object({
	version: z.literal(1),
	fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
	prefixCatalogHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
});

export interface ValidatedSource {
	assertUnchanged: (directory?: string) => Promise<void>;
	fingerprint: string;
	migrationDirectory: string;
	migrations: LocalMigration[];
	prefixCatalogHashes: string[];
}

function validatedSource(
	options: SourceOptions,
	inspected: { migrations: LocalMigration[]; fingerprint: string },
	prefixCatalogHashes: string[]
): ValidatedSource {
	return {
		migrations: inspected.migrations,
		fingerprint: inspected.fingerprint,
		prefixCatalogHashes,
		migrationDirectory: options.migrationDirectory,
		assertUnchanged: async (directory = options.migrationDirectory) => {
			if (
				(await inspectSource({ ...options, migrationDirectory: directory }))
					.fingerprint !== inspected.fingerprint
			) {
				throw new MigrationSafetyError(
					"Migration source changed during preparation. Revalidate before applying; no automatic repair was attempted."
				);
			}
		},
	};
}

function sortedJson(value: unknown): string {
	return JSON.stringify(value, (_, entry: unknown) => {
		if (entry && typeof entry === "object" && !Array.isArray(entry)) {
			return Object.fromEntries(
				Object.entries(entry).sort(([left], [right]) =>
					left.localeCompare(right)
				)
			);
		}
		return entry;
	});
}

async function inspectSource(options: SourceOptions) {
	const migrations = loadMigrations(options.migrationDirectory);
	if (migrations.length === 0) {
		throw new MigrationSafetyError("Source migration history is empty.");
	}
	const generated = await generateDrizzleJson(options.schema);
	const latest = migrations.at(-1);
	const snapshot = JSON.parse(
		readFileSync(
			join(options.migrationDirectory, latest?.name ?? "", "snapshot.json"),
			"utf8"
		)
	) as { ddl: unknown[] };
	const normalize = (entries: unknown[]) =>
		entries.map(sortedJson).sort((left, right) => left.localeCompare(right));
	if (
		JSON.stringify(normalize(generated.ddl)) !==
		JSON.stringify(normalize(snapshot.ddl))
	) {
		throw new MigrationSafetyError(
			"The latest migration snapshot differs from the source schema. Generate and review the owning issue's migration with bun run db:generate."
		);
	}
	const hash = createHash("sha256")
		.update("source-validation/1")
		.update(sortedJson(generated.ddl));
	hash.update(readFileSync(join(import.meta.dir, "..", "package.json")));
	hash.update(
		readFileSync(join(import.meta.dir, "..", "..", "..", "bun.lock"))
	);
	if (options.historicalInventoryPath) {
		hash.update(readFileSync(options.historicalInventoryPath));
	}
	for (const verifier of [
		"migration-source.ts",
		"database-state.ts",
		"historical-schema.ts",
		"drizzle-command.ts",
		"migration-files.ts",
	]) {
		hash.update(readFileSync(join(import.meta.dir, verifier)));
	}
	for (const migration of migrations) {
		hash.update(migration.name).update(migration.hash);
		const snapshotPath = join(
			options.migrationDirectory,
			migration.name,
			"snapshot.json"
		);
		if (existsSync(snapshotPath)) {
			hash.update(readFileSync(snapshotPath));
		}
	}
	return { migrations, generated, fingerprint: hash.digest("hex") };
}

export async function readValidatedSource(
	options: SourceOptions
): Promise<ValidatedSource> {
	const inspected = await inspectSource(options);
	let proof: z.infer<typeof proofSchema>;
	try {
		proof = proofSchema.parse(
			JSON.parse(readFileSync(options.proofPath, "utf8"))
		);
	} catch (error) {
		throw new MigrationSafetyError(
			"Source SQL has not been validated in this workspace. Run bun run db:prepare (or bun run db:validate when the target is blocked).",
			{ cause: error }
		);
	}
	if (
		proof.fingerprint !== inspected.fingerprint ||
		proof.prefixCatalogHashes.length !== inspected.migrations.length + 1
	) {
		throw new MigrationSafetyError(
			"Source validation is stale. Run bun run db:prepare before Run/dev; Run does not apply migrations."
		);
	}
	return validatedSource(options, inspected, proof.prefixCatalogHashes);
}

async function replaySqlPrefixes(
	connection: Connection,
	migrations: LocalMigration[],
	directory: string
): Promise<string[]> {
	const hashes = [catalogHash(await readSchemaCatalog(connection))];
	for (const migration of migrations) {
		try {
			const statements = readFileSync(
				join(directory, migration.name, "migration.sql"),
				"utf8"
			).split("--> statement-breakpoint");
			for (const statement of statements) {
				if (statement.trim()) {
					await connection.unsafe(statement).simple();
				}
			}
		} catch (error) {
			throw new MigrationSafetyError(
				`Disposable SQL verification failed at ${migration.name}; preserve applied SQL.`,
				{ cause: error }
			);
		}
		hashes.push(catalogHash(await readSchemaCatalog(connection)));
	}
	return hashes;
}

export async function validateMigrationSource(
	options: SourceOptions
): Promise<ValidatedSource> {
	const inspected = await inspectSource(options);
	const prefixCatalogHashes = await withDisposablePostgres(
		async ({ url, directory }) => {
			const database = new SQL(url, { max: 1 });
			const connection = await database.reserve();
			try {
				const migrationDirectory = join(directory, "migrations");
				mkdirSync(migrationDirectory);
				const configPath = join(directory, "drizzle.config.ts");
				writeFileSync(
					configPath,
					`export default { dialect: "postgresql", out: ${JSON.stringify(migrationDirectory)}, dbCredentials: { url: process.env.DATABASE_URL } };`
				);
				let hashes: string[];
				for (const migration of inspected.migrations) {
					cpSync(
						join(options.migrationDirectory, migration.name),
						join(migrationDirectory, migration.name),
						{ recursive: true }
					);
				}
				try {
					await runDrizzle("migrate", url, configPath);
				} catch (error) {
					throw new MigrationSafetyError(
						"Canonical source migration replay failed. Preserve applied history; inspect SQL and snapshot merge lineage before preparation.",
						{ cause: error }
					);
				}
				const history = await readDatabaseHistory(connection);
				assertMigrationHistory(
					inspected.migrations,
					history.applied,
					history.hasApplicationTables
				);
				if (history.applied.length !== inspected.migrations.length) {
					throw new MigrationSafetyError(
						"Canonical source replay did not record the full migration history."
					);
				}
				await connection`CREATE DATABASE sql_replay`;
				const replayUrl = new URL(url);
				replayUrl.pathname = "/sql_replay";
				const replayDatabase = new SQL(replayUrl.toString(), { max: 1 });
				const replayConnection = await replayDatabase.reserve();
				try {
					hashes = await replaySqlPrefixes(
						replayConnection,
						inspected.migrations,
						migrationDirectory
					);
					if (
						catalogHash(await readSchemaCatalog(connection)) !== hashes.at(-1)
					) {
						throw new MigrationSafetyError(
							"Canonical replay and disposable SQL verification produced different schemas."
						);
					}
				} finally {
					replayConnection.release();
					await replayDatabase.close();
				}
				await connection`CREATE DATABASE schema_expected`;
				const expectedUrl = new URL(url);
				expectedUrl.pathname = "/schema_expected";
				const expectedDatabase = new SQL(expectedUrl.toString(), { max: 1 });
				const expectedConnection = await expectedDatabase.reserve();
				try {
					const statements = await generateMigration(
						{ ...inspected.generated, ddl: [] },
						inspected.generated
					);
					for (const statement of statements) {
						await expectedConnection.unsafe(statement);
					}
					const expectedCatalog = await readSchemaCatalog(expectedConnection);
					const replayedCatalog = await readSchemaCatalog(connection);
					assertSourceCatalogMatches(
						expectedCatalog,
						replayedCatalog,
						inspected.migrations,
						options.historicalInventoryPath
					);
				} finally {
					expectedConnection.release();
					await expectedDatabase.close();
				}
				return hashes;
			} finally {
				connection.release();
				await database.close();
			}
		}
	);
	const proof = {
		version: 1 as const,
		fingerprint: inspected.fingerprint,
		prefixCatalogHashes,
	};
	mkdirSync(dirname(options.proofPath), { recursive: true });
	const temporaryPath = `${options.proofPath}.${crypto.randomUUID()}.tmp`;
	writeFileSync(temporaryPath, JSON.stringify(proof, null, 2));
	renameSync(temporaryPath, options.proofPath);
	const source = validatedSource(options, inspected, prefixCatalogHashes);
	await source.assertUnchanged();
	return source;
}
