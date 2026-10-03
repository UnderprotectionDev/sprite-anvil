import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { LocalMigration } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

const firstSnapshotParent = "00000000-0000-0000-0000-000000000000";
const migrationNamePattern = /^(\d{14})_[a-z0-9][a-z0-9_-]*$/;
const historicalSnapshotlessMigrations = new Set([
	"20260925080000_legacy_asset_schema_bridge",
	"20260925203212_asset_record_foreign_key_restore",
]);

interface Snapshot {
	id: string;
	prevIds: string[];
}

export function validateSnapshotLineage(
	entries: { name: string; snapshot?: Snapshot }[]
): void {
	const seen = new Set<string>([firstSnapshotParent]);
	for (const entry of entries) {
		if (!entry.snapshot) {
			continue;
		}
		if (
			!entry.snapshot.id ||
			seen.has(entry.snapshot.id) ||
			!Array.isArray(entry.snapshot.prevIds) ||
			entry.snapshot.prevIds.length === 0 ||
			entry.snapshot.prevIds.some((id) => !seen.has(id))
		) {
			throw new MigrationSafetyError(
				`Migration snapshot lineage is invalid at ${entry.name}.`
			);
		}
		seen.add(entry.snapshot.id);
	}
}

function readSnapshot(snapshotPath: string, name: string): Snapshot {
	try {
		const value = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot & {
			version: string;
			dialect: string;
			ddl: unknown[];
			renames: unknown[];
		};
		if (
			value.version !== "8" ||
			value.dialect !== "postgres" ||
			!Array.isArray(value.ddl) ||
			!Array.isArray(value.renames)
		) {
			throw new Error("Invalid current Drizzle snapshot format.");
		}
		return value;
	} catch (error) {
		throw new MigrationSafetyError(
			`Migration snapshot has an invalid Drizzle format in ${name}.`,
			{ cause: error }
		);
	}
}

export function loadMigrations(directory: string): LocalMigration[] {
	const entries = readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	const snapshots: { name: string; snapshot?: Snapshot }[] = [];
	const migrations: LocalMigration[] = [];
	for (const name of entries) {
		const sqlPath = join(directory, name, "migration.sql");
		if (!existsSync(sqlPath)) {
			throw new MigrationSafetyError(`Migration SQL is missing in ${name}.`);
		}
		const match = migrationNamePattern.exec(name);
		if (!match) {
			throw new MigrationSafetyError(
				`Migration directory name is invalid: ${name}.`
			);
		}
		const [, stamp] = match;
		if (!stamp) {
			throw new MigrationSafetyError(
				`Migration timestamp is missing: ${name}.`
			);
		}
		const createdAt = Date.UTC(
			Number(stamp.slice(0, 4)),
			Number(stamp.slice(4, 6)) - 1,
			Number(stamp.slice(6, 8)),
			Number(stamp.slice(8, 10)),
			Number(stamp.slice(10, 12)),
			Number(stamp.slice(12, 14))
		);
		const normalizedStamp = Number.isFinite(createdAt)
			? new Date(createdAt)
					.toISOString()
					.slice(0, 19)
					.replaceAll("-", "")
					.replaceAll(":", "")
					.replace("T", "")
			: "";
		if (normalizedStamp !== stamp) {
			throw new MigrationSafetyError(
				`Migration timestamp is invalid: ${name}.`
			);
		}
		const sql = readFileSync(sqlPath);
		if (!sql.toString("utf8").trim()) {
			throw new MigrationSafetyError(`Migration SQL is empty in ${name}.`);
		}
		const snapshotPath = join(directory, name, "snapshot.json");
		if (
			!(existsSync(snapshotPath) || historicalSnapshotlessMigrations.has(name))
		) {
			throw new MigrationSafetyError(
				`Migration snapshot is missing in ${name}; only the reviewed historical SQL-only repairs can omit it.`
			);
		}
		const snapshot = existsSync(snapshotPath)
			? readSnapshot(snapshotPath, name)
			: undefined;
		snapshots.push({
			name,
			snapshot,
		});
		migrations.push({
			name,
			createdAt,
			hash: createHash("sha256").update(sql).digest("hex"),
		});
	}
	validateSnapshotLineage(snapshots);
	return migrations;
}
