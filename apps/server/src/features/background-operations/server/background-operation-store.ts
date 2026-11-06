import {
	type BackgroundOperation,
	type BackgroundOperationStore,
	backgroundOperationSchema,
} from "@sprite-anvil/api/background-operations";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { backgroundOperations } from "@sprite-anvil/db/schema/background-operations";
import { and, desc, eq } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toNullableISOString(value: Date | string | null) {
	return value === null ? null : toISOString(value);
}

export function toBackgroundOperation(
	row: typeof backgroundOperations.$inferSelect
): BackgroundOperation {
	return backgroundOperationSchema.parse({
		attemptCount: row.attemptCount,
		createdAt: toISOString(row.createdAt),
		failureSummary: row.failureSummary,
		finishedAt: toNullableISOString(row.finishedAt),
		id: row.id,
		kind: row.kind,
		maxAttempts: row.maxAttempts,
		progressPercent: row.progressPercent,
		progressStep: row.progressStep,
		projectId: row.projectId,
		resultSummary: row.resultSummary,
		scopeSummary: row.scopeSummary,
		scopeTargetId: row.scopeTargetId,
		startedAt: toNullableISOString(row.startedAt),
		status: row.status,
		triggerSummary: row.triggerSummary,
		triggeredByUserId: row.triggeredByUserId,
		updatedAt: toISOString(row.updatedAt),
	});
}

/** Project-scoped reads of the authoritative Background Operation record. */
export function createBackgroundOperationStore(
	db: Database
): BackgroundOperationStore {
	return {
		async get(userId, projectId, operationId) {
			if (!(await getProjectForUser(db, userId, projectId))) {
				return null;
			}
			const [row] = await db
				.select()
				.from(backgroundOperations)
				.where(
					and(
						eq(backgroundOperations.projectId, projectId),
						eq(backgroundOperations.id, operationId)
					)
				)
				.limit(1);
			return row ? toBackgroundOperation(row) : null;
		},
		async list(userId, projectId) {
			if (!(await getProjectForUser(db, userId, projectId))) {
				return null;
			}
			const rows = await db
				.select()
				.from(backgroundOperations)
				.where(eq(backgroundOperations.projectId, projectId))
				.orderBy(
					desc(backgroundOperations.createdAt),
					desc(backgroundOperations.id)
				);
			return rows.map(toBackgroundOperation);
		},
	};
}
