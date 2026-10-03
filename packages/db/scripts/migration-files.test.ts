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
