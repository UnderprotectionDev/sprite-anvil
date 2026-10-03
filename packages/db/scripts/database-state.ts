import { createHash } from "node:crypto";
import type { SQL } from "bun";

import type { AppliedMigration } from "./migration-policy";

export type Connection = Awaited<ReturnType<SQL["reserve"]>>;

export async function verifyDatabaseLease(
	connection: Connection,
	pid: number,
	shared: boolean
): Promise<boolean> {
	const [identity] =
		await connection`SELECT pg_backend_pid() AS pid, EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND classid = 187733697 AND objid = 129934395 AND mode = ${shared ? "ShareLock" : "ExclusiveLock"} AND granted) AS held`;
	return Number(identity?.pid) === pid && identity?.held === true;
}

export async function readDatabaseHistory(
	connection: Connection
): Promise<{ applied: AppliedMigration[]; hasApplicationTables: boolean }> {
	const [migrationTable] =
		await connection`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present`;
	const [tables] = await connection`
		SELECT EXISTS (SELECT 1 FROM pg_class AS relation JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
			WHERE relation.relkind IN ('r', 'p') AND namespace.nspname NOT IN ('pg_catalog', 'information_schema', 'drizzle')
			AND namespace.nspname NOT LIKE 'pg_toast%' AND namespace.nspname NOT LIKE 'pg_temp%') AS present
	`;
	if (!migrationTable?.present) {
		return { applied: [], hasApplicationTables: Boolean(tables?.present) };
	}
	const [columns] =
		await connection`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations' AND column_name = 'name') AS has_name`;
	const rows = columns?.has_name
		? await connection`SELECT id, name, created_at, hash FROM drizzle.__drizzle_migrations ORDER BY id`
		: await connection`SELECT id, NULL::text AS name, created_at, hash FROM drizzle.__drizzle_migrations ORDER BY id`;
	return {
		hasApplicationTables: Boolean(tables?.present),
		applied: rows.map((row: Record<string, unknown>) => ({
			id: Number(row.id),
			name: row.name === null ? null : String(row.name),
			createdAt: Number(row.created_at),
			hash: String(row.hash),
		})),
	};
}

export async function readSchemaCatalog(
	connection: Connection
): Promise<string[]> {
	const rows = await connection`
		WITH namespaces AS (
			SELECT oid, nspname FROM pg_namespace WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'drizzle')
			AND nspname NOT LIKE 'pg_toast%' AND nspname NOT LIKE 'pg_temp%'
		), relations AS (
			SELECT relation.*, namespace.nspname FROM pg_class AS relation JOIN namespaces AS namespace ON namespace.oid = relation.relnamespace
		), objects AS (
			SELECT jsonb_build_array('relation', nspname, relname, relkind, relrowsecurity, relforcerowsecurity,
				CASE WHEN relkind IN ('v', 'm') THEN pg_get_viewdef(oid, false) ELSE NULL END) AS definition
			FROM relations WHERE relkind IN ('r', 'p', 'v', 'm')
			UNION ALL
			SELECT jsonb_build_array('column', relation.nspname, relation.relname, attribute.attname,
				format_type(attribute.atttypid, attribute.atttypmod), attribute.attnotnull, attribute.attidentity, attribute.attgenerated,
				pg_get_expr(default_value.adbin, default_value.adrelid), collation_record.collname)
			FROM relations AS relation JOIN pg_attribute AS attribute ON attribute.attrelid = relation.oid
			LEFT JOIN pg_attrdef AS default_value ON default_value.adrelid = relation.oid AND default_value.adnum = attribute.attnum
			LEFT JOIN pg_collation AS collation_record ON collation_record.oid = attribute.attcollation
			WHERE relation.relkind IN ('r', 'p', 'v', 'm') AND attribute.attnum > 0 AND NOT attribute.attisdropped
			UNION ALL
			SELECT jsonb_build_array('constraint', relation.nspname, relation.relname, constraint_record.conname,
				pg_get_constraintdef(constraint_record.oid, false), constraint_record.convalidated)
			FROM relations AS relation JOIN pg_constraint AS constraint_record ON constraint_record.conrelid = relation.oid
			WHERE constraint_record.contype <> 'n' OR NOT constraint_record.convalidated
			UNION ALL
			SELECT jsonb_build_array('index', relation.nspname, relation.relname, pg_get_indexdef(index_record.indexrelid), index_record.indisvalid, index_record.indisready)
			FROM relations AS relation JOIN pg_index AS index_record ON index_record.indrelid = relation.oid
			UNION ALL
			SELECT jsonb_build_array('enum', namespace.nspname, type_record.typname, array_agg(enum_record.enumlabel ORDER BY enum_record.enumsortorder))
			FROM pg_type AS type_record JOIN namespaces AS namespace ON namespace.oid = type_record.typnamespace
			JOIN pg_enum AS enum_record ON enum_record.enumtypid = type_record.oid GROUP BY namespace.nspname, type_record.typname
			UNION ALL
			SELECT jsonb_build_array('function', namespace.nspname, function_record.proname, pg_get_functiondef(function_record.oid))
			FROM pg_proc AS function_record JOIN namespaces AS namespace ON namespace.oid = function_record.pronamespace
			WHERE function_record.prokind IN ('f', 'p') AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = function_record.oid AND classid = 'pg_proc'::regclass AND deptype = 'e')
			UNION ALL
			SELECT jsonb_build_array('trigger', relation.nspname, relation.relname, trigger_record.tgname, pg_get_triggerdef(trigger_record.oid), trigger_record.tgenabled)
			FROM pg_trigger AS trigger_record JOIN relations AS relation ON relation.oid = trigger_record.tgrelid WHERE NOT trigger_record.tgisinternal
			UNION ALL
			SELECT jsonb_build_array('sequence', relation.nspname, relation.relname, sequence_record.seqstart::text, sequence_record.seqincrement::text,
				sequence_record.seqmin::text, sequence_record.seqmax::text, sequence_record.seqcache::text, sequence_record.seqcycle)
			FROM pg_sequence AS sequence_record JOIN relations AS relation ON relation.oid = sequence_record.seqrelid
			UNION ALL
			SELECT jsonb_build_array('policy', relation.nspname, relation.relname, policy.polname, policy.polcmd, policy.polpermissive,
				pg_get_expr(policy.polqual, policy.polrelid), pg_get_expr(policy.polwithcheck, policy.polrelid))
			FROM pg_policy AS policy JOIN relations AS relation ON relation.oid = policy.polrelid
		)
		SELECT definition::text FROM objects ORDER BY definition::text COLLATE "C"
	`;
	return rows.map((row: Record<string, unknown>) => String(row.definition));
}

export function catalogHash(catalog: string[]): string {
	return createHash("sha256").update(JSON.stringify(catalog)).digest("hex");
}
