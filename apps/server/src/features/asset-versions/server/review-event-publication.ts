import type {
	AssetVersionReviewEvent,
	assetVersionReviewDispositionSchema,
	CompositeVersionReviewEvent,
} from "@sprite-anvil/api/asset-versions";
import {
	assetVersionReviewEventSchema,
	compositeVersionReviewEventSchema,
} from "@sprite-anvil/api/asset-versions";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import {
	RecordIntegrityError,
	type RecordScope,
	RetryablePublicationError,
	replayPublishedRecord,
	resolveRecordId,
	verifyPublishedRecord,
} from "@sprite-anvil/api/record-publication";
import type { Database } from "@sprite-anvil/db";
import {
	assetVersionReviewEvents,
	compositeVersionReviewEvents,
} from "@sprite-anvil/db/schema/asset-versions";
import { and, desc, eq, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { z } from "zod";

type ReviewDecision = z.infer<typeof assetVersionReviewDispositionSchema>;

interface PublicationBase {
	assetRecordId: string;
	decision: ReviewDecision;
	/** Latest Review Event id the caller based its checks on; null or omitted when none. */
	expectedLatestEventId?: string | null;
	/** Same key + same content returns the first record; no column holds it, so it derives the id. */
	idempotencyKey?: string;
	projectId: string;
	rationale: string;
	userId: string;
}

/** The columns both Review Event tables share. */
interface EventRow {
	assetRecordId: string;
	createdAt: Date | string;
	createdByUserId: string;
	decision: string;
	id: string;
	projectId: string;
	rationale: string | null;
}

type AssetEventRow = typeof assetVersionReviewEvents.$inferSelect;
type CompositeEventRow = typeof compositeVersionReviewEvents.$inferSelect;

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

/** What differs between Asset Version and Composite Version Review Events: table, target column, copy. */
interface EventKind<Row extends EventRow, Event> {
	/** Stored column name of the target, interpolated only from these constants. */
	column: string;
	label: string;
	/** Latest event of a target: the single owner of "what is current". */
	readLatest: (
		db: Database,
		projectId: string,
		targetId: string
	) => Promise<{ decision: string; id: string } | null>;
	readRow: (db: Database, projectId: string, id: string) => Promise<Row | null>;
	/** Record kind in the idempotency scope. */
	recordKind: string;
	tableName: string;
	targetOf: (row: Row) => string;
	toEvent: (row: Row) => Event;
}

const assetKind: EventKind<AssetEventRow, AssetVersionReviewEvent> = {
	column: "version_id",
	label: "Review Event",
	readLatest: async (db, projectId, targetId) => {
		const [latest] = await db
			.select({
				decision: assetVersionReviewEvents.decision,
				id: assetVersionReviewEvents.id,
			})
			.from(assetVersionReviewEvents)
			.where(
				and(
					eq(assetVersionReviewEvents.projectId, projectId),
					eq(assetVersionReviewEvents.versionId, targetId)
				)
			)
			.orderBy(
				desc(assetVersionReviewEvents.createdAt),
				desc(assetVersionReviewEvents.id)
			)
			.limit(1);
		return latest ?? null;
	},
	readRow: async (db, projectId, id) => {
		const [row] = await db
			.select()
			.from(assetVersionReviewEvents)
			.where(
				and(
					eq(assetVersionReviewEvents.projectId, projectId),
					eq(assetVersionReviewEvents.id, id)
				)
			)
			.limit(1);
		return row ?? null;
	},
	recordKind: "asset-version-review-event",
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

const compositeKind: EventKind<CompositeEventRow, CompositeVersionReviewEvent> =
	{
		column: "composite_version_id",
		label: "Composite Version Review Event",
		readLatest: async (db, projectId, targetId) => {
			const [latest] = await db
				.select({
					decision: compositeVersionReviewEvents.decision,
					id: compositeVersionReviewEvents.id,
				})
				.from(compositeVersionReviewEvents)
				.where(
					and(
						eq(compositeVersionReviewEvents.projectId, projectId),
						eq(compositeVersionReviewEvents.compositeVersionId, targetId)
					)
				)
				.orderBy(
					desc(compositeVersionReviewEvents.createdAt),
					desc(compositeVersionReviewEvents.id)
				)
				.limit(1);
			return latest ?? null;
		},
		readRow: async (db, projectId, id) => {
			const [row] = await db
				.select()
				.from(compositeVersionReviewEvents)
				.where(
					and(
						eq(compositeVersionReviewEvents.projectId, projectId),
						eq(compositeVersionReviewEvents.id, id)
					)
				)
				.limit(1);
			return row ?? null;
		},
		recordKind: "composite-version-review-event",
		tableName: "composite_version_review_events",
		targetOf: (row) => row.compositeVersionId,
		toEvent: (row) =>
			compositeVersionReviewEventSchema.parse({
				id: row.id,
				compositeVersionId: row.compositeVersionId,
				type: row.decision,
				rationale: row.rationale,
				createdAt: toISOString(row.createdAt),
			}),
	};

/** What the raw guarded INSERT needs to know about a kind. */
type EventTable = Pick<
	EventKind<EventRow, unknown>,
	"column" | "label" | "tableName"
>;

/** A Review Event request with its target resolved: the Asset Version or Composite Version it reviews. */
type ReviewEventRequest = PublicationBase & { targetId: string };

/** Keyed ids are scoped to record kind, project, member, Asset Record and target, so no other key user or target collides. */
function eventScope(recordKind: string, request: ReviewEventRequest) {
	return {
		assetRecordId: request.assetRecordId,
		kind: recordKind,
		projectId: request.projectId,
		targetId: request.targetId,
		userId: request.userId,
	} satisfies RecordScope;
}

interface EventContent {
	assetRecordId?: string;
	createdByUserId: string;
	decision: string;
	projectId: string;
	rationale: string | null;
	targetId: string;
}

/** The canonical content a digest covers; the Asset Record joins it only when `withAssetRecord` is set. */
function requestContent(
	request: ReviewEventRequest,
	withAssetRecord: boolean
): EventContent {
	return {
		...(withAssetRecord ? { assetRecordId: request.assetRecordId } : {}),
		createdByUserId: request.userId,
		decision: request.decision,
		projectId: request.projectId,
		rationale: request.rationale.trim(),
		targetId: request.targetId,
	};
}

function rowContent<Row extends EventRow>(
	kind: EventKind<Row, unknown>,
	row: Row,
	withAssetRecord: boolean
): EventContent {
	return {
		...(withAssetRecord ? { assetRecordId: row.assetRecordId } : {}),
		createdByUserId: row.createdByUserId,
		decision: row.decision,
		projectId: row.projectId,
		rationale: row.rationale,
		targetId: kind.targetOf(row),
	};
}

async function sameContent<Row extends EventRow>(
	kind: EventKind<Row, unknown>,
	row: Row,
	request: ReviewEventRequest,
	withAssetRecord: boolean
) {
	const [stored, requested] = await Promise.all([
		recordContentDigest(rowContent(kind, row, withAssetRecord)),
		recordContentDigest(requestContent(request, withAssetRecord)),
	]);
	return stored === requested;
}

/**
 * Returns the Review Event an earlier request with the same key already
 * published, or null when there is no key or it is new. The same key with
 * other content is a conflict, never a second record; a stored row that
 * points at another Asset Record is an integrity failure, never a success.
 */
async function replay<Row extends EventRow, Event>(
	db: Database,
	kind: EventKind<Row, Event>,
	request: ReviewEventRequest
): Promise<Event | null> {
	if (!request.idempotencyKey) {
		return null;
	}
	const id = await resolveRecordId(
		eventScope(kind.recordKind, request),
		request.idempotencyKey
	);
	return replayPublishedRecord({
		differs: async (row) => !(await sameContent(kind, row, request, false)),
		integrityFailure: (row) =>
			row.assetRecordId === request.assetRecordId
				? null
				: `The persisted ${kind.label} points at another Asset Record; the result is not reported as success.`,
		label: kind.label,
		read: () => kind.readRow(db, request.projectId, id),
		toResult: kind.toEvent,
	});
}

/** Raised by the in-statement check when the written row differs from the request. */
const verificationFailedCode = "22012";

/**
 * The write and its verification are one Serializable statement. The row is
 * written only when the latest event is still the one the caller checked, and
 * the statement fails (rolling the write back) when the stored row differs
 * from the request. Nothing is deleted after commit.
 */
function guardedInsertStatement(
	kind: EventTable,
	request: ReviewEventRequest,
	id: string
) {
	const rationale = request.rationale.trim();
	const table = sql.raw(kind.tableName);
	const column = sql.raw(kind.column);
	const latest = (
		field: string
	) => sql`(SELECT event.${sql.raw(field)} FROM ${table} event
		WHERE event.project_id = ${request.projectId} AND event.${column} = ${request.targetId}
		ORDER BY event.created_at DESC, event.id DESC LIMIT 1)`;
	return new PgDialect().sqlToQuery(sql`
		WITH written AS (
			INSERT INTO ${table} (id, project_id, asset_record_id, ${column}, decision, rationale, created_by_user_id)
			SELECT ${id}, ${request.projectId}, ${request.assetRecordId}, ${request.targetId}, ${request.decision}, ${rationale}, ${request.userId}
			WHERE ${latest("id")} IS NOT DISTINCT FROM ${request.expectedLatestEventId ?? null}::text
			AND ${latest("decision")} IS DISTINCT FROM ${request.decision}
			RETURNING id, project_id, asset_record_id, ${column} AS target_id, decision, rationale, created_by_user_id
		)
		SELECT id, CASE
			WHEN project_id = ${request.projectId} AND asset_record_id = ${request.assetRecordId}
				AND target_id = ${request.targetId} AND decision = ${request.decision}
				AND rationale = ${rationale} AND created_by_user_id = ${request.userId}
			THEN true
			ELSE length(id) / 0 > 0
		END AS verified FROM written
	`);
}

type WriteOutcome = "duplicate" | "rejected" | "serialization" | "written";

async function writeGuarded(
	db: Database,
	kind: EventTable,
	request: ReviewEventRequest,
	id: string
): Promise<WriteOutcome> {
	const query = guardedInsertStatement(kind, request, id);
	try {
		const [result] = await db.$client.transaction(
			[db.$client.query(query.sql, query.params)],
			{ isolationLevel: "Serializable", fullResults: true }
		);
		return result?.rows.length ? "written" : "rejected";
	} catch (error) {
		const code = error instanceof Error && "code" in error ? error.code : null;
		if (code === "40001") {
			return "serialization";
		}
		if (code === "23505") {
			return "duplicate";
		}
		if (code === verificationFailedCode) {
			throw new RecordIntegrityError(
				`The persisted ${kind.label} did not match what was published; nothing was written.`,
				{ cause: error }
			);
		}
		throw error;
	}
}

async function publish<Row extends EventRow, Event>(
	db: Database,
	kind: EventKind<Row, Event>,
	request: ReviewEventRequest
): Promise<Event | null> {
	const id = await resolveRecordId(
		eventScope(kind.recordKind, request),
		request.idempotencyKey
	);
	const outcome = await writeGuarded(db, kind, request, id);
	if (outcome === "written") {
		return verifyPublishedRecord({
			// Digest of the re-read row against the digest of what was submitted.
			integrityFailure: async (row) =>
				(await sameContent(kind, row, request, true))
					? null
					: `The persisted ${kind.label} does not match what was published; the result is not reported as success.`,
			label: kind.label,
			read: () => kind.readRow(db, request.projectId, id),
			toResult: kind.toEvent,
		});
	}
	// A lost race or duplicate with the same key resolves to the winner's record.
	const winner = await replay(db, kind, request);
	if (winner) {
		return winner;
	}
	if (outcome === "serialization" || outcome === "duplicate") {
		throw new RetryablePublicationError(kind.label);
	}
	return null;
}

/**
 * Records one Review Event: a keyed repeat returns the first result, a write
 * for the decision that is already current is rejected, and `beforePublish`
 * may block the write (returning what blocked it). Returns null when the
 * write was rejected.
 */
async function record<Row extends EventRow, Event, Blocked>(
	db: Database,
	kind: EventKind<Row, Event>,
	request: ReviewEventRequest,
	beforePublish?: () => Promise<Blocked | true | null>
): Promise<Event | Blocked | null> {
	const replayed = await replay(db, kind, request);
	if (replayed) {
		return replayed;
	}
	const latest = await kind.readLatest(db, request.projectId, request.targetId);
	if (latest?.decision === request.decision) {
		return null;
	}
	if (beforePublish) {
		const checked = await beforePublish();
		if (checked !== true) {
			return checked;
		}
	}
	return publish(db, kind, {
		...request,
		expectedLatestEventId: latest?.id ?? null,
	});
}

type AssetInput = PublicationBase & { versionId: string };
type CompositeInput = PublicationBase & { compositeVersionId: string };

function assetRequest({ versionId, ...rest }: AssetInput): ReviewEventRequest {
	return { ...rest, targetId: versionId };
}

function compositeRequest({
	compositeVersionId,
	...rest
}: CompositeInput): ReviewEventRequest {
	return { ...rest, targetId: compositeVersionId };
}

export function replayAssetVersionReviewEvent(db: Database, input: AssetInput) {
	return replay(db, assetKind, assetRequest(input));
}

export function replayCompositeVersionReviewEvent(
	db: Database,
	input: CompositeInput
) {
	return replay(db, compositeKind, compositeRequest(input));
}

export function publishAssetVersionReviewEvent(
	db: Database,
	input: AssetInput
) {
	return publish(db, assetKind, assetRequest(input));
}

export function publishCompositeVersionReviewEvent(
	db: Database,
	input: CompositeInput
) {
	return publish(db, compositeKind, compositeRequest(input));
}

export function recordAssetVersionReviewEvent<Blocked>(
	db: Database,
	input: AssetInput,
	beforePublish?: () => Promise<Blocked | true | null>
) {
	return record(db, assetKind, assetRequest(input), beforePublish);
}

export function recordCompositeVersionReviewEvent(
	db: Database,
	input: CompositeInput
) {
	return record<CompositeEventRow, CompositeVersionReviewEvent, never>(
		db,
		compositeKind,
		compositeRequest(input)
	);
}
