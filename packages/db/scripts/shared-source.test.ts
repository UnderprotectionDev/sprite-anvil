import { expect, test } from "bun:test";
import { join } from "node:path";
import { sourceOptions } from "./migration-options";
import { validateMigrationSource } from "./migration-source";

test("source preparation validates snapshots without creating PostgreSQL or requiring a workspace proof", async () => {
	const source = await validateMigrationSource({
		...sourceOptions,
		proofPath: join(
			import.meta.dir,
			"../../../.context/nonexistent-proof.json"
		),
	});
	expect(source.verification).toBe("shared");
	expect(source.migrations.length).toBeGreaterThan(0);
	expect(typeof source.verifyCatalog).toBe("function");
});
