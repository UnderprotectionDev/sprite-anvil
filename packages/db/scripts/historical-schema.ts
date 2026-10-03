import { readFileSync } from "node:fs";
import { z } from "zod";

import type { LocalMigration } from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

const inventorySchema = z
	.object({
		version: z.literal(1),
		reason: z.string().min(1),
		sourceMigrationHashes: z.record(
			z.string(),
			z.string().regex(/^[a-f0-9]{64}$/)
		),
		expectedOnly: z.array(z.string()),
		replayedOnly: z.array(z.string()),
	})
	.strict();

const compareEntries = (left: string, right: string) =>
	left.localeCompare(right);

export function assertSourceCatalogMatches(
	expected: string[],
	replayed: string[],
	migrations: LocalMigration[],
	inventoryPath?: string
): void {
	const expectedEntries = new Set(expected);
	const replayedEntries = new Set(replayed);
	const difference = {
		expectedOnly: expected
			.filter((entry) => !replayedEntries.has(entry))
			.sort(compareEntries),
		replayedOnly: replayed
			.filter((entry) => !expectedEntries.has(entry))
			.sort(compareEntries),
	};
	if (inventoryPath) {
		const inventory = inventorySchema.parse(
			JSON.parse(readFileSync(inventoryPath, "utf8"))
		);
		for (const [name, hash] of Object.entries(
			inventory.sourceMigrationHashes
		)) {
			if (
				migrations.find((migration) => migration.name === name)?.hash !== hash
			) {
				throw new MigrationSafetyError(
					`Historical schema inventory no longer matches applied source SQL at ${name}.`
				);
			}
		}
		if (
			JSON.stringify(difference.expectedOnly) ===
				JSON.stringify(inventory.expectedOnly.toSorted(compareEntries)) &&
			JSON.stringify(difference.replayedOnly) ===
				JSON.stringify(inventory.replayedOnly.toSorted(compareEntries))
		) {
			return;
		}
	} else if (
		difference.expectedOnly.length === 0 &&
		difference.replayedOnly.length === 0
	) {
		return;
	}
	throw new MigrationSafetyError(
		"Replayed migration SQL differs from the expected source schema and reviewed historical inventory. Reconcile unapplied SQL and snapshots; do not rewrite applied history.",
		{ cause: new Error(JSON.stringify(difference, null, 2)) }
	);
}
