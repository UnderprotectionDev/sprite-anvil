import type {
	AssetVersionReviewEvent,
	assetVersionReviewDispositionSchema,
	CompositeVersionReviewEvent,
} from "@sprite-anvil/api/asset-versions";
import {
	assetVersionReviewEventSchema,
	compositeVersionReviewEventSchema,
} from "@sprite-anvil/api/asset-versions";
import {
	IdempotencyConflictError,
	RecordIntegrityError,
	resolveRecordId,
	withdrawAndFail,
} from "@sprite-anvil/api/record-publication";
import type { Database } from "@sprite-anvil/db";
import {
	assetVersionReviewEvents,
	compositeVersionReviewEvents,
} from "@sprite-anvil/db/schema/asset-versions";
import type { SQL } from "drizzle-orm";
import { and, eq, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { z } from "zod";

type ReviewDecision = z.infer<typeof assetVersionReviewDispositionSchema>;

interface PublicationBase {
	assetRecordId: string;
	decision: ReviewDecision;
	/** Latest Review Event id the caller based its checks on; null when none. */
	expectedLatestEventId: string | null;
	/** Same key + same content returns the first record; no column holds it, so it derives the id. */
	idempotencyKey?: string;
	projectId: string;
	rationale: string;
	userId: string;
}

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

/** What differs between Asset Version and Composite Version Review Events: table, target column, copy. */
interface EventKind<Event> {
	/** Stored column name of the target, interpolated only from these constants. */
	column: string;
	label: string;
	scope: string;
	table: typeof assetVersionReviewEvents | typeof compositeVersionReviewEvents;
	tableName: string;
	targetOf: (row: EventRow) => string;
	toEvent: (row: EventRow) => Event;
}

type EventRow = typeof assetVersionReviewEvents.$inferSelect &
	Partial<typeof compositeVersionReviewEvents.$inferSelect>;

const assetKind: EventKind<AssetVersionReviewEvent> = {
	column: "version_id",
	label: "Review Event",
	scope: "asset-version-review-event",
	table: assetVersionReviewEvents,
	tableName: "asset_version_review_events",
	targetOf: (row) => row.versionId,
	toEvent: (row) =>
		assetVersionReviewEventSchema.parse({
			id: row.id,
			assetVersionId: row.versionId,
			type: row.decision,
			rationale: row.rationale,
			createdAt: toISOString(row.createdAt),
		}),
};

const compositeKind: EventKind<CompositeVersionReviewEvent> = {
	column: "composite_version_id",
	label: "Composite Version Review Event",
	scope: "composite-version-review-event",
	table: compositeVersionReviewEvents,
	tableName: "composite_version_review_events",
	targetOf: (row) => row.compositeVersionId as string,
	toEvent: (row) =>
		compositeVersionReviewEventSchema.parse({
			id: row.id,
			compositeVersionId: row.compositeVersionId,
			type: row.decision,
			rationale: row.rationale,
			createdAt: toISOString(row.createdAt),
		}),
};

type Input = PublicationBase & { targetId: string };

/**
 * Writes one Review Event with a single guarded INSERT inside a Serializable
 * transaction. The row is written only when the latest event is still the one
 * the caller checked, so a race or replay cannot add a second event. Returns
 * the id of the written event, or null when the guard or a serialization
 * conflict rejected the write.
 */
async function insertGuarded(db: Database, statement: SQL) {
	const query = new PgDialect().sqlToQuery(statement);
	try {
		const [result] = await db.$client.transaction(
			[db.$client.query(query.sql, query.params)],
			{ isolationLevel: "Serializable", fullResults: true }
		);
		return (result?.rows[0] as { id: string } | undefined)?.id ?? null;
	} catch (error) {
		if (
			error instanceof Error &&
			"code" in error &&
			(error.code === "40001" || error.code === "23505")
		) {
			return null;
		}
		throw error;
	}
}

/** Keyed ids are scoped to record kind, project, member and target, so another member's key never collides. */
function eventId(kind: EventKind<unknown>, input: Input) {
	return resolveRecordId(
		[kind.scope, input.projectId, input.userId, input.targetId],
		input.idempotencyKey
	);
}

async function readEvent(
	db: Database,
	kind: EventKind<unknown>,
	projectId: string,
	id: string
) {
	const [row] = await db
		.select()
		.from(kind.table)
		.where(and(eq(kind.table.projectId, projectId), eq(kind.table.id, id)))
		.limit(1);
	return (row as EventRow | undefined) ?? null;
}

function matchesRequest(
	kind: EventKind<unknown>,
	row: EventRow,
	input: Input,
	rationale: string
) {
	return (
		kind.targetOf(row) === input.targetId &&
		row.decision === input.decision &&
		row.rationale === rationale &&
		row.createdByUserId === input.userId
	);
}

/**
 * Returns the Review Event an earlier request with the same key already
 * published, or null when the key is new. The same key with other content is
 * a conflict, never a second record; a stored row that points at another
 * Asset Record is an integrity failure, never a success.
 */
async function replay<Event>(
	db: Database,
	kind: EventKind<Event>,
	input: Input
): Promise<Event | null> {
	if (!input.idempotencyKey) {
		return null;
	}
	const row = await readEvent(
		db,
		kind,
		input.projectId,
		await eventId(kind, input)
	);
	if (!row) {
		return null;
	}
	if (!matchesRequest(kind, row, input, input.rationale.trim())) {
		throw new IdempotencyConflictError(kind.label);
	}
	if (row.assetRecordId !== input.assetRecordId) {
		throw new RecordIntegrityError(
			`The persisted ${kind.label} points at another Asset Record; the result is not reported as success.`
		);
	}
	return kind.toEvent(row);
}

async function publish<Event>(
	db: Database,
	kind: EventKind<Event>,
	input: Input
): Promise<Event | null> {
	const id = await eventId(kind, input);
	const rationale = input.rationale.trim();
	const table = sql.raw(kind.tableName);
	const column = sql.raw(kind.column);
	const latest = (
		field: string
	) => sql`(SELECT event.${sql.raw(field)} FROM ${table} event
		WHERE event.project_id = ${input.projectId} AND event.${column} = ${input.targetId}
		ORDER BY event.created_at DESC, event.id DESC LIMIT 1)`;
	const writtenId = await insertGuarded(
		db,
		sql`
			INSERT INTO ${table} (id, project_id, asset_record_id, ${column}, decision, rationale, created_by_user_id)
			SELECT ${id}, ${input.projectId}, ${input.assetRecordId}, ${input.targetId}, ${input.decision}, ${rationale}, ${input.userId}
			WHERE ${latest("id")} IS NOT DISTINCT FROM ${input.expectedLatestEventId}::text
			AND ${latest("decision")} IS DISTINCT FROM ${input.decision}
			RETURNING id
		`
	);
	if (!writtenId) {
		// A lost race with the same key resolves to the record the winner wrote.
		return replay(db, kind, input);
	}
	const row = await readEvent(db, kind, input.projectId, writtenId);
	if (!row) {
		throw new Error(
			`The published ${kind.label} could not be re-read from the persisted record.`
		);
	}
	if (
		!matchesRequest(kind, row, input, rationale) ||
		row.assetRecordId !== input.assetRecordId
	) {
		// Withdrawn so a keyed retry cannot replay the bad row as success.
		return withdrawAndFail(
			() =>
				db
					.delete(kind.table)
					.where(
						and(
							eq(kind.table.projectId, input.projectId),
							eq(kind.table.id, id)
						)
					),
			`The persisted ${kind.label} does not match what was published; the result is not reported as success.`
		);
	}
	return kind.toEvent(row);
}

type AssetInput = PublicationBase & { versionId: string };
type CompositeInput = PublicationBase & { compositeVersionId: string };

export function replayAssetVersionReviewEvent(db: Database, input: AssetInput) {
	return replay(db, assetKind, { ...input, targetId: input.versionId });
}

export function replayCompositeVersionReviewEvent(
	db: Database,
	input: CompositeInput
) {
	return replay(db, compositeKind, {
		...input,
		targetId: input.compositeVersionId,
	});
}

export function publishAssetVersionReviewEvent(
	db: Database,
	input: AssetInput
) {
	return publish(db, assetKind, { ...input, targetId: input.versionId });
}

export function publishCompositeVersionReviewEvent(
	db: Database,
	input: CompositeInput
) {
	return publish(db, compositeKind, {
		...input,
		targetId: input.compositeVersionId,
	});
}
