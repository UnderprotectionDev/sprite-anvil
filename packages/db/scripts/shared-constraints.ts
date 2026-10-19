import type { generateDrizzleJson } from "drizzle-kit/api-postgres";
import { isCheckWidening } from "./constraint-widening";
import type { Connection } from "./database-state";
import { MigrationSafetyError } from "./migration-safety-error";

type Snapshot = Awaited<ReturnType<typeof generateDrizzleJson>>;

const constraintTypes: Record<string, string> = {
	checks: "c",
	fks: "f",
	pks: "p",
	uniques: "u",
};
const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

// Drizzle's diff omits same-name CHECK edits and constraint timing flags.
// Verify those independently before projecting any actual catalog definitions.
// With other branches' records present, a CHECK they widened is accepted.
export async function assertSourceConstraints(
	connection: Connection,
	snapshot: Snapshot,
	foreign = false,
	redefined: Set<string> = new Set()
): Promise<void> {
	const rows = await connection`
		SELECT namespace.nspname AS schema, relation.relname AS table, constraint_record.conname AS name,
			constraint_record.contype AS type, constraint_record.condeferrable AS deferrable,
			constraint_record.condeferred AS deferred, constraint_record.connoinherit AS no_inherit,
			pg_get_expr(constraint_record.conbin, constraint_record.conrelid, false) AS expression
		FROM pg_constraint AS constraint_record
		JOIN pg_class AS relation ON relation.oid = constraint_record.conrelid
		JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
		WHERE namespace.nspname = 'public'
	`;
	for (const entity of snapshot.ddl) {
		if (
			!(
				entity.entityType === "checks" ||
				entity.entityType === "fks" ||
				entity.entityType === "pks" ||
				entity.entityType === "uniques"
			)
		) {
			continue;
		}
		const type = constraintTypes[entity.entityType];
		const actual = rows.find(
			(row: Record<string, unknown>) =>
				row.schema === entity.schema &&
				row.table === entity.table &&
				row.name === entity.name
		);
		// Missing constraints are handled by the source diff against pending SQL.
		if (!actual) {
			continue;
		}
		const identity = `${entity.schema}.${entity.table}.${entity.name}`;
		if (
			actual.type !== type ||
			actual.deferrable ||
			actual.deferred ||
			(entity.entityType === "checks" && actual.no_inherit)
		) {
			throw new MigrationSafetyError(
				`Required source constraint differs from the shared database: ${identity}. Run bun run db:doctor.`
			);
		}
		if (entity.entityType !== "checks" || redefined.has(identity)) {
			continue;
		}
		// PostgreSQL parses both expressions with the same column types and
		// deparses them canonically (including IN/ANY, casts and parentheses).
		// EXPLAIN without ANALYZE does not scan rows or evaluate row expressions.
		const plan = await connection.unsafe(
			`EXPLAIN (VERBOSE, FORMAT JSON, COSTS FALSE) SELECT (${entity.value}), (${actual.expression}) FROM ${quoteIdentifier(entity.schema)}.${quoteIdentifier(entity.table)}`
		);
		const output: unknown = plan[0]?.["QUERY PLAN"]?.[0]?.Plan?.Output;
		if (
			!(
				Array.isArray(output) &&
				output.length === 2 &&
				(output[0] === output[1] ||
					(foreign && isCheckWidening(String(output[0]), String(output[1]))))
			)
		) {
			throw new MigrationSafetyError(
				`Required source CHECK constraint differs from the shared database: ${identity}. Run bun run db:doctor.`
			);
		}
	}
}
