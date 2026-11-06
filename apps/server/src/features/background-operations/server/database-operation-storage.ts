import type { Database } from "@sprite-anvil/db";
import {
	backgroundOperationOutbox,
	backgroundOperations,
} from "@sprite-anvil/db/schema/background-operations";
import {
	and,
	asc,
	eq,
	inArray,
	isNull,
	lt,
	notExists,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { toBackgroundOperation } from "./background-operation-store";
import type { OperationStorage } from "./operation-storage";

/** Runs one SQL statement and returns its rows; a statement is atomic, so a CTE can pair a state change with its outbox record. */
async function rows(db: Database, statement: SQL) {
	const query = new PgDialect().sqlToQuery(statement);
	const result: unknown = await db.$client.query(query.sql, query.params);
	return Array.isArray(result) ? result : [];
}

function stamp(value: Date) {
	return value.toISOString();
}

/** An attempt in progress: Running, or Running with a cancel request it has not yet honoured. */
const running = (backgroundOperationId: string, attemptCount: number) =>
	and(
		eq(backgroundOperations.id, backgroundOperationId),
		inArray(backgroundOperations.status, ["running", "cancel_requested"]),
		eq(backgroundOperations.attemptCount, attemptCount)
	);

/**
 * Compare-and-set storage for the Background Operation lifecycle. Each state
 * change names the state it expects, so a repeated delivery matches no row.
 */
export function createDatabaseOperationStorage(db: Database): OperationStorage {
	return {
		async cancelPending(backgroundOperationId, now) {
			const updated = await db
				.update(backgroundOperations)
				.set({
					cancelRequestedAt: now,
					finishedAt: now,
					status: "cancelled",
					updatedAt: now,
				})
				.where(
					and(
						eq(backgroundOperations.id, backgroundOperationId),
						eq(backgroundOperations.status, "pending")
					)
				)
				.returning({ id: backgroundOperations.id });
			return updated.length > 0;
		},
		async cancelRequested(backgroundOperationId, attemptCount, now) {
			const updated = await db
				.update(backgroundOperations)
				.set({ finishedAt: now, status: "cancelled", updatedAt: now })
				.where(
					and(
						eq(backgroundOperations.id, backgroundOperationId),
						eq(backgroundOperations.status, "cancel_requested"),
						eq(backgroundOperations.attemptCount, attemptCount)
					)
				)
				.returning({ id: backgroundOperations.id });
			return updated.length > 0;
		},
		async requestCancelRunning(backgroundOperationId, now) {
			const updated = await db
				.update(backgroundOperations)
				.set({
					cancelRequestedAt: now,
					status: "cancel_requested",
					updatedAt: now,
				})
				.where(
					and(
						eq(backgroundOperations.id, backgroundOperationId),
						eq(backgroundOperations.status, "running")
					)
				)
				.returning({ id: backgroundOperations.id });
			return updated.length > 0;
		},
		async claim(backgroundOperationId, now) {
			const [row] = await db
				.update(backgroundOperations)
				.set({
					attemptCount: sql`${backgroundOperations.attemptCount} + 1`,
					heartbeatAt: now,
					startedAt: sql`coalesce(${backgroundOperations.startedAt}, ${stamp(now)}::timestamp)`,
					status: sql`case when ${backgroundOperations.cancelRequestedAt} is not null then 'cancel_requested' else 'running' end`,
					updatedAt: now,
				})
				.where(
					and(
						eq(backgroundOperations.id, backgroundOperationId),
						eq(backgroundOperations.status, "pending")
					)
				)
				.returning();
			return row ? toBackgroundOperation(row) : null;
		},
		async complete(backgroundOperationId, attemptCount, resultSummary, now) {
			const updated = await db
				.update(backgroundOperations)
				.set({
					finishedAt: now,
					progressPercent: 100,
					resultSummary,
					status: "completed",
					updatedAt: now,
				})
				.where(running(backgroundOperationId, attemptCount))
				.returning({ id: backgroundOperations.id });
			return updated.length > 0;
		},
		async fail(backgroundOperationId, attemptCount, failureSummary, now) {
			const updated = await db
				.update(backgroundOperations)
				.set({
					failureSummary,
					finishedAt: now,
					status: "failed",
					updatedAt: now,
				})
				.where(running(backgroundOperationId, attemptCount))
				.returning({ id: backgroundOperations.id });
			return updated.length > 0;
		},
		async get(backgroundOperationId) {
			const [row] = await db
				.select()
				.from(backgroundOperations)
				.where(eq(backgroundOperations.id, backgroundOperationId))
				.limit(1);
			return row ? toBackgroundOperation(row) : null;
		},
		async insertWithOutbox(operation, outboxId, now) {
			const created = await rows(
				db,
				sql`WITH inserted AS (
					INSERT INTO background_operations (id, project_id, kind, scope_summary, scope_target_id, trigger_summary, triggered_by_user_id, status, attempt_count, max_attempts, created_at, updated_at)
					VALUES (${operation.id}, ${operation.projectId}, ${operation.kind}, ${operation.scopeSummary}, ${operation.scopeTargetId}, ${operation.triggerSummary}, ${operation.triggeredByUserId}, 'pending', 0, ${operation.maxAttempts}, ${stamp(now)}::timestamp, ${stamp(now)}::timestamp)
					ON CONFLICT (id) DO NOTHING
					RETURNING id
				)
				INSERT INTO background_operation_outbox (id, operation_id, created_at)
				SELECT ${outboxId}, id, ${stamp(now)}::timestamp FROM inserted
				RETURNING id`
			);
			return created.length > 0;
		},
		async listStalledPending(olderThan) {
			const stalled = await db
				.select()
				.from(backgroundOperations)
				.where(
					and(
						eq(backgroundOperations.status, "pending"),
						lt(backgroundOperations.updatedAt, olderThan),
						notExists(
							db
								.select({ id: backgroundOperationOutbox.id })
								.from(backgroundOperationOutbox)
								.where(
									and(
										eq(
											backgroundOperationOutbox.backgroundOperationId,
											backgroundOperations.id
										),
										isNull(backgroundOperationOutbox.publishedAt)
									)
								)
						)
					)
				)
				.orderBy(asc(backgroundOperations.updatedAt))
				.limit(100);
			return stalled.map(toBackgroundOperation);
		},
		async listStalledRunning(heartbeatBefore) {
			const stalled = await db
				.select()
				.from(backgroundOperations)
				.where(
					and(
						inArray(backgroundOperations.status, [
							"running",
							"cancel_requested",
						]),
						or(
							lt(backgroundOperations.heartbeatAt, heartbeatBefore),
							and(
								isNull(backgroundOperations.heartbeatAt),
								lt(backgroundOperations.updatedAt, heartbeatBefore)
							)
						)
					)
				)
				.orderBy(asc(backgroundOperations.updatedAt))
				.limit(100);
			return stalled.map(toBackgroundOperation);
		},
		async listUnpublishedOutbox(limit) {
			return await db
				.select({
					id: backgroundOperationOutbox.id,
					backgroundOperationId:
						backgroundOperationOutbox.backgroundOperationId,
				})
				.from(backgroundOperationOutbox)
				.where(isNull(backgroundOperationOutbox.publishedAt))
				.orderBy(
					asc(backgroundOperationOutbox.createdAt),
					asc(backgroundOperationOutbox.id)
				)
				.limit(limit);
		},
		async markOutboxPublished(outboxId, now) {
			await db
				.update(backgroundOperationOutbox)
				.set({ publishedAt: now })
				.where(eq(backgroundOperationOutbox.id, outboxId));
		},
		async redeliverPendingWithOutbox(backgroundOperationId, outboxId, now) {
			const moved = await rows(
				db,
				sql`WITH touched AS (
					UPDATE background_operations SET updated_at = ${stamp(now)}::timestamp
					WHERE id = ${backgroundOperationId} AND status = 'pending'
					RETURNING id
				)
				INSERT INTO background_operation_outbox (id, operation_id, created_at)
				SELECT ${outboxId}, id, ${stamp(now)}::timestamp FROM touched
				RETURNING id`
			);
			return moved.length > 0;
		},
		async reportProgress(backgroundOperationId, attemptCount, progress, now) {
			const updated = await db
				.update(backgroundOperations)
				.set({
					heartbeatAt: now,
					progressPercent: progress.percent,
					progressStep: progress.step,
					updatedAt: now,
				})
				.where(running(backgroundOperationId, attemptCount))
				.returning({ id: backgroundOperations.id });
			return updated.length > 0;
		},
		async requeueWithOutbox(
			backgroundOperationId,
			attemptCount,
			outboxId,
			now
		) {
			const moved = await rows(
				db,
				sql`WITH requeued AS (
					UPDATE background_operations SET status = 'pending', updated_at = ${stamp(now)}::timestamp
					WHERE id = ${backgroundOperationId} AND status IN ('running', 'cancel_requested') AND attempt_count = ${attemptCount}
					RETURNING id
				)
				INSERT INTO background_operation_outbox (id, operation_id, created_at)
				SELECT ${outboxId}, id, ${stamp(now)}::timestamp FROM requeued
				RETURNING id`
			);
			return moved.length > 0;
		},
	};
}
