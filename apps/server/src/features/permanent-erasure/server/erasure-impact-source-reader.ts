import type { ErasureImpactSource } from "@sprite-anvil/api/permanent-erasure";
import type { ErasureImpactSourceReader } from "@sprite-anvil/api/permanent-erasure-store";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import {
	deliveryFulfilmentRequirements,
	deliveryFulfilments,
} from "@sprite-anvil/db/schema/delivery-fulfilment";
import {
	exportBundleFiles,
	exportBundles,
} from "@sprite-anvil/db/schema/export-bundles";
import {
	projectArchiveFiles,
	projectArchives,
} from "@sprite-anvil/db/schema/project-archives";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Reads the stored records one asset's Erasure Impact Report is built from.
 * It reads rows the project already owns and never changes them; storage
 * locations are not read, so none can reach the report.
 */
export function createErasureImpactSourceReader(
	db: Database
): ErasureImpactSourceReader {
	return {
		async read(_userId, projectId, assetRecordId) {
			const [record] = await db
				.select({
					availability: assetRecords.availability,
					id: assetRecords.id,
				})
				.from(assetRecords)
				.where(
					and(
						eq(assetRecords.projectId, projectId),
						eq(assetRecords.id, assetRecordId)
					)
				);
			if (!record) {
				return null;
			}
			const versions = await db
				.select({
					byteSize: assetVersions.byteSize,
					contentType: assetVersions.contentType,
					fileName: assetVersions.fileName,
					id: assetVersions.id,
					sha256: assetVersions.sha256,
				})
				.from(assetVersions)
				.where(
					and(
						eq(assetVersions.projectId, projectId),
						eq(assetVersions.assetRecordId, assetRecordId)
					)
				);
			const versionIds = versions.map((version) => version.id);
			if (versionIds.length === 0) {
				return {
					archives: [],
					assetRecord: record,
					bundles: [],
					fulfilments: [],
					versions,
				};
			}

			const [bundleFileRows, archiveFileRows] = await Promise.all([
				db
					.select({
						assetVersionId: exportBundleFiles.assetVersionId,
						bundleId: exportBundleFiles.bundleId,
						path: exportBundleFiles.path,
					})
					.from(exportBundleFiles)
					.innerJoin(
						exportBundles,
						eq(exportBundles.id, exportBundleFiles.bundleId)
					)
					.where(
						and(
							eq(exportBundles.projectId, projectId),
							inArray(exportBundleFiles.assetVersionId, versionIds)
						)
					),
				db
					.select({
						archiveId: projectArchiveFiles.archiveId,
						assetVersionId: projectArchiveFiles.assetVersionId,
						kind: projectArchiveFiles.kind,
						presence: projectArchiveFiles.presence,
						sourceId: projectArchiveFiles.sourceId,
					})
					.from(projectArchiveFiles)
					.innerJoin(
						projectArchives,
						eq(projectArchives.id, projectArchiveFiles.archiveId)
					)
					.where(
						and(
							eq(projectArchives.projectId, projectId),
							inArray(projectArchiveFiles.assetVersionId, versionIds)
						)
					),
			]);
			const bundleIds = [...new Set(bundleFileRows.map((row) => row.bundleId))];
			const archiveIds = [
				...new Set(archiveFileRows.map((row) => row.archiveId)),
			];
			const [bundleRows, archiveRows, requirementRows] = await Promise.all([
				bundleIds.length === 0
					? []
					: db
							.select({
								id: exportBundles.id,
								manifestDigest: exportBundles.manifestDigest,
							})
							.from(exportBundles)
							.where(
								and(
									eq(exportBundles.projectId, projectId),
									inArray(exportBundles.id, bundleIds)
								)
							),
				archiveIds.length === 0
					? []
					: db
							.select({
								id: projectArchives.id,
								manifestDigest: projectArchives.manifestDigest,
							})
							.from(projectArchives)
							.where(
								and(
									eq(projectArchives.projectId, projectId),
									inArray(projectArchives.id, archiveIds)
								)
							),
				db
					.select({
						assetVersionIds: deliveryFulfilmentRequirements.assetVersionIds,
						bundleId: deliveryFulfilmentRequirements.bundleId,
						deliveryTargetId: deliveryFulfilments.deliveryTargetId,
						fulfilmentId: deliveryFulfilmentRequirements.fulfilmentId,
						revisionNumber: deliveryFulfilments.revisionNumber,
					})
					.from(deliveryFulfilmentRequirements)
					.innerJoin(
						deliveryFulfilments,
						and(
							eq(
								deliveryFulfilments.projectId,
								deliveryFulfilmentRequirements.projectId
							),
							eq(
								deliveryFulfilments.id,
								deliveryFulfilmentRequirements.fulfilmentId
							)
						)
					)
					.where(eq(deliveryFulfilmentRequirements.projectId, projectId)),
			]);

			const targetIds = new Set(versionIds);
			const bundleIdSet = new Set(bundleIds);
			const fulfilments = new Map<
				string,
				ErasureImpactSource["fulfilments"][number]
			>();
			for (const row of requirementRows) {
				const touches =
					row.assetVersionIds.some((id) => targetIds.has(id)) ||
					bundleIdSet.has(row.bundleId);
				if (!touches) {
					continue;
				}
				const entry = fulfilments.get(row.fulfilmentId) ?? {
					deliveryTargetId: row.deliveryTargetId,
					id: row.fulfilmentId,
					requirements: [],
					revisionNumber: row.revisionNumber,
				};
				entry.requirements.push({
					assetVersionIds: row.assetVersionIds,
					bundleId: row.bundleId,
				});
				fulfilments.set(row.fulfilmentId, entry);
			}

			return {
				archives: archiveRows.map((archive) => ({
					files: archiveFileRows
						.filter((file) => file.archiveId === archive.id)
						.map((file) => ({
							assetVersionId: file.assetVersionId,
							kind: file.kind,
							presence: file.presence,
							sourceId: file.sourceId,
						})),
					id: archive.id,
					manifestDigest: archive.manifestDigest,
				})),
				assetRecord: record,
				bundles: bundleRows.map((bundle) => ({
					files: bundleFileRows
						.filter((file) => file.bundleId === bundle.id)
						.map((file) => ({
							assetVersionId: file.assetVersionId,
							path: file.path,
						})),
					id: bundle.id,
					manifestDigest: bundle.manifestDigest,
				})),
				fulfilments: [...fulfilments.values()],
				versions,
			};
		},
	};
}
