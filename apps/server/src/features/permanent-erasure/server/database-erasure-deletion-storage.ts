import type { DeletionReceipt } from "@sprite-anvil/api/permanent-erasure-deletion";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { exportBundles } from "@sprite-anvil/db/schema/export-bundles";
import {
	erasureAuthorizations,
	erasureReceipts,
	erasureTombstones,
} from "@sprite-anvil/db/schema/permanent-erasure";
import { projectArchives } from "@sprite-anvil/db/schema/project-archives";
import { and, eq, inArray } from "drizzle-orm";
import type {
	ErasureDeletionStorage,
	StoredErasureAuthorization,
} from "./erasure-deletion-storage";

const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

function toAuthorization(
	row: typeof erasureAuthorizations.$inferSelect
): StoredErasureAuthorization {
	return {
		authorizedByUserId: row.authorizedByUserId,
		confirmed: row.confirmed as StoredErasureAuthorization["confirmed"],
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
		async findAuthorization(projectId, id) {
			const [row] = await db
				.select()
				.from(erasureAuthorizations)
				.where(
					and(
						eq(erasureAuthorizations.projectId, projectId),
						eq(erasureAuthorizations.id, id)
					)
				);
			return row ? toAuthorization(row) : null;
		},

		async findReceipt(projectId, id) {
			const [row] = await db
				.select()
				.from(erasureReceipts)
				.where(
					and(
						eq(erasureReceipts.projectId, projectId),
						eq(erasureReceipts.id, id)
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
					await tx.insert(erasureReceipts).values({
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

		async insertAuthorization(row) {
			try {
				await db.insert(erasureAuthorizations).values({
					authorizedByUserId: row.authorizedByUserId,
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
					.from(erasureAuthorizations)
					.where(eq(erasureAuthorizations.id, row.id));
				if (!existing) {
					throw error;
				}
				return { existing: toAuthorization(existing), status: "existing" };
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
