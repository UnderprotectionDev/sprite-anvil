import {
	productionEvidencePolicySchema,
	rightsEvidencePolicySchema,
} from "@sprite-anvil/api/delivery-planning-inputs";
import type { DeliveryRecords } from "@sprite-anvil/api/project-archive-delivery";
import { deliverySectionSchemas } from "@sprite-anvil/api/project-archive-delivery";
import type { ProjectArchiveRestorePlan } from "@sprite-anvil/api/project-archive-restore";
import { restoredRecordId } from "@sprite-anvil/api/project-archive-restore";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import { runtimeValidationCriterionSchema } from "@sprite-anvil/api/runtime-validation-readiness";
import type { Database } from "@sprite-anvil/db";
import type { InteractiveTransaction } from "@sprite-anvil/db/interactive-database";
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
	exportBundleMarkers,
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
import type { StoredProjectArchiveRestoreRecord } from "./project-archive-restore-storage";

type Tx = Pick<InteractiveTransaction, "insert">;

async function insertBatches<T>(
	rows: T[],
	insert: (rows: T[]) => PromiseLike<unknown>
) {
	for (let index = 0; index < rows.length; index += 500) {
		// biome-ignore lint/performance/noAwaitInLoops: FK-ordered batches share one transaction.
		await insert(rows.slice(index, index + 500));
	}
}

type Plan = Pick<ProjectArchiveRestorePlan, "sections" | "files">;

function deliveryRecords(plan: Pick<Plan, "sections">): DeliveryRecords {
	const result = {} as DeliveryRecords;
	for (const name of Object.keys(
		deliverySectionSchemas
	) as (keyof DeliveryRecords)[]) {
		const section = plan.sections.find(
			(entry) => entry.group === "delivery" && entry.name === name
		);
		Object.assign(result, {
			[name]: deliverySectionSchemas[name]
				.array()
				.parse(section?.records ?? []),
		});
	}
	return result;
}

/** File evidence cannot be written without the actual archived object. */
export function canMaterializeArchiveDelivery(plan: Plan): boolean {
	try {
		const delivery = deliveryRecords(plan);
		return (
			delivery.exportBundleMarkers.length <= 1 &&
			delivery.runtimeValidations.every((record) =>
				record.evidence.every(
					(evidence) =>
						!evidence.file ||
						plan.files.some(
							(file) =>
								file.kind === "runtime_evidence_file" &&
								file.restoredId === evidence.id
						)
				)
			) &&
			delivery.exportBundleMarkers.every((marker) =>
				delivery.exportBundles.some((bundle) => bundle.id === marker.bundleId)
			)
		);
	} catch {
		return false;
	}
}

function requestDigest(restoreId: string, kind: string, id: string) {
	return recordContentDigest({ restoreId, kind, id });
}

