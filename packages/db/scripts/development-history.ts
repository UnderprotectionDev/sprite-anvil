import {
	type AppliedMigration,
	assertLocalIdentities,
	hasTimestampedIdentity,
	type LocalMigration,
} from "./migration-policy";
import { MigrationSafetyError } from "./migration-safety-error";

const migrationHashPattern = /^[a-f0-9]{64}$/;

export interface DevelopmentHistory {
	/** Shared records whose SQL hash no workspace migration has: other branches own them. */
	foreign: AppliedMigration[];
	/** Workspace migrations without a shared record of the same SQL hash, in directory order. */
	pending: LocalMigration[];
	/** Workspace migrations applied under another name or timestamp before a rebase. */
	rebased: LocalMigration[];
}

/**
 * Identifies development migrations by SQL hash, not by position or date, so
 * parallel branches can share one database. Production keeps the exact
 * ordered prefix in `assertMigrationHistory`.
 */
export function classifyDevelopmentHistory(
	local: readonly LocalMigration[],
	applied: readonly AppliedMigration[],
	hasApplicationTables: boolean
): DevelopmentHistory {
	if (applied.length === 0 && hasApplicationTables) {
		throw new MigrationSafetyError(
			"Application tables exist without migration history; inspect and reconcile the database first."
		);
	}
	assertLocalIdentities(local);
	let previousId = 0;
	for (const row of applied) {
		if (!Number.isSafeInteger(row.id) || row.id <= previousId) {
			throw new MigrationSafetyError(
				`Invalid shared migration record identity at id ${row.id}; run bun run db:doctor. Records were not changed.`
			);
		}
		previousId = row.id;
	}
	const matches = new Map<LocalMigration, AppliedMigration>();
	const claimed = new Set<AppliedMigration>();
	const claim = (
		migration: LocalMigration,
		accepts: (row: AppliedMigration) => boolean
	) => {
		const row = applied.find(
			(candidate) =>
				!claimed.has(candidate) &&
				candidate.hash === migration.hash &&
				accepts(candidate)
		);
		if (row) {
			claimed.add(row);
			matches.set(migration, row);
		}
	};
	// Prefer the exact record so identical SQL in two migrations cannot swap identities.
	for (const migration of local) {
		claim(migration, (row) => row.name === migration.name);
	}
	for (const migration of local) {
		if (!matches.has(migration)) {
			claim(migration, () => true);
		}
	}
	const foreign = applied.filter((row) => !claimed.has(row));
	const pending = local.filter((migration) => !matches.has(migration));
	for (const migration of pending) {
		const changed = foreign.find(
			(row) =>
				row.name === migration.name || row.createdAt === migration.createdAt
		);
		if (changed) {
			throw new MigrationSafetyError(
				`Migration history differs for ${migration.name}: the shared record ${changed.name ?? "unnamed"} at the same name or timestamp has SQL hash ${changed.hash}, this workspace has ${migration.hash}. Applied SQL must not be edited or regenerated; restore its original bytes. Records were not changed.`
			);
		}
	}
	for (const row of foreign) {
		if (!(migrationHashPattern.test(row.hash) && hasTimestampedIdentity(row))) {
			throw new MigrationSafetyError(
				`Shared migration record ${row.name ?? "unnamed"} (id ${row.id}) has an invalid name, timestamp or hash identity; run bun run db:doctor. Records were not changed.`
			);
		}
	}
	const rebased = local.filter((migration) => {
		const row = matches.get(migration);
		return (
			row !== undefined &&
			((row.name !== null && row.name !== migration.name) ||
				row.createdAt !== migration.createdAt)
		);
	});
	return { foreign, pending, rebased };
}

export function describeForeignRecords(
	foreign: number,
	rebased: number
): string {
	const recognized =
		rebased > 0
			? ` ${rebased} workspace migration(s) were recognized by SQL hash after a rebase.`
			: "";
	return `${foreign} migration record(s) from other branches accepted.${recognized}`;
}
