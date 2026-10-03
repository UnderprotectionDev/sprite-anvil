import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertSourceCatalogMatches } from "./historical-schema";

test("historical inventory accepts only exact catalog differences and immutable SQL hashes", () => {
	const directory = mkdtempSync(join(tmpdir(), "historical-schema-test-"));
	const inventoryPath = join(directory, "inventory.json");
	const hash = "a".repeat(64);
	const migrations = [{ name: "historical", hash, createdAt: 1 }];
	writeFileSync(
		inventoryPath,
		JSON.stringify({
			version: 1,
			reason: "Preserve historical constraints",
			sourceMigrationHashes: { historical: hash },
			expectedOnly: ["validated"],
			replayedOnly: ["not-valid"],
		})
	);
	try {
		expect(() =>
			assertSourceCatalogMatches(
				["same", "validated"],
				["same", "not-valid"],
				migrations,
				inventoryPath
			)
		).not.toThrow();
		expect(() =>
			assertSourceCatalogMatches(
				["same", "validated"],
				["same", "not-valid", "extra"],
				migrations,
				inventoryPath
			)
		).toThrow("schema");
		expect(() =>
			assertSourceCatalogMatches(
				["same", "validated"],
				["same", "not-valid"],
				[{ name: "historical", hash: "b".repeat(64), createdAt: 1 }],
				inventoryPath
			)
		).toThrow("source SQL");
		expect(() =>
			assertSourceCatalogMatches(["same"], ["same", "extra"], migrations)
		).toThrow("schema");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