export async function insertArchiveDelivery(
	tx: Tx,
	record: StoredProjectArchiveRestoreRecord
) {
	const delivery = deliveryRecords(record);
	if (!canMaterializeArchiveDelivery(record)) {
		throw new Error(
			"Archive is missing a required Runtime Validation evidence file"
		);
	}
	const {
		restoredProjectId: projectId,
		createdByUserId,
		id: restoreId,
	} = record.restore;
	const identity = { projectId, createdByUserId };
	const date = (value: string) => new Date(value);
	if (delivery.exportProfiles.length) {
		await insertBatches(
			delivery.exportProfiles.map((row) => ({
				...row,
				...identity,
				createdAt: date(row.createdAt),
			})),
			(batch) => tx.insert(exportProfiles).values(batch)
		);
	}
	if (delivery.exportProfileRevisions.length) {
		await insertBatches(
			delivery.exportProfileRevisions.map((row) => ({
				...row,
				...identity,
				createdAt: date(row.createdAt),
			})),
			(batch) => tx.insert(exportProfileRevisions).values(batch)
		);
	}
	if (delivery.deliveryTargets.length) {
		await insertBatches(
			delivery.deliveryTargets.map((row) => ({
				...row,
				...identity,
				createdAt: date(row.createdAt),
			})),
			(batch) => tx.insert(deliveryTargets).values(batch)
		);
	}
	if (delivery.deliveryTargetDrafts.length) {
		await insertBatches(
			delivery.deliveryTargetDrafts.map(({ families: _families, ...row }) => ({
				...row,
				...identity,
				productionEvidencePolicy: productionEvidencePolicySchema.parse(
					row.productionEvidencePolicy
				),
				rightsEvidencePolicy: rightsEvidencePolicySchema.parse(
					row.rightsEvidencePolicy
				),
				runtimeValidationCriterion: runtimeValidationCriterionSchema
					.nullable()
					.parse(row.runtimeValidationCriterion),
				createdAt: date(row.createdAt),
			})),
			(batch) => tx.insert(deliveryTargetDrafts).values(batch)
		);
	}
	const draftFamilies = delivery.deliveryTargetDrafts.flatMap((draft) =>
		draft.families.map((row) => ({ ...row, projectId, draftId: draft.id }))
	);
	if (draftFamilies.length) {
		await insertBatches(draftFamilies, (batch) =>
			tx.insert(deliveryTargetDraftFamilies).values(batch)
		);
	}
	if (delivery.deliveryTargetRevisions.length) {
		await insertBatches(
			delivery.deliveryTargetRevisions.map((row) => ({
				...row,
				projectId,
				activatedByUserId: createdByUserId,
				activatedAt: date(row.activatedAt),
			})),
			(batch) => tx.insert(deliveryTargetRevisions).values(batch)
		);
	}
	if (delivery.exportBundles.length) {
		await insertBatches(
			await Promise.all(
				delivery.exportBundles.map(async ({ files: _files, ...row }) => ({
					...row,
					...identity,
					requestDigest: await requestDigest(restoreId, "bundle", row.id),
					createdAt: date(row.createdAt),
				}))
			),
			(batch) => tx.insert(exportBundles).values(batch)
		);
	}
	const bundleFiles = delivery.exportBundles.flatMap((bundle) =>
		bundle.files.map((file) => ({ ...file, bundleId: bundle.id }))
	);
	if (bundleFiles.length) {
		await insertBatches(bundleFiles, (batch) =>
			tx.insert(exportBundleFiles).values(batch)
		);
	}
	if (delivery.exportBundleMarkers.length) {
		await insertBatches(
			delivery.exportBundleMarkers.map((row) => ({
				projectId,
				bundleId: row.bundleId,
				updatedAt: date(row.updatedAt),
			})),
			(batch) => tx.insert(exportBundleMarkers).values(batch)
		);
	}
	if (delivery.deliveryRefreshLocks.length) {
		await insertBatches(
			await Promise.all(
				delivery.deliveryRefreshLocks.map(
					async ({ files: _files, ...row }) => ({
						...row,
						...identity,
						requestDigest: await requestDigest(restoreId, "lock", row.id),
						createdAt: date(row.createdAt),
					})
				)
			),
			(batch) => tx.insert(deliveryRefreshLocks).values(batch)
		);
	}
	const lockFiles = delivery.deliveryRefreshLocks.flatMap((lock) =>
		lock.files.map((file) => ({ ...file, lockId: lock.id }))
	);
	if (lockFiles.length) {
		await insertBatches(lockFiles, (batch) =>
			tx.insert(deliveryRefreshLockFiles).values(batch)
		);
	}
	if (delivery.deliveryFulfilments.length) {
		await insertBatches(
			await Promise.all(
				delivery.deliveryFulfilments.map(
					async ({ requirements: _requirements, ...row }) => ({
						...row,
						...identity,
						requestDigest: await requestDigest(restoreId, "fulfilment", row.id),
						createdAt: date(row.createdAt),
					})
				)
			),
			(batch) => tx.insert(deliveryFulfilments).values(batch)
		);
	}
	const requirements = await Promise.all(
		delivery.deliveryFulfilments.flatMap((fulfilment) =>
			fulfilment.requirements.map(async (row) => ({
				...row,
				projectId,
				fulfilmentId: fulfilment.id,
				id: await restoredRecordId(
					restoreId,
					`fulfilment:${fulfilment.id}:${row.position}`
				),
			}))
		)
	);
	if (requirements.length) {
		await insertBatches(requirements, (batch) =>
			tx.insert(deliveryFulfilmentRequirements).values(batch)
		);
	}
	if (delivery.historicalRiskNotices.length) {
		await insertBatches(
			delivery.historicalRiskNotices.map((row) => ({
				...row,
				projectId,
				pinnedPolicy: row.pinnedPolicy,
				pinnedRights: row.pinnedRights,
				detectedAt: date(row.detectedAt),
			})),
			(batch) => tx.insert(historicalRiskNotices).values(batch)
		);
	}
	if (delivery.runtimeValidations.length) {
		await insertBatches(
			await Promise.all(
				delivery.runtimeValidations.map(
					async ({ evidence: _evidence, decisions: _decisions, ...row }) => ({
						...row,
						...identity,
						requestDigest: await requestDigest(restoreId, "validation", row.id),
						createdAt: date(row.createdAt),
					})
				)
			),
			(batch) => tx.insert(runtimeValidationRecords).values(batch)
		);
	}
	const evidenceRows = await Promise.all(
		delivery.runtimeValidations.flatMap((validation) =>
			validation.evidence.map(async ({ file, ...row }) => {
				const restored = record.files.find(
					(item) =>
						item.kind === "runtime_evidence_file" && item.restoredId === row.id
				);
				if (
					file &&
					(!restored ||
						(restored.presence === "included" && !restored.objectKey))
				) {
					throw new Error(
						"Archive Runtime Validation evidence file was not copied"
					);
				}
				return {
					...row,
					...identity,
					recordId: validation.id,
					fileName: file?.fileName ?? null,
					byteSize: file?.byteSize ?? null,
					sha256: file?.sha256 ?? null,
					objectKey: restored?.objectKey ?? null,
					requestDigest: await requestDigest(
						restoreId,
						"runtime-evidence",
						row.id
					),
					createdAt: date(row.createdAt),
				};
			})
		)
	);
	if (evidenceRows.length) {
		await insertBatches(evidenceRows, (batch) =>
			tx.insert(runtimeValidationEvidence).values(batch)
		);
	}
	const orderedDecisions = delivery.runtimeValidations
		.flatMap((validation) =>
			validation.decisions.map((decision) => ({
				decision,
				recordId: validation.id,
			}))
		)
		.sort((a, b) => a.decision.sequence - b.decision.sequence);
	const decisions = await Promise.all(
		orderedDecisions.map(
			async ({ decision: { sequence: _sequence, ...row }, recordId }) => ({
				...row,
				projectId,
				recordId,
				decidedByUserId: createdByUserId,
				requestDigest: await requestDigest(
					restoreId,
					"runtime-decision",
					row.id
				),
				createdAt: date(row.createdAt),
			})
		)
	);

	if (decisions.length) {
		await insertBatches(decisions, (batch) =>
			tx.insert(runtimeValidationDecisions).values(batch)
		);
	}
}

export function archiveDeliveryDeleteQueries(
	db: Pick<Database, "delete">,
	projectId: string
) {
	const tables = [
		runtimeValidationEvidence,
		runtimeValidationRecords,
		historicalRiskNotices,
		deliveryFulfilmentRequirements,
		deliveryFulfilments,
		deliveryRefreshLocks,
		exportBundles,
		deliveryTargetDraftFamilies,
		deliveryTargetRevisions,
		deliveryTargetDrafts,
		deliveryTargets,
		exportProfileRevisions,
		exportProfiles,
	];
	return [
		db
			.delete(runtimeValidationDecisions)
			.where(eq(runtimeValidationDecisions.projectId, projectId)),
		...tables.map((table) =>
			db.delete(table).where(eq(table.projectId, projectId))
		),
	] as const;
}
