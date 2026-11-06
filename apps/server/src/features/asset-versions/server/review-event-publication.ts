import type {
	AssetVersionReviewEvent,
	CompositeVersionReviewEvent,
} from "@sprite-anvil/api/asset-versions";
import {
	assetVersionReviewEventSchema,
	compositeVersionReviewEventSchema,
} from "@sprite-anvil/api/asset-versions";
import {
	IdempotencyConflictError,
	idempotentRecordId,
	RecordIntegrityError,
} from "@sprite-anvil/api/record-publication";
import type { Database } from "@sprite-anvil/db";
import {
	assetVersionReviewEvents,
	compositeVersionReviewEvents,
} from "@sprite-anvil/db/schema/asset-versions";
import type { SQL } from "drizzle-orm";
import { and, eq, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

type ReviewDecision = "candidate" | "approved" | "rejected";

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

function assertPersisted(matches: boolean) {
	if (!matches) {
		throw new RecordIntegrityError(
			"The persisted Review Event does not match what was published; the result is not reported as success."
		);
	}
}

function assetEventId(input: PublicationBase & { versionId: string }) {
	return input.idempotencyKey
		? idempotentRecordId(
				["asset-version-review-event", input.projectId, input.versionId],
				input.idempotencyKey
			)
		: Promise.resolve(crypto.randomUUID());
}

function compositeEventId(
	input: PublicationBase & { compositeVersionId: string }
) {
	return input.idempotencyKey
		? idempotentRecordId(
				[
					"composite-version-review-event",
					input.projectId,
					input.compositeVersionId,
				],
				input.idempotencyKey
			)
		: Promise.resolve(crypto.randomUUID());
}

/**
 * Returns the Review Event an earlier request with the same key already
 * published, or null when the key is new. The same key with other content is
 * a conflict, never a second record.
 */
export async function replayAssetVersionReviewEvent(
	db: Database,
	input: PublicationBase & { versionId: string }
): Promise<AssetVersionReviewEvent | null> {
	if (!input.idempotencyKey) {
		return null;
	}
	const [row] = await db
		.select()
		.from(assetVersionReviewEvents)
		.where(
			and(
				eq(assetVersionReviewEvents.projectId, input.projectId),
				eq(assetVersionReviewEvents.id, await assetEventId(input))
			)
		)
		.limit(1);
	if (!row) {
		return null;
	}
	if (
		row.versionId !== input.versionId ||
		row.decision !== input.decision ||
		row.rationale !== input.rationale.trim() ||
		row.createdByUserId !== input.userId
	) {
		throw new IdempotencyConflictError("Review Event");
	}
	return assetVersionReviewEventSchema.parse({
		id: row.id,
		assetVersionId: row.versionId,
		type: row.decision,
		rationale: row.rationale,
		createdAt: toISOString(row.createdAt),
	});
}

export async function replayCompositeVersionReviewEvent(
	db: Database,
	input: PublicationBase & { compositeVersionId: string }
): Promise<CompositeVersionReviewEvent | null> {
	if (!input.idempotencyKey) {
		return null;
	}
	const [row] = await db
		.select()
		.from(compositeVersionReviewEvents)
		.where(
			and(
				eq(compositeVersionReviewEvents.projectId, input.projectId),
				eq(compositeVersionReviewEvents.id, await compositeEventId(input))
			)
		)
		.limit(1);
	if (!row) {
		return null;
	}
	if (
		row.compositeVersionId !== input.compositeVersionId ||
		row.decision !== input.decision ||
		row.rationale !== input.rationale.trim() ||
		row.createdByUserId !== input.userId
	) {
		throw new IdempotencyConflictError("Composite Version Review Event");
	}
	return compositeVersionReviewEventSchema.parse({
		id: row.id,
		compositeVersionId: row.compositeVersionId,
		type: row.decision,
		rationale: row.rationale,
		createdAt: toISOString(row.createdAt),
	});
}

export async function publishAssetVersionReviewEvent(
	db: Database,
	input: PublicationBase & { versionId: string }
): Promise<AssetVersionReviewEvent | null> {
	const id = await assetEventId(input);
	const rationale = input.rationale.trim();
	const writtenId = await insertGuarded(
		db,
		sql`
			INSERT INTO asset_version_review_events (id, project_id, asset_record_id, version_id, decision, rationale, created_by_user_id)
			SELECT ${id}, ${input.projectId}, ${input.assetRecordId}, ${input.versionId}, ${input.decision}, ${rationale}, ${input.userId}
			WHERE (SELECT event.id FROM asset_version_review_events event
				WHERE event.project_id = ${input.projectId} AND event.version_id = ${input.versionId}
				ORDER BY event.created_at DESC, event.id DESC LIMIT 1)
				IS NOT DISTINCT FROM ${input.expectedLatestEventId}::text
			AND (SELECT event.decision FROM asset_version_review_events event
				WHERE event.project_id = ${input.projectId} AND event.version_id = ${input.versionId}
				ORDER BY event.created_at DESC, event.id DESC LIMIT 1)
				IS DISTINCT FROM ${input.decision}
			RETURNING id
		`
	);
	if (!writtenId) {
		// A lost race with the same key resolves to the record the winner wrote.
		return replayAssetVersionReviewEvent(db, input);
	}
	const [row] = await db
		.select()
		.from(assetVersionReviewEvents)
		.where(
			and(
				eq(assetVersionReviewEvents.projectId, input.projectId),
				eq(assetVersionReviewEvents.id, writtenId)
			)
		)
		.limit(1);
	if (!row) {
		throw new Error(
			"The published Review Event could not be re-read from the persisted record."
		);
	}
	assertPersisted(
		row.versionId === input.versionId &&
			row.assetRecordId === input.assetRecordId &&
			row.decision === input.decision &&
			row.rationale === rationale &&
			row.createdByUserId === input.userId
	);
	return assetVersionReviewEventSchema.parse({
		id: row.id,
		assetVersionId: row.versionId,
		type: row.decision,
		rationale: row.rationale,
		createdAt: toISOString(row.createdAt),
	});
}

export async function publishCompositeVersionReviewEvent(
	db: Database,
	input: PublicationBase & { compositeVersionId: string }
): Promise<CompositeVersionReviewEvent | null> {
	const id = await compositeEventId(input);
	const rationale = input.rationale.trim();
	const writtenId = await insertGuarded(
		db,
		sql`
			INSERT INTO composite_version_review_events (id, project_id, asset_record_id, composite_version_id, decision, rationale, created_by_user_id)
			SELECT ${id}, ${input.projectId}, ${input.assetRecordId}, ${input.compositeVersionId}, ${input.decision}, ${rationale}, ${input.userId}
			WHERE (SELECT event.id FROM composite_version_review_events event
				WHERE event.project_id = ${input.projectId} AND event.composite_version_id = ${input.compositeVersionId}
				ORDER BY event.created_at DESC, event.id DESC LIMIT 1)
				IS NOT DISTINCT FROM ${input.expectedLatestEventId}::text
			AND (SELECT event.decision FROM composite_version_review_events event
				WHERE event.project_id = ${input.projectId} AND event.composite_version_id = ${input.compositeVersionId}
				ORDER BY event.created_at DESC, event.id DESC LIMIT 1)
				IS DISTINCT FROM ${input.decision}
			RETURNING id
		`
	);
	if (!writtenId) {
		return replayCompositeVersionReviewEvent(db, input);
	}
	const [row] = await db
		.select()
		.from(compositeVersionReviewEvents)
		.where(
			and(
				eq(compositeVersionReviewEvents.projectId, input.projectId),
				eq(compositeVersionReviewEvents.id, writtenId)
			)
		)
		.limit(1);
	if (!row) {
		throw new Error(
			"The published Composite Version Review Event could not be re-read from the persisted record."
		);
	}
	assertPersisted(
		row.compositeVersionId === input.compositeVersionId &&
			row.assetRecordId === input.assetRecordId &&
			row.decision === input.decision &&
			row.rationale === rationale &&
			row.createdByUserId === input.userId
	);
	return compositeVersionReviewEventSchema.parse({
		id: row.id,
		compositeVersionId: row.compositeVersionId,
		type: row.decision,
		rationale: row.rationale,
		createdAt: toISOString(row.createdAt),
	});
}
