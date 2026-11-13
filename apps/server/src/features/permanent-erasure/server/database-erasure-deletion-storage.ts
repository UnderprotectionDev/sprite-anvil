import type { DeletionReceipt } from "@sprite-anvil/api/permanent-erasure-deletion";
import type { Database } from "@sprite-anvil/db";
import { hasErrorCode } from "@sprite-anvil/db/error-codes";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import {
	deletionReceipts,
	erasureApprovals,
	erasureRemovalStarts,
} from "@sprite-anvil/db/schema/permanent-erasure";
import {
	projectArchiveFiles,
	projectArchives,
} from "@sprite-anvil/db/schema/project-archives";
import { and, eq, inArray } from "drizzle-orm";
import { finalizeErasure } from "./database-erasure-finalize";
import type {
	ErasureDeletionStorage,
	StoredDeletionReceipt,
	StoredErasureApproval,
} from "./erasure-deletion-storage";

const uniqueViolationCode = "23505";

function toApproval(
	row: typeof erasureApprovals.$inferSelect
): StoredErasureApproval {
	return {
		approvedByUserId: row.approvedByUserId,
		confirmed: row.confirmed as StoredErasureApproval["confirmed"],
		createdAt: row.createdAt,
		id: row.id,
		idempotencyKey: row.idempotencyKey,
		projectId: row.projectId,
		reportDigest: row.reportDigest,
		reportId: row.reportId,
		requestDigest: row.requestDigest,
		selectedContainerIds: row.selectedContainerIds,
	};
}

export function createDatabaseErasureDeletionStorage(
	db: Database
): ErasureDeletionStorage {
	async function findReceipt(
		projectId: string,
		id: string
	): Promise<StoredDeletionReceipt | null> {
		const [row] = await db
			.select()
			.from(deletionReceipts)
			.where(
				and(
					eq(deletionReceipts.projectId, projectId),
					eq(deletionReceipts.id, id)
				)
			);
		if (!row) {
			return null;
		}
		return {
			id: row.id,
			projectId: row.projectId,
			// Revalidated against the contract on every read.
			receipt: row.receipt as DeletionReceipt,
			receiptDigest: row.receiptDigest,
		};
	}

	return {
		async archiveObjectKeys(projectId, archiveIds, assetVersionIds) {
			if (archiveIds.length === 0 || assetVersionIds.length === 0) {
				return [];
			}
			const rows = await db
				.select({ key: projectArchiveFiles.sourceObjectKey })
				.from(projectArchiveFiles)
				.innerJoin(
					projectArchives,
					eq(projectArchives.id, projectArchiveFiles.archiveId)
				)
				.where(
					and(
						eq(projectArchives.projectId, projectId),
						inArray(projectArchiveFiles.archiveId, archiveIds),
						inArray(projectArchiveFiles.assetVersionId, assetVersionIds),
						eq(projectArchiveFiles.presence, "included")
					)
				);
			return [
				...new Set(rows.flatMap((row) => (row.key === null ? [] : [row.key]))),
			];
		},

		async findApproval(projectId, id) {
			const [row] = await db
				.select()
				.from(erasureApprovals)
				.where(
					and(
						eq(erasureApprovals.projectId, projectId),
						eq(erasureApprovals.id, id)
					)
				);
			return row ? toApproval(row) : null;
		},

		findReceipt,

		async finalize(input) {
			try {
				return await finalizeErasure(db, input);
			} catch (error) {
				// A unique violation only means "already finalized" when that approval's receipt is there.
				if (
					hasErrorCode(error, uniqueViolationCode) &&
					(await findReceipt(input.projectId, input.receipt.id))
				) {
					return { status: "existing" };
				}
				throw error;
			}
		},

		async insertApproval(row) {
			try {
				await db.insert(erasureApprovals).values({
					approvedByUserId: row.approvedByUserId,
					confirmed: row.confirmed,
					createdAt: row.createdAt,
					id: row.id,
					idempotencyKey: row.idempotencyKey,
					projectId: row.projectId,
					reportDigest: row.reportDigest,
					reportId: row.reportId,
					requestDigest: row.requestDigest,
					selectedContainerIds: row.selectedContainerIds,
				});
				return { status: "inserted" };
			} catch (error) {
				if (!hasErrorCode(error, uniqueViolationCode)) {
					throw error;
				}
				const [existing] = await db
					.select()
					.from(erasureApprovals)
					.where(eq(erasureApprovals.id, row.id));
				if (!existing) {
					throw error;
				}
				return { existing: toApproval(existing), status: "existing" };
			}
		},

		async markRemovalStarted(row) {
			await db
				.insert(erasureRemovalStarts)
				.values({
					id: row.approvalId,
					projectId: row.projectId,
					startedAt: row.startedAt,
				})
				.onConflictDoNothing();
		},

		async objectKeys(projectId, assetVersionIds) {
			if (assetVersionIds.length === 0) {
				return new Map();
			}
			const rows = await db
				.select({ id: assetVersions.id, objectKey: assetVersions.objectKey })
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, projectId),
						inArray(assetVersions.id, assetVersionIds)
					)
				);
			return new Map(rows.map((row) => [row.id, row.objectKey]));
		},

		async removalStarted(projectId, approvalId) {
			const [row] = await db
				.select({ id: erasureRemovalStarts.id })
				.from(erasureRemovalStarts)
				.where(
					and(
						eq(erasureRemovalStarts.projectId, projectId),
						eq(erasureRemovalStarts.id, approvalId)
					)
				);
			return row !== undefined;
		},
	};
}
