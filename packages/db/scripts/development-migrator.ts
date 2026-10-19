import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Connection } from "./database-state";
import type { LocalMigration } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

/**
 * Applies pending development migrations in directory order, in one
 * transaction, on the connection that holds the exclusive migration lease.
 * `verify` inspects the migrated schema before COMMIT; a failure rolls back.
 * Drizzle's migrator identifies records by name, so a rebased migration would
 * run again; this loop relies on the hash classification done by the caller.
 * Production deployment keeps canonical Drizzle Kit.
 */
export async function applyDevelopmentMigrations(
	connection: Connection,
	directory: string,
	pending: readonly LocalMigration[],
	verify: () => Promise<void>
): Promise<void> {
	let current = "the migration history table";
	await connection`BEGIN`;
	try {
		await connection`CREATE SCHEMA IF NOT EXISTS drizzle`;
		await connection`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint, name text, applied_at timestamp with time zone DEFAULT now())`;
		const [columns] =
			await connection`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations' AND column_name = 'name') AS has_name`;
		if (!columns?.has_name) {
			throw new MigrationSafetyError(
				"The shared migration table predates named records; upgrade it with canonical Drizzle Kit before preparing development migrations."
			);
		}
		for (const migration of pending) {
			current = migration.name;
			const sql = readFileSync(
				join(directory, migration.name, "migration.sql")
			);
			if (createHash("sha256").update(sql).digest("hex") !== migration.hash) {
				throw new MigrationSafetyError(
					`Migration source changed during preparation at ${migration.name}. Revalidate before applying.`
				);
			}
			for (const statement of sql
				.toString("utf8")
				.split("--> statement-breakpoint")) {
				if (statement.trim()) {
					await connection.unsafe(statement).simple();
				}
			}
			await connection`INSERT INTO drizzle.__drizzle_migrations (hash, created_at, name) VALUES (${migration.hash}, ${migration.createdAt}, ${migration.name})`;
		}
		current = "the verification of the migrated schema";
		await verify();
		await connection`COMMIT`;
	} catch (error) {
		try {
			await connection`ROLLBACK`;
		} catch {
			// A broken connection already discarded the open transaction.
		}
		throw new MigrationSafetyError(
			error instanceof MigrationSafetyError
				? `${error.message} The migration transaction was rolled back and no pending migration was recorded.`
				: `Migration ${current} failed against the shared schema (${error instanceof Error ? error.message : "unknown database error"}); the transaction was rolled back and no pending migration was recorded. Inspect its SQL against changes from other branches.`,
			{ cause: error }
		);
	}
}
