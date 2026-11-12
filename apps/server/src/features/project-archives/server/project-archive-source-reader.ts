import type { AssetFamilyStore } from "@sprite-anvil/api/asset-families";
import type { AssetRecordStore } from "@sprite-anvil/api/asset-records";
import type { AssetVersionStore } from "@sprite-anvil/api/asset-versions";
import type { ProjectArchiveSourceReader } from "@sprite-anvil/api/project-archive-store";
import type {
	FoundationRecords,
	ProjectArchiveSourceFile,
} from "@sprite-anvil/api/project-archives";
import type { Database } from "@sprite-anvil/db";
import { managedSnapshots } from "@sprite-anvil/db/schema/asset-production-history";
import {
	assetRecordReferenceHistory,
	assetRecordReferences,
} from "@sprite-anvil/db/schema/asset-record-references";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { asc, eq } from "drizzle-orm";
import { readProjectArchiveDelivery } from "./project-archive-delivery-reader";
import { readProjectArchiveHistory } from "./project-archive-history-reader";

export interface ProjectArchiveSourceReaderDependencies {
	assetFamilies: Pick<AssetFamilyStore, "list">;
	assetRecords: Pick<AssetRecordStore, "list">;
	assetVersions: Pick<AssetVersionStore, "list">;
	db: Database;
}

const iso = (value: Date) => value.toISOString();

/**
 * Reads the foundation and history records of one owned project. Authorized, project-scoped
 * stores supply the records they own; only what no store lists (all context
 * revisions, references, file locations) is read from the tables. Only the
 * fields the archive format names are copied, so no location, preview link or
 * user identity travels.
 */
