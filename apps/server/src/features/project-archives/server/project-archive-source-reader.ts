import type { AssetFamilyStore } from "@sprite-anvil/api/asset-families";
import type { AssetRecordStore } from "@sprite-anvil/api/asset-records";
import type { AssetVersionStore } from "@sprite-anvil/api/asset-versions";
import type { ProjectArchiveSourceReader } from "@sprite-anvil/api/project-archive-store";
import type {
	FoundationRecords,
	ProjectArchiveSourceFile,
} from "@sprite-anvil/api/project-archives";
import { foundationSectionSchemas } from "@sprite-anvil/api/project-archives";
import type { Database } from "@sprite-anvil/db";
import { managedSnapshots } from "@sprite-anvil/db/schema/asset-production-history";
import {
	assetRecordReferenceHistory,
	assetRecordReferences,
} from "@sprite-anvil/db/schema/asset-record-references";
import {
	assetFamilies as assetFamilyRows,
	assetRecords as assetRecordRows,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { themes, visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import {
	contextProposals,
	contextRevisions,
} from "@sprite-anvil/db/schema/project-context";
import {
	referenceBoardImageHistory,
	referenceBoardImages,
} from "@sprite-anvil/db/schema/reference-production";
import { and, asc, eq, gt } from "drizzle-orm";
import { iso } from "./iso";
import { readProjectArchiveDelivery } from "./project-archive-delivery-reader";
import { readProjectArchiveHistory } from "./project-archive-history-reader";

export interface ProjectArchiveSourceReaderDependencies {
	assetFamilies: Pick<AssetFamilyStore, "list">;
	assetRecords: Pick<AssetRecordStore, "list">;
	assetVersions: Pick<AssetVersionStore, "list">;
	db: Database;
}

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
		async readWorkingFiles(projectId, cursor) {
			const rows = await db
				.select({
					id: managedSnapshots.id,
					assetVersionId: managedSnapshots.assetVersionId,
					fileName: managedSnapshots.fileName,
					byteSize: managedSnapshots.byteSize,
					objectKey: managedSnapshots.objectKey,
					sha256: managedSnapshots.sha256,
				})
				.from(managedSnapshots)
				.where(
					and(
						eq(managedSnapshots.projectId, projectId),
						cursor ? gt(managedSnapshots.id, cursor) : undefined
					)
				)
				.orderBy(asc(managedSnapshots.id))
				.limit(51);
			const files = rows.slice(0, 50);
			return {
				files,
				nextCursor: rows.length > 50 ? (files.at(-1)?.id ?? null) : null,
			};
		},
		async read(userId, projectId) {
			const [families, records, versions] = await Promise.all([
				dependencies.assetFamilies.list(userId, projectId),
				dependencies.assetRecords.list(userId, projectId),
				dependencies.assetVersions.list(userId, projectId),
			]);
			if (!(families && records && versions)) {
				return null;
			}
			const [
				revisionRows,
				referenceRows,
				historyRows,
				fileRows,
				worldRows,
				themeRows,
				snapshotRows,
				canonicalRows,
				inboxRows,
				boardRows,
				boardHistoryRows,
				proposalRows,
				recordScopeRows,
			] = await Promise.all([
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
					.select()
					.from(assetVersions)
					.where(eq(assetVersions.projectId, projectId)),
				db
					.select()
					.from(visualWorlds)
					.where(eq(visualWorlds.projectId, projectId)),
				db.select().from(themes).where(eq(themes.projectId, projectId)),
				db
					.select()
					.from(managedSnapshots)
					.where(eq(managedSnapshots.projectId, projectId)),
				db
					.select({
						id: assetFamilyRows.id,
						canonicalVersionId: assetFamilyRows.canonicalVersionId,
					})
					.from(assetFamilyRows)
					.where(eq(assetFamilyRows.projectId, projectId)),
				db
					.select()
					.from(importInboxEntries)
					.where(eq(importInboxEntries.projectId, projectId)),
				db
					.select()
					.from(referenceBoardImages)
					.where(eq(referenceBoardImages.projectId, projectId)),
				db
					.select()
					.from(referenceBoardImageHistory)
					.where(eq(referenceBoardImageHistory.projectId, projectId)),
				db
					.select()
					.from(contextProposals)
					.where(eq(contextProposals.projectId, projectId)),
				db
					.select({
						id: assetRecordRows.id,
						visualWorldId: assetRecordRows.visualWorldId,
					})
					.from(assetRecordRows)
					.where(eq(assetRecordRows.projectId, projectId)),
			]);

			const canonicalByFamily = new Map(
				canonicalRows.map((row) => [row.id, row.canonicalVersionId])
			);
			const familyOfRecord = new Map(
				families.assetRecords.map((record) => [record.id, record.assetFamilyId])
			);
			const recordScopes = new Map(
				recordScopeRows.map((row) => [row.id, row.visualWorldId])
			);
			const foundation: FoundationRecords = {
				contextProposals: proposalRows.map((row) => ({
					id: row.id,
					baseContextRevisionId: row.baseContextRevisionId,
					contractVersion: row.contractVersion,
					sourceKind: row.sourceKind,
					proposal:
						foundationSectionSchemas.contextProposals.shape.proposal.parse(
							row.proposal
						),
					createdAt: iso(row.createdAt),
				})),
				managedSnapshots: snapshotRows.map((row) => ({
					id: row.id,
					assetRecordId: row.assetRecordId,
					assetVersionId: row.assetVersionId,
					fileName: row.fileName,
					byteSize: row.byteSize,
					sha256: row.sha256,
					createdAt: iso(row.createdAt),
				})),
				importInboxEntries: inboxRows.map((row) => ({
					id: row.id,
					createdAt: iso(row.createdAt),
					fileName: row.fileName,
					sourceContentType: row.sourceContentType,
					contentLength: row.contentLength,
					sha256: row.sha256,
				})),
				referenceBoardImages: boardRows.map((row) => ({
					id: row.id,
					assetRecordId: row.assetRecordId,
					createdAt: iso(row.createdAt),
					updatedAt: iso(row.updatedAt),
					fileName: row.fileName,
					contentType: row.contentType,
					contentLength: row.contentLength,
					sha256: row.sha256,
					role: row.role,
					customPurpose: row.customPurpose,
					transferredFeatures: row.transferredFeatures,
					forbiddenFeatures: row.forbiddenFeatures,
					contextOverrideRationale: row.contextOverrideRationale,
					notes: row.notes,
					sortOrder: row.sortOrder,
					revision: row.revision,
				})),
				referenceBoardImageHistory: boardHistoryRows.map((row) => ({
					id: row.id,
					assetRecordId: row.assetRecordId,
					referenceId: row.referenceId,
					revision: row.revision,
					role: row.role,
					customPurpose: row.customPurpose,
					transferredFeatures: row.transferredFeatures,
					forbiddenFeatures: row.forbiddenFeatures,
					contextOverrideRationale: row.contextOverrideRationale,
					notes: row.notes,
					recordedAt: iso(row.recordedAt),
				})),
				visualWorlds: worldRows.map((row) => ({
					id: row.id,
					name: row.name,
					description: row.description,
					createdAt: iso(row.createdAt),
				})),
				themes: themeRows.map((row) => ({
					id: row.id,
					visualWorldId: row.visualWorldId,
					name: row.name,
					description: row.description,
					createdAt: iso(row.createdAt),
				})),
				assetFamilies: families.assetFamilies.map((family) => ({
					canonicalVersionId: canonicalByFamily.get(family.id) ?? null,
					createdAt: family.createdAt,
					id: family.id,
					name: family.name,
					subjectIdentityId: family.subjectIdentityId,
					useContext: family.useContext,
					visualWorldId: family.visualWorldId,
				})),
				assetRecords: records.map((record) => {
					const { projectId: _projectId, ...rest } = record;
					if (!recordScopes.has(record.id)) {
						throw new Error("Asset Record scope is unavailable.");
					}
					return {
						...rest,
						visualWorldId: recordScopes.get(record.id) ?? null,
						assetFamilyId: familyOfRecord.get(record.id) ?? null,
					};
				}),
				assetVersions: fileRows.map((version) =>
					foundationSectionSchemas.assetVersions.parse({
						assetFamilyId: version.assetFamilyId,
						assetRecordId: version.assetRecordId,
						byteSize: version.byteSize,
						contentDigest: version.contentDigest,
						contentType: version.contentType,
						createdAt: iso(version.createdAt),
						id: version.id,
						integrityVerified: version.integrityVerified,
						productionSource: version.productionSource,
						sourceImageDimensions:
							version.sourceImageWidth && version.sourceImageHeight
								? {
										width: version.sourceImageWidth,
										height: version.sourceImageHeight,
									}
								: null,
						sourceKind: version.sourceKind,
						versionNumber: version.versionNumber,
					})
				),
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

			const files: ProjectArchiveSourceFile[] = [
				...inboxRows.map((row) => ({
					kind: "import_inbox_file" as const,
					sourceId: row.id,
					assetRecordId: null,
					assetVersionId: null,
					byteSize: row.contentLength,
					sha256: row.sha256,
					fileName: row.fileName,
					contentType: row.sourceContentType,
					objectKey: row.objectKey,
				})),
				...boardRows.map((row) => ({
					kind: "reference_board_file" as const,
					sourceId: row.id,
					assetRecordId: row.assetRecordId,
					assetVersionId: null,
					byteSize: row.contentLength,
					sha256: row.sha256,
					fileName: row.fileName,
					contentType: row.contentType,
					objectKey: row.objectKey,
				})),
				...fileRows.flatMap((version) => {
					if (!(version.sha256 && version.contentDigest)) {
						return [];
					}
					return [
						{
							assetRecordId: version.assetRecordId,
							assetVersionId: version.id,
							byteSize: version.byteSize,
							contentType: version.contentType,
							fileName: version.fileName,
							kind: "asset_version_file" as const,
							objectKey: version.objectKey,
							sha256: version.sha256,
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
