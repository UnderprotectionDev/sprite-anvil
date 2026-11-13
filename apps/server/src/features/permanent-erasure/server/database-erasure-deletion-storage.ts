import type { DeletionReceipt } from "@sprite-anvil/api/permanent-erasure-deletion";
import type { Database } from "@sprite-anvil/db";
import { hasErrorCode } from "@sprite-anvil/db/error-codes";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { exportBundles } from "@sprite-anvil/db/schema/export-bundles";
import {
	deletionReceipts,
	erasureApprovals,
	erasureTombstones,
} from "@sprite-anvil/db/schema/permanent-erasure";
import {
	projectArchiveFiles,
	projectArchives,
} from "@sprite-anvil/db/schema/project-archives";
import { and, eq, inArray } from "drizzle-orm";
import type {
	ErasureDeletionStorage,
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

		async findReceipt(projectId, id) {
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
		},

		async finalize(input) {
			const bundleIds = input.removeContainers
				.filter((container) => container.kind === "export_bundle")
				.map((container) => container.id);
			const archiveIds = input.removeContainers
				.filter((container) => container.kind === "project_archive")
				.map((container) => container.id);
			try {
				await db.transaction(async (tx) => {
					await tx.insert(deletionReceipts).values({
						backgroundOperationId: input.receipt.receipt.operationId,
						contractVersion: input.receipt.receipt.contractVersion,
						id: input.receipt.id,
						projectId: input.projectId,
						receipt: input.receipt.receipt,
						receiptDigest: input.receipt.receiptDigest,
					});
					if (input.tombstones.length > 0) {
						await tx.insert(erasureTombstones).values(
							input.tombstones.map((row) => ({
								assetRecordId: row.assetRecordId,
								erasedAt: row.erasedAt,
								id: row.assetVersionId,
								projectId: row.projectId,
								receiptId: row.receiptId,
							}))
						);
					}
					await tx
						.update(assetRecords)
						.set({ availability: "erased" })
						.where(
							and(
								eq(assetRecords.projectId, input.projectId),
								eq(assetRecords.id, input.assetRecordId)
							)
						);
					// Whole containers go with their file rows (cascade); none is rewritten.
					if (bundleIds.length > 0) {
						await tx
							.delete(exportBundles)
							.where(
								and(
									eq(exportBundles.projectId, input.projectId),
									inArray(exportBundles.id, bundleIds)
								)
							);
					}
					if (archiveIds.length > 0) {
						await tx
							.delete(projectArchives)
							.where(
								and(
									eq(projectArchives.projectId, input.projectId),
									inArray(projectArchives.id, archiveIds)
								)
							);
					}
				});
				return { status: "finalized" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
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
	};
}