export function createProjectArchiveSourceReader(
	dependencies: ProjectArchiveSourceReaderDependencies
): ProjectArchiveSourceReader {
	const { db } = dependencies;
	return {
		async read(userId, projectId) {
			const [families, records, versions] = await Promise.all([
				dependencies.assetFamilies.list(userId, projectId),
				dependencies.assetRecords.list(userId, projectId),
				dependencies.assetVersions.list(userId, projectId),
			]);
			if (!(families && records && versions)) {
				return null;
			}
			const [revisionRows, referenceRows, historyRows, fileRows, snapshotRows] =
				await Promise.all([
					db
						.select()
						.from(contextRevisions)
						.where(eq(contextRevisions.projectId, projectId))
						.orderBy(asc(contextRevisions.revisionNumber)),
					db
						.select()
						.from(assetRecordReferences)
						.where(eq(assetRecordReferences.projectId, projectId)),
					db
						.select()
						.from(assetRecordReferenceHistory)
						.where(eq(assetRecordReferenceHistory.projectId, projectId)),
					db
						.select({
							fileName: assetVersions.fileName,
							id: assetVersions.id,
							objectKey: assetVersions.objectKey,
							sha256: assetVersions.sha256,
						})
						.from(assetVersions)
						.where(eq(assetVersions.projectId, projectId)),
					db
						.select()
						.from(managedSnapshots)
						.where(eq(managedSnapshots.projectId, projectId)),
				]);

			const familyOfRecord = new Map(
				families.assetRecords.map((record) => [record.id, record.assetFamilyId])
			);
			const foundation: FoundationRecords = {
				assetFamilies: families.assetFamilies.map((family) => ({
					createdAt: family.createdAt,
					id: family.id,
					name: family.name,
					subjectIdentityId: family.subjectIdentityId,
					useContext: family.useContext,
					visualWorldId: family.visualWorldId,
				})),
				assetRecords: records.flatMap((record) => {
					const assetFamilyId = familyOfRecord.get(record.id);
					if (!assetFamilyId) {
						return [];
					}
					const { projectId: _projectId, ...rest } = record;
					return [{ ...rest, assetFamilyId }];
				}),
				assetVersions: versions.assetVersions.map((version) => ({
					assetFamilyId: version.assetFamilyId,
					assetRecordId: version.assetRecordId,
					byteSize: version.contentLength,
					contentDigest: version.contentDigest,
					contentType: version.contentType,
					createdAt: version.createdAt,
					id: version.id,
					integrityVerified: version.integrityVerified,
					productionSource: version.productionSource ?? "unknown",
					sourceImageDimensions: version.sourceImageDimensions ?? null,
					sourceKind: version.sourceKind ?? "unknown",
					versionNumber: version.versionNumber,
				})),
				canonicalDesigns: versions.canonicalDesigns.map((design) => ({
					assetFamilyId: design.assetFamilyId,
					assetRecordId: design.assetRecordId,
					assetVersionId: design.assetVersionId,
					createdAt: design.createdAt,
					id: design.id,
				})),
				compositeVersions: versions.compositeVersions.map((composite) => ({
					assetRecordId: composite.assetRecordId,
					createdAt: composite.createdAt,
					id: composite.id,
					versionNumber: composite.versionNumber,
				})),
				compositionMemberships: versions.compositeVersions.flatMap(
					(composite) =>
						composite.compositionMemberships.map((membership) => ({
							assetRecordId: membership.assetRecordId,
							compositeVersionId: membership.compositeVersionId,
							createdAt: membership.createdAt,
							id: membership.id,
							unitKey: membership.unitKey,
							unitType: membership.unitType,
							unitVersionId: membership.unitVersionId,
						}))
				),
				contextRevisions: revisionRows.map((row) => ({
					contractVersion: row.contractVersion,
					createdAt: iso(row.createdAt),
					id: row.id,
					revisionNumber: row.revisionNumber,
					rules: row.rules,
					sourceProposalId: row.sourceProposalId,
					state: row.state,
				})),
				referenceHistory: historyRows.map((row) => ({
					assetRecordId: row.assetRecordId,
					contextOverrideRationale: row.contextOverrideRationale,
					customPurpose: row.customPurpose,
					forbiddenFeatures: row.forbiddenFeatures,
					id: row.id,
					notes: row.notes,
					recordedAt: iso(row.recordedAt),
					referenceId: row.referenceId,
					revision: row.revision,
					role: row.role,
					transferredFeatures: row.transferredFeatures,
				})),
				references: referenceRows.map((row) => ({
					assetRecordId: row.assetRecordId,
					contextOverrideRationale: row.contextOverrideRationale,
					createdAt: iso(row.createdAt),
					customPurpose: row.customPurpose,
					forbiddenFeatures: row.forbiddenFeatures,
					id: row.id,
					notes: row.notes,
					revision: row.revision,
					role: row.role,
					targetVersionId: row.targetVersionId,
					transferredFeatures: row.transferredFeatures,
					updatedAt: iso(row.updatedAt),
				})),
				relationships: families.relationships.map((relationship) => ({
					assetFamilyId: relationship.assetFamilyId,
					createdAt: relationship.createdAt,
					id: relationship.id,
					sourceAssetRecordId: relationship.sourceAssetRecordId,
					sourceAssetVersionId: relationship.sourceAssetVersionId,
					targetAssetRecordId: relationship.targetAssetRecordId,
					type: relationship.type,
				})),
				subjectIdentities: families.subjectIdentities.map((subject) => ({
					createdAt: subject.createdAt,
					id: subject.id,
					name: subject.name,
				})),
				unitVersions: versions.unitVersions.map((unit) => ({
					assetRecordId: unit.assetRecordId,
					assetVersionId: unit.assetVersionId,
					createdAt: unit.createdAt,
					id: unit.id,
					sourceAssetVersionId: unit.sourceAssetVersionId,
					unitKey: unit.unitKey,
					unitType: unit.unitType,
					versionNumber: unit.versionNumber,
				})),
			};

			const historySource = await readProjectArchiveHistory(db, projectId);
			const fileLocation = new Map(fileRows.map((row) => [row.id, row]));
			const files: ProjectArchiveSourceFile[] = [
				...versions.assetVersions.flatMap((version) => {
					const location = fileLocation.get(version.id);
					// A version without a digest stays out of the files; the
					// builder refuses the archive because its record lacks one.
					if (!(location && version.contentDigest)) {
						return [];
					}
					return [
						{
							assetRecordId: version.assetRecordId,
							assetVersionId: version.id,
							byteSize: version.contentLength,
							contentType: version.contentType,
							fileName: location.fileName,
							kind: "asset_version_file" as const,
							objectKey: location.objectKey,
							sha256: version.contentDigest,
							sourceId: version.id,
						},
					];
				}),
				...snapshotRows.map((snapshot) => ({
					assetRecordId: snapshot.assetRecordId,
					assetVersionId: snapshot.assetVersionId,
					byteSize: snapshot.byteSize,
					contentType: null,
					fileName: snapshot.fileName,
					kind: "working_file" as const,
					objectKey: snapshot.objectKey,
					sha256: snapshot.sha256,
					sourceId: snapshot.id,
				})),
			];
			const deliverySource = await readProjectArchiveDelivery(db, projectId);
			return {
				delivery: deliverySource.delivery,
				files: [...files, ...historySource.files, ...deliverySource.files],
				history: historySource.history,
				records: foundation,
			};
		},
	};
}
