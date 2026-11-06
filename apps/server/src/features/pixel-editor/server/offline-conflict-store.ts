import type {
	OfflineConflictEntry,
	OfflineConflictRecordRow,
	OfflineConflictResolutionRow,
	OfflineConflictStore,
} from "@sprite-anvil/api/offline-conflict";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	offlineConflictRecords,
	offlineConflictResolutions,
} from "@sprite-anvil/db/schema/offline-conflicts";
import { and, desc, eq, inArray } from "drizzle-orm";

function toRecord(
	row: typeof offlineConflictRecords.$inferSelect
): OfflineConflictRecordRow {
	return {
		id: row.id,
		projectId: row.projectId,
		ownerUserId: row.ownerUserId,
		draftId: row.draftId,
		contractVersion: row.contractVersion,
		baseRevision: row.baseRevision,
		cloudRevision: row.cloudRevision,
		localDigest: row.localDigest,
		content: row.content,
		createdAt: row.createdAt,
	};
}

function toResolution(
	row: typeof offlineConflictResolutions.$inferSelect
): OfflineConflictResolutionRow {
	return {
		id: row.id,
		conflictId: row.conflictId,
		choice: row.choice,
		idempotencyKey: row.idempotencyKey,
		resultAssetVersionId: row.resultAssetVersionId,
		resolvedByUserId: row.resolvedByUserId,
		resolvedAt: row.resolvedAt,
	};
}

export function createOfflineConflictStore(db: Database): OfflineConflictStore {
	function ownedRecord(userId: string, projectId: string, conflictId: string) {
		return and(
			eq(offlineConflictRecords.id, conflictId),
			eq(offlineConflictRecords.projectId, projectId),
			eq(offlineConflictRecords.ownerUserId, userId)
		);
	}

	async function readResolution(conflictId: string) {
		const [row] = await db
			.select()
			.from(offlineConflictResolutions)
			.where(eq(offlineConflictResolutions.conflictId, conflictId))
			.limit(1);
		return row ? toResolution(row) : null;
	}

	return {
		async createRecord(userId, input) {
			if (!(await getProjectForUser(db, userId, input.projectId))) {
				throw new Error("Project not available to the user");
			}
			const [created] = await db
				.insert(offlineConflictRecords)
				.values({ ...input, ownerUserId: userId })
				.onConflictDoNothing()
				.returning();
			if (created) {
				return {
					kind: "created",
					entry: { record: toRecord(created), resolution: null },
				};
			}
			const [existing] = await db
				.select()
				.from(offlineConflictRecords)
				.where(
					and(
						eq(offlineConflictRecords.projectId, input.projectId),
						eq(offlineConflictRecords.ownerUserId, userId),
						eq(offlineConflictRecords.draftId, input.draftId),
						eq(offlineConflictRecords.baseRevision, input.baseRevision),
						eq(offlineConflictRecords.cloudRevision, input.cloudRevision),
						eq(offlineConflictRecords.localDigest, input.localDigest)
					)
				)
				.limit(1);
			if (!existing) {
				throw new Error("Offline Conflict Record could not be stored");
			}
			return {
				kind: "existing",
				entry: {
					record: toRecord(existing),
					resolution: await readResolution(existing.id),
				},
			};
		},

		async getEntry(userId, projectId, conflictId) {
			const [row] = await db
				.select()
				.from(offlineConflictRecords)
				.where(ownedRecord(userId, projectId, conflictId))
				.limit(1);
			return row
				? { record: toRecord(row), resolution: await readResolution(row.id) }
				: null;
		},

		async listEntries(userId, projectId) {
			const rows = await db
				.select()
				.from(offlineConflictRecords)
				.where(
					and(
						eq(offlineConflictRecords.projectId, projectId),
						eq(offlineConflictRecords.ownerUserId, userId)
					)
				)
				.orderBy(desc(offlineConflictRecords.createdAt));
			if (rows.length === 0) {
				return [];
			}
			const resolutions = await db
				.select()
				.from(offlineConflictResolutions)
				.where(
					inArray(
						offlineConflictResolutions.conflictId,
						rows.map((row) => row.id)
					)
				);
			const byConflict = new Map(
				resolutions.map((row) => [row.conflictId, toResolution(row)])
			);
			return rows.map(
				(row): OfflineConflictEntry => ({
					record: toRecord(row),
					resolution: byConflict.get(row.id) ?? null,
				})
			);
		},

		async createResolution(userId, input) {
			const [record] = await db
				.select({ id: offlineConflictRecords.id })
				.from(offlineConflictRecords)
				.where(ownedRecord(userId, input.projectId, input.conflictId))
				.limit(1);
			if (!record) {
				return null;
			}
			const [created] = await db
				.insert(offlineConflictResolutions)
				.values({ ...input, resolvedByUserId: userId })
				.onConflictDoNothing()
				.returning();
			if (created) {
				return { kind: "created", resolution: toResolution(created) };
			}
			const existing = await readResolution(input.conflictId);
			return existing ? { kind: "existing", resolution: existing } : null;
		},
	};
}
