import type { Database } from "@sprite-anvil/db";
import {
	exportBundleFiles,
	exportBundleMarkers,
	exportBundles,
} from "@sprite-anvil/db/schema/export-bundles";
import { and, asc, eq } from "drizzle-orm";
import type {
	ExportBundleStorage,
	StoredExportBundle,
} from "./export-bundle-storage";

const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

function toBundle(row: typeof exportBundles.$inferSelect): StoredExportBundle {
	return {
		adapterVersion: row.adapterVersion,
		contextRevisionId: row.contextRevisionId,
		contractVersion: row.contractVersion,
		createdAt: row.createdAt,
		createdByUserId: row.createdByUserId,
		deliveryTargetRevisionId: row.deliveryTargetRevisionId,
		id: row.id,
		manifestDigest: row.manifestDigest,
		profileId: row.profileId,
		profileRevisionId: row.profileRevisionId,
		projectId: row.projectId,
		requestDigest: row.requestDigest,
	};
}

export function createDatabaseExportBundleStorage(
	db: Database
): ExportBundleStorage {
	return {
		async findBundle(projectId, bundleId) {
			const [row] = await db
				.select()
				.from(exportBundles)
				.where(
					and(
						eq(exportBundles.projectId, projectId),
						eq(exportBundles.id, bundleId)
					)
				);
			if (!row) {
				return null;
			}
			const files = await db
				.select({
					assetVersionId: exportBundleFiles.assetVersionId,
					byteSize: exportBundleFiles.byteSize,
					content: exportBundleFiles.content,
					path: exportBundleFiles.path,
					sha256: exportBundleFiles.sha256,
				})
				.from(exportBundleFiles)
				.where(eq(exportBundleFiles.bundleId, bundleId))
				.orderBy(asc(exportBundleFiles.path));
			return { bundle: toBundle(row), files };
		},
		async findLatestBundleId(projectId) {
			const [row] = await db
				.select({ bundleId: exportBundleMarkers.bundleId })
				.from(exportBundleMarkers)
				.where(eq(exportBundleMarkers.projectId, projectId));
			return row?.bundleId ?? null;
		},
		async insertBundle(bundle, files) {
			try {
				await db.transaction(async (tx) => {
					await tx.insert(exportBundles).values(bundle);
					await tx
						.insert(exportBundleFiles)
						.values(files.map((file) => ({ ...file, bundleId: bundle.id })));
					await tx
						.insert(exportBundleMarkers)
						.values({
							bundleId: bundle.id,
							projectId: bundle.projectId,
							updatedAt: bundle.createdAt,
						})
						.onConflictDoUpdate({
							set: { bundleId: bundle.id, updatedAt: bundle.createdAt },
							target: exportBundleMarkers.projectId,
						});
				});
				return { status: "inserted" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		async listBundles(projectId) {
			const rows = await db
				.select()
				.from(exportBundles)
				.where(eq(exportBundles.projectId, projectId))
				.orderBy(asc(exportBundles.createdAt), asc(exportBundles.id));
			return rows.map(toBundle);
		},
	};
}
