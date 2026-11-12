import { exportBundleManifestPath } from "@sprite-anvil/api/export-bundle-manifest";
import {
	type DeliveryRecords,
	deriveDeliveryDiffs,
	runtimeEvidenceFileKind,
} from "@sprite-anvil/api/project-archive-delivery";
import type { ProjectArchiveSourceFile } from "@sprite-anvil/api/project-archives";
import type { Database } from "@sprite-anvil/db";
import {
	deliveryFulfilmentRequirements,
	deliveryFulfilments,
} from "@sprite-anvil/db/schema/delivery-fulfilment";
import {
	deliveryTargetDraftFamilies,
	deliveryTargetDrafts,
	deliveryTargetRevisions,
	deliveryTargets,
} from "@sprite-anvil/db/schema/delivery-planning";
import {
	deliveryRefreshLockFiles,
	deliveryRefreshLocks,
} from "@sprite-anvil/db/schema/delivery-refresh-locks";
import {
	exportBundleFiles,
	exportBundles,
} from "@sprite-anvil/db/schema/export-bundles";
import {
	exportProfileRevisions,
	exportProfiles,
} from "@sprite-anvil/db/schema/export-profiles";
import { historicalRiskNotices } from "@sprite-anvil/db/schema/historical-risk-notices";
import {
	runtimeValidationDecisions,
	runtimeValidationEvidence,
	runtimeValidationRecords,
} from "@sprite-anvil/db/schema/runtime-validation";
import { eq } from "drizzle-orm";
import { iso } from "./iso";

export interface DeliveryRows {
	bundleFiles: (typeof exportBundleFiles.$inferSelect)[];
	bundles: (typeof exportBundles.$inferSelect)[];
	draftFamilies: (typeof deliveryTargetDraftFamilies.$inferSelect)[];
	drafts: (typeof deliveryTargetDrafts.$inferSelect)[];
	fulfilmentRequirements: (typeof deliveryFulfilmentRequirements.$inferSelect)[];
	fulfilments: (typeof deliveryFulfilments.$inferSelect)[];
	lockFiles: (typeof deliveryRefreshLockFiles.$inferSelect)[];
	locks: (typeof deliveryRefreshLocks.$inferSelect)[];
	notices: (typeof historicalRiskNotices.$inferSelect)[];
	profileRevisions: (typeof exportProfileRevisions.$inferSelect)[];
	profiles: (typeof exportProfiles.$inferSelect)[];
	targetRevisions: (typeof deliveryTargetRevisions.$inferSelect)[];
	targets: (typeof deliveryTargets.$inferSelect)[];
	validationDecisions: (typeof runtimeValidationDecisions.$inferSelect)[];
	validationEvidence: (typeof runtimeValidationEvidence.$inferSelect)[];
	validations: (typeof runtimeValidationRecords.$inferSelect)[];
}

function groupBy<Row, Key extends string>(
	rows: Row[],
	key: (row: Row) => Key
): Map<Key, Row[]> {
	const groups = new Map<Key, Row[]>();
	for (const row of rows) {
		const list = groups.get(key(row)) ?? [];
		list.push(row);
		groups.set(key(row), list);
	}
	return groups;
}

/**
 * Copies only the fields the archive format names. No author, deciding user,
 * request digest, storage location or destination path travels; an uploaded
 * runtime evidence file keeps its name, digest and size, and its storage
 * location stays beside the archive as a file location.
 */
