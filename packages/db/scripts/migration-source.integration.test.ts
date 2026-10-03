import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sourceOptions } from "./migration-options";
import {
	readValidatedSource,
	validateMigrationSource,
} from "./migration-source";

test.skipIf(process.env.DB_TEST_POSTGRES !== "true")(
	"the complete repository migration chain matches source schema plus pinned historical inventory",
	async () => {
		const directory = mkdtempSync(join(tmpdir(), "full-source-test-"));
		const options = {
			...sourceOptions,
			proofPath: join(directory, "proof.json"),
		};
		try {
			const source = await validateMigrationSource(options);
			expect(source.migrations.length).toBeGreaterThan(0);
			expect(source.prefixCatalogHashes).toHaveLength(
				source.migrations.length + 1
			);
			expect((await readValidatedSource(options)).fingerprint).toBe(
				source.fingerprint
			);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	},
	120_000
);
