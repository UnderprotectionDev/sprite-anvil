import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { LocalMigration } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

const firstSnapshotParent = "00000000-0000-0000-0000-000000000000";
const migrationNamePattern = /^(\d{14})_[a-z0-9][a-z0-9_-]*$/;

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
		const snapshotPath = join(directory, name, "snapshot.json");
		snapshots.push({
			name,
			snapshot: existsSync(snapshotPath)
				? (JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot)
				: undefined,
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
