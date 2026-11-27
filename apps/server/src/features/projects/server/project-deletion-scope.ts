import { compareCodeUnits } from "@sprite-anvil/api/compare-code-units";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import type { InteractiveTransaction } from "@sprite-anvil/db/interactive-database";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { projectDeletionTables } from "./project-deletion-tables";

type Reader = Pick<InteractiveTransaction, "execute">;
interface ScopeRow extends Record<string, unknown> {
	count: number;
	digest: string;
	kind: string;
}

export interface ProjectDeletionObjects {
	delete: (key: string) => Promise<void>;
	list: (prefix: string) => Promise<string[]>;
}

// Explicit child scopes that do not have a project_id column. Their rows are
// removed by the parent FK; they must still contribute to the approved digest.
const childScopes = [
	{ table: "export_bundle_files", parent: "export_bundles", key: "bundle_id" },
	{
		table: "delivery_refresh_lock_files",
		parent: "delivery_refresh_locks",
		key: "lock_id",
	},
	{
		table: "project_archive_files",
		parent: "project_archives",
		key: "archive_id",
	},
	{
		table: "project_archive_sections",
		parent: "project_archives",
		key: "archive_id",
	},
] as const;
const restoreChildren = [
	"project_archive_restore_ids",
	"project_archive_restore_sections",
	"project_archive_restore_files",
] as const;

function scopeCount(kind: string, from: SQL) {
	return sql`select ${kind}::text as kind,count(*)::int as count,encode(sha256(convert_to(coalesce(string_agg(row_digest,'' order by row_digest),''),'UTF8')),'hex') as digest from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') as row_digest ${from}) scope_rows`;
}
function projectRowScopes(projectId: string) {
	const scopes = [
		{ kind: "project", from: sql`from project t where t.id=${projectId}` },
	];
	for (const table of projectDeletionTables) {
		scopes.push({
			kind: table,
			from: sql`from ${sql.identifier(table)} t where t.project_id=${projectId}`,
		});
	}
	for (const child of childScopes) {
		scopes.push({
			kind: child.table,
			from: sql`from ${sql.identifier(child.table)} t join ${sql.identifier(child.parent)} p on p.id=t.${sql.identifier(child.key)} where p.project_id=${projectId}`,
		});
	}
	scopes.push({
		kind: "project_archive_restores",
		from: sql`from project_archive_restores t where t.restored_project_id=${projectId}`,
	});
	for (const table of restoreChildren) {
		scopes.push({
			kind: table,
			from: sql`from ${sql.identifier(table)} t join project_archive_restores p on p.id=t.restore_id where p.restored_project_id=${projectId}`,
		});
	}
	return scopes;
}
export async function readProjectRecordScope(db: Reader, projectId: string) {
	const statements = projectRowScopes(projectId).map((scope) =>
		scopeCount(scope.kind, scope.from)
	);
	const rows = await db.execute<ScopeRow>(
		sql.join(statements, sql` union all `)
	);
	const ordered = [...rows].sort((a, b) => compareCodeUnits(a.kind, b.kind));
	return {
		recordDigest: await recordContentDigest(ordered),
		records: ordered
			.filter((row) => row.count > 0)
			.map(({ kind, count }) => ({ kind, count })),
	};
}

// The inventory includes declared references and actual objects in the
// project's exclusive prefix. Legacy owner keys are never guessed by prefix.
const objectReferences = sql`
 select id as project_id, preview_key as object_key from project where preview_key is not null
 union all select project_id,object_key from asset_versions
 union all select project_id,object_key from reference_board_images
 union all select project_id,object_key from import_inbox_entries
 union all select project_id,object_key from managed_snapshots
 union all select project_id,object_key from runtime_validation_evidence where object_key is not null
 union all select project_id,evidence_file->>'objectKey' from rights_records where evidence_file->>'objectKey' is not null
 union all select a.project_id,f.source_object_key from project_archive_files f join project_archives a on a.id=f.archive_id where f.source_object_key is not null
 union all select r.restored_project_id,f.object_key from project_archive_restore_files f join project_archive_restores r on r.id=f.restore_id where f.object_key is not null
 union all select project_id,staged_object_key from project_archive_import_requests
 union all select project_id,object_key from managed_object_reservations
`;

export async function readProjectObjectScope(
	db: Reader,
	objects: ProjectDeletionObjects,
	ownerId: string,
	projectId: string
) {
	const prefix = `projects/${encodeURIComponent(projectId)}/`;
	const refs = await db.execute<{ object_key: string }>(
		sql`select distinct object_key from (${objectReferences}) refs where project_id=${projectId} and object_key is not null`
	);
	const keys = [
		...new Set([
			...refs.map((row) => row.object_key),
			...(await objects.list(prefix)),
		]),
	].sort(compareCodeUnits);
	const other = await db.execute<{ object_key: string }>(
		sql`select distinct object_key from (${objectReferences}) refs where project_id<>${projectId} and object_key in (select jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb))`
	);
	const shared = new Set(other.map((row) => row.object_key));
	const removable = keys.filter((key) => !shared.has(key));
	const safe = removable.every(
		(key) => key.startsWith(prefix) || key.startsWith(`users/${ownerId}/`)
	);
	return {
		objectKeys: removable,
		sharedKeys: [...shared].sort(compareCodeUnits),
		safe,
	};
}

export async function clearProjectRows(
	tx: InteractiveTransaction,
	projectId: string
) {
	for (const table of projectDeletionTables) {
		// biome-ignore lint/performance/noAwaitInLoops: Foreign-key child-before-parent ordering is required.
		await tx.execute(
			sql`delete from ${sql.identifier(table)} where project_id=${projectId}`
		);
	}
	// All indirectly scoped rows cascade. The independent deletion receipt has
	// deliberately no project FK and remains readable by its owner.
	await tx.execute(sql`delete from project where id=${projectId}`);
}

/** Lock scoped rows before hashing them, so previously-authorized writes
 * cannot enlarge or change the confirmed scope during storage removal. */
export async function lockProjectScopedRows(
	tx: InteractiveTransaction,
	projectId: string
) {
	const scopes = projectRowScopes(projectId).map(
		(scope) => sql`select 1 ${scope.from} for update of t`
	);
	const ctes = scopes.map(
		(query, index) => sql`${sql.identifier(`scope_${index}`)} as (${query})`
	);
	const counts = scopes.map(
		(_query, index) =>
			sql`select count(*) from ${sql.identifier(`scope_${index}`)}`
	);
	await tx.execute(
		sql`with ${sql.join(ctes, sql`,`)} ${sql.join(counts, sql` union all `)}`
	);
}
