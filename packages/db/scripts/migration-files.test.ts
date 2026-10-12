import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadMigrations, validateSnapshotLineage } from "./migration-files";

test("keeps the committed Drizzle migration chain readable", () => {
	const migrations = loadMigrations(
		join(import.meta.dir, "..", "src", "migrations")
	);
	expect(migrations.length).toBeGreaterThan(0);
	expect(migrations[0]?.name).toStartWith("20260923172332_");
});

test("merged review migrations follow the already applied background and VFX prefix", () => {
	const migrations = loadMigrations(
		join(import.meta.dir, "..", "src", "migrations")
	);
	const appliedBoundary = migrations.findIndex(
		(migration) =>
			migration.name === "20261011103808_background_vfx_snapshot_reconciliation"
	);
	expect(appliedBoundary).toBe(63);
	for (const hash of [
		"e2358b76e08f01a31c3b480f4f598f69b60e78cf50c2409a45e733e13a12fe17",
		"7fb371355c4100a45e40bba88b6ab33a75ab1838fa9cdc4c2bc0718a61a4662a",
		"d83ef7d667226fcb141ff89013330d7b8fb90f24cae414f7290ebd41c8598291",
	]) {
		// Pin the reviewed SQL bytes while allowing unapplied directory timestamps
		// to be reconciled behind the immutable shared prefix.
		expect(
			migrations.findIndex((migration) => migration.hash === hash)
		).toBeGreaterThan(appliedBoundary);
	}
});

test("rejects missing, duplicated and reordered snapshot parents", () => {
	expect(() =>
		validateSnapshotLineage([
			{ name: "first", snapshot: { id: "one", prevIds: ["missing"] } },
		])
	).toThrow();
	expect(() =>
		validateSnapshotLineage([
			{
				name: "first",
				snapshot: {
					id: "one",
					prevIds: ["00000000-0000-0000-0000-000000000000"],
				},
			},
			{ name: "second", snapshot: { id: "one", prevIds: ["one"] } },
		])
	).toThrow();
	expect(() =>
		validateSnapshotLineage([
			{ name: "first", snapshot: { id: "one", prevIds: ["two"] } },
			{ name: "second", snapshot: { id: "two", prevIds: ["one"] } },
		])
	).toThrow();
});

test("rejects a timestamp that normalizes to another calendar date", () => {
	const directory = mkdtempSync(join(tmpdir(), "sprite-anvil-migration-date-"));
	try {
		const migrationDirectory = join(directory, "20260230000000_invalid_date");
		mkdirSync(migrationDirectory);
		writeFileSync(join(migrationDirectory, "migration.sql"), "SELECT 1;");
		expect(() => loadMigrations(directory)).toThrow();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("a new migration cannot silently omit its snapshot", () => {
	const directory = mkdtempSync(
		join(tmpdir(), "sprite-anvil-missing-snapshot-")
	);
	try {
		const migrationDirectory = join(
			directory,
			"20261002000000_missing_snapshot"
		);
		mkdirSync(migrationDirectory);
		writeFileSync(join(migrationDirectory, "migration.sql"), "SELECT 1;");
		expect(() => loadMigrations(directory)).toThrow("snapshot");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