export function mapDeliveryRows(rows: DeliveryRows): {
	delivery: DeliveryRecords;
	files: ProjectArchiveSourceFile[];
} {
	const bundleFiles = groupBy(rows.bundleFiles, (row) => row.bundleId);
	const lockFiles = groupBy(rows.lockFiles, (row) => row.lockId);
	const draftFamilies = groupBy(rows.draftFamilies, (row) => row.draftId);
	const requirements = groupBy(
		rows.fulfilmentRequirements,
		(row) => row.fulfilmentId
	);
	const evidence = groupBy(rows.validationEvidence, (row) => row.recordId);
	const decisions = groupBy(rows.validationDecisions, (row) => row.recordId);

	const delivery: DeliveryRecords = {
		deliveryDiffs: [],
		deliveryFulfilments: rows.fulfilments.map((row) => ({
			createdAt: iso(row.createdAt),
			deliveryTargetId: row.deliveryTargetId,
			draftId: row.draftId,
			id: row.id,
			requirements: (requirements.get(row.id) ?? [])
				.sort((left, right) => left.position - right.position)
				.map((requirement) => ({
					assetFamilyId: requirement.assetFamilyId,
					assetFamilyName: requirement.assetFamilyName,
					assetVersionIds: requirement.assetVersionIds,
					bundleId: requirement.bundleId,
					itemId: requirement.itemId,
					itemKind: requirement.itemKind,
					itemName: requirement.itemName,
					manifestDigest: requirement.manifestDigest,
					position: requirement.position,
					requiredSetRevisionId: requirement.requiredSetRevisionId,
					resolution: requirement.resolution,
				})),
			revisionId: row.revisionId,
			revisionNumber: row.revisionNumber,
		})),
		deliveryRefreshLocks: rows.locks.map((row) => ({
			bundleId: row.bundleId,
			bundleManifestDigest: row.bundleManifestDigest,
			contractVersion: row.contractVersion,
			createdAt: iso(row.createdAt),
			destinationLabel: row.destinationLabel,
			files: (lockFiles.get(row.id) ?? [])
				.map((file) => ({
					byteSize: file.byteSize,
					path: file.path,
					sha256: file.sha256,
				}))
				.sort(
					(left, right) =>
						Number(left.path > right.path) - Number(left.path < right.path)
				),
			id: row.id,
			lockDigest: row.lockDigest,
			profileId: row.profileId,
			profileRevisionId: row.profileRevisionId,
		})),
		deliveryTargetDrafts: rows.drafts.map((row) => ({
			contextRevisionId: row.contextRevisionId,
			createdAt: iso(row.createdAt),
			deliveryTargetId: row.deliveryTargetId,
			families: (draftFamilies.get(row.id) ?? [])
				.sort((left, right) => left.position - right.position)
				.map((family) => ({
					assetFamilyId: family.assetFamilyId,
					position: family.position,
					requiredSetRevisionId: family.requiredSetRevisionId,
				})),
			id: row.id,
			productionEvidencePolicy: row.productionEvidencePolicy,
			rightsEvidencePolicy: row.rightsEvidencePolicy,
			runtimeValidationCriterion: row.runtimeValidationCriterion ?? null,
		})),
		deliveryTargetRevisions: rows.targetRevisions.map((row) => ({
			activatedAt: iso(row.activatedAt),
			deliveryTargetId: row.deliveryTargetId,
			draftId: row.draftId,
			id: row.id,
			revisionNumber: row.revisionNumber,
		})),
		deliveryTargets: rows.targets.map((row) => ({
			createdAt: iso(row.createdAt),
			id: row.id,
			name: row.name,
			purpose: row.purpose,
		})),
		exportBundles: rows.bundles.map((row) => ({
			adapterVersion: row.adapterVersion,
			contextRevisionId: row.contextRevisionId,
			contractVersion: row.contractVersion,
			createdAt: iso(row.createdAt),
			deliveryTargetRevisionId: row.deliveryTargetRevisionId,
			files: (bundleFiles.get(row.id) ?? [])
				.map((file) => ({
					assetVersionId: file.assetVersionId,
					byteSize: file.byteSize,
					content: file.path === exportBundleManifestPath ? file.content : null,
					path: file.path,
					sha256: file.sha256,
				}))
				.sort(
					(left, right) =>
						Number(left.path > right.path) - Number(left.path < right.path)
				),
			id: row.id,
			manifestDigest: row.manifestDigest,
			profileId: row.profileId,
			profileRevisionId: row.profileRevisionId,
		})),
		exportProfileRevisions: rows.profileRevisions.map((row) => ({
			contentDigest: row.contentDigest,
			contractVersion: row.contractVersion,
			createdAt: iso(row.createdAt),
			definition: row.definition,
			id: row.id,
			profileId: row.profileId,
			revisionNumber: row.revisionNumber,
		})),
		exportProfiles: rows.profiles.map((row) => ({
			createdAt: iso(row.createdAt),
			id: row.id,
			name: row.name,
		})),
		historicalRiskNotices: rows.notices.map((row) => ({
			affectedUsage: row.affectedUsage.map((usage) => ({
				assetFamilyId: usage.assetFamilyId,
				assetFamilyName: usage.assetFamilyName,
				bundleId: usage.bundleId,
				itemId: usage.itemId,
				itemName: usage.itemName,
			})),
			assetRecordId: row.assetRecordId,
			deliveryTargetId: row.deliveryTargetId,
			detectedAt: iso(row.detectedAt),
			fulfilmentId: row.fulfilmentId,
			id: row.id,
			pinnedPolicy: row.pinnedPolicy,
			pinnedRights: row.pinnedRights ?? null,
			revisionId: row.revisionId,
			revisionNumber: row.revisionNumber,
			rightsRecordId: row.rightsRecordId,
			rightsRecordState: row.rightsRecordState,
			rightsRecordVersionNumber: row.rightsRecordVersionNumber,
		})),
		runtimeValidations: rows.validations.map((row) => ({
			adapterVersion: row.adapterVersion,
			bundleId: row.bundleId,
			createdAt: iso(row.createdAt),
			decisions: (decisions.get(row.id) ?? [])
				.sort((left, right) => left.sequence - right.sequence)
				.map((decision) => ({
					createdAt: iso(decision.createdAt),
					failureSource: decision.failureSource ?? null,
					id: decision.id,
					kind: decision.kind,
					outcome: decision.outcome ?? null,
					sequence: decision.sequence,
				})),
			engineVersion: row.engineVersion,
			evidence: (evidence.get(row.id) ?? [])
				.sort(
					(left, right) =>
						Number(left.id > right.id) - Number(left.id < right.id)
				)
				.map((item) => ({
					createdAt: iso(item.createdAt),
					file:
						item.sha256 && item.byteSize && item.fileName
							? {
									byteSize: item.byteSize,
									fileName: item.fileName,
									sha256: item.sha256,
								}
							: null,
					id: item.id,
					kind: item.kind,
					source: item.source,
					text: item.text,
				})),
			gameBuild: row.gameBuild,
			id: row.id,
			manifestDigest: row.manifestDigest,
			supersedesRecordId: row.supersedesRecordId,
		})),
	};
	delivery.deliveryDiffs = deriveDeliveryDiffs(delivery);

	const files: ProjectArchiveSourceFile[] = rows.validationEvidence.flatMap(
		(item) =>
			item.sha256 && item.byteSize && item.fileName && item.objectKey
				? [
						{
							assetRecordId: null,
							assetVersionId: null,
							byteSize: item.byteSize,
							contentType: null,
							fileName: item.fileName,
							kind: runtimeEvidenceFileKind,
							objectKey: item.objectKey,
							sha256: item.sha256,
							sourceId: item.id,
						},
					]
				: []
	);
	return { delivery, files };
}

