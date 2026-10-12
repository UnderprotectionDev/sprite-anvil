import {
	type AppliedMigration,
	hasTimestampedIdentity,
	type LocalMigration,
} from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

const migrationHashPattern = /^[a-f0-9]{64}$/;

export function assertRuntimeHistory(
	local: readonly LocalMigration[],
	applied: readonly AppliedMigration[],
	hasApplicationTables: boolean
): void {
	if (applied.length === 0 && hasApplicationTables) {
		throw new MigrationSafetyError(
			"Application tables exist without migration history; run bun run db:doctor."
		);
	}
	const byName = new Map<string, AppliedMigration>();
	let previousId = 0;
	let previousTime = 0;
	for (const row of applied) {
		const known = local.find((item) => item.name === row.name);
		if (
			!Number.isSafeInteger(row.id) ||
			row.id <= previousId ||
			!row.name ||
			byName.has(row.name) ||
			row.createdAt <= previousTime ||
			!(
				known ||
				(hasTimestampedIdentity(row) && migrationHashPattern.test(row.hash))
			)
		) {
			throw new MigrationSafetyError(
				"Invalid or reordered shared migration identity; run bun run db:doctor. Applied records were not changed."
			);
		}
		byName.set(row.name, row);
		previousId = row.id;
		previousTime = row.createdAt;
	}
	let previousLocalPosition = -1;
	for (const migration of local) {
		const row = byName.get(migration.name);
		if (!row) {
			throw new MigrationSafetyError(
				`Pending migration ${migration.name}. Run bun run db:sync before db:prepare if other issues changed shared history.`
			);
		}
		if (row.hash !== migration.hash || row.createdAt !== migration.createdAt) {
			throw new MigrationSafetyError(
				`Migration history differs for ${migration.name}: SQL hash or timestamp changed. Run bun run db:doctor; preserve applied artifacts.`
			);
		}
		const position = applied.indexOf(row);
		if (position <= previousLocalPosition) {
			throw new MigrationSafetyError(
				`Local migration order differs at ${migration.name}; run bun run db:sync.`
			);
		}
		previousLocalPosition = position;
	}
}