/** Reads the delivery and validation history of one project the caller already owns. */
export async function readProjectArchiveDelivery(
	db: Database,
	projectId: string
): Promise<{ delivery: DeliveryRecords; files: ProjectArchiveSourceFile[] }> {
	const [
		bundles,
		draftFamilies,
		drafts,
		fulfilments,
		locks,
		notices,
		profileRevisions,
		profiles,
		targetRevisions,
		targets,
		validationDecisions,
		validationEvidence,
		validations,
	] = await Promise.all([
		db
			.select()
			.from(exportBundles)
			.where(eq(exportBundles.projectId, projectId)),
		db
			.select()
			.from(deliveryTargetDraftFamilies)
			.where(eq(deliveryTargetDraftFamilies.projectId, projectId)),
		db
			.select()
			.from(deliveryTargetDrafts)
			.where(eq(deliveryTargetDrafts.projectId, projectId)),
		db
			.select()
			.from(deliveryFulfilments)
			.where(eq(deliveryFulfilments.projectId, projectId)),
		db
			.select()
			.from(deliveryRefreshLocks)
			.where(eq(deliveryRefreshLocks.projectId, projectId)),
		db
			.select()
			.from(historicalRiskNotices)
			.where(eq(historicalRiskNotices.projectId, projectId)),
		db
			.select()
			.from(exportProfileRevisions)
			.where(eq(exportProfileRevisions.projectId, projectId)),
		db
			.select()
			.from(exportProfiles)
			.where(eq(exportProfiles.projectId, projectId)),
		db
			.select()
			.from(deliveryTargetRevisions)
			.where(eq(deliveryTargetRevisions.projectId, projectId)),
		db
			.select()
			.from(deliveryTargets)
			.where(eq(deliveryTargets.projectId, projectId)),
		db
			.select()
			.from(runtimeValidationDecisions)
			.where(eq(runtimeValidationDecisions.projectId, projectId)),
		db
			.select()
			.from(runtimeValidationEvidence)
			.where(eq(runtimeValidationEvidence.projectId, projectId)),
		db
			.select()
			.from(runtimeValidationRecords)
			.where(eq(runtimeValidationRecords.projectId, projectId)),
	]);
	// Child rows carry no project column; they are reached through their parent.
	const [bundleFiles, fulfilmentRequirements, lockFiles] = await Promise.all([
		db
			.select({ file: exportBundleFiles })
			.from(exportBundleFiles)
			.innerJoin(
				exportBundles,
				eq(exportBundleFiles.bundleId, exportBundles.id)
			)
			.where(eq(exportBundles.projectId, projectId)),
		db
			.select()
			.from(deliveryFulfilmentRequirements)
			.where(eq(deliveryFulfilmentRequirements.projectId, projectId)),
		db
			.select({ file: deliveryRefreshLockFiles })
			.from(deliveryRefreshLockFiles)
			.innerJoin(
				deliveryRefreshLocks,
				eq(deliveryRefreshLockFiles.lockId, deliveryRefreshLocks.id)
			)
			.where(eq(deliveryRefreshLocks.projectId, projectId)),
	]);
	return mapDeliveryRows({
		bundleFiles: bundleFiles.map((row) => row.file),
		bundles,
		draftFamilies,
		drafts,
		fulfilmentRequirements,
		fulfilments,
		lockFiles: lockFiles.map((row) => row.file),
		locks,
		notices,
		profileRevisions,
		profiles,
		targetRevisions,
		targets,
		validationDecisions,
		validationEvidence,
		validations,
	});
}
