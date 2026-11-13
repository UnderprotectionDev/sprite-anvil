import { z } from "zod";
import { contractVersionSupport } from "./contract-version";
import { sha256Schema } from "./export-bundle-manifest";
import {
	type ErasureImpactScope,
	erasureContainerRefSchema,
	erasureCountsSchema,
	externalCopiesStatement,
	uuidSchema,
} from "./permanent-erasure";
import { recordContentDigest } from "./record-content-digest";
import { idempotencyKeySchema } from "./record-publication";

/**
 * The full contract version of a Deletion Receipt. A reader accepts only the
 * major it knows; a receipt of a newer major is never read as valid.
 */
export const deletionReceiptContractVersion = "deletion-receipt/1.0.0";

/** Whether this build can read a receipt written under `version`. */
export function deletionReceiptContractSupport(version: string) {
	return contractVersionSupport(version, {
		name: "deletion-receipt",
		supportedMajor: 1,
	});
}

/** The exact counts the user confirms against the exact report: the same counts the report shows. */
export const erasureConfirmedCountsSchema = erasureCountsSchema;
export type ErasureConfirmedCounts = z.infer<
	typeof erasureConfirmedCountsSchema
>;

/**
 * The user's explicit approval of one exact Erasure Impact Report. It names
 * the report digest, the whole containers selected, the counts shown, and the
 * two consequences the user must accept; an approval of another digest never
 * counts. Only a signed-in user acts here: no agent or automation input
 * can stand in for it.
 */
export const erasureApprovalInputSchema = z
	.object({
		acknowledgements: z
			.object({
				externalCopiesRemain: z.literal(true),
				irreversible: z.literal(true),
			})
			.strict(),
		confirmed: erasureConfirmedCountsSchema,
		idempotencyKey: idempotencyKeySchema,
		projectId: uuidSchema,
		reportDigest: sha256Schema,
		reportId: uuidSchema,
		/** May be empty: a container left out of the selection stays out of scope and keeps its content. */
		selectedContainerIds: z.array(z.string().min(1)),
	})
	.strict();
export type ErasureApprovalInput = z.infer<typeof erasureApprovalInputSchema>;

export const deletionReceiptGetInputSchema = z
	.object({ projectId: uuidSchema, receiptId: uuidSchema })
	.strict();

/** The counts of what a selection removes, derived from the exact report. */
export function selectedErasureCounts(
	scope: ErasureImpactScope,
	selectedContainerIds: readonly string[]
): ErasureConfirmedCounts {
	const selected = scope.containers.filter((container) =>
		selectedContainerIds.includes(container.id)
	);
	return {
		archives: selected.filter((entry) => entry.kind === "project_archive")
			.length,
		bundles: selected.filter((entry) => entry.kind === "export_bundle").length,
		containerFiles: selected.reduce(
			(sum, entry) => sum + entry.embeddedFileCount,
			0
		),
		fulfilments: scope.fulfilments.length,
		managedCopies: scope.managedCopies.length,
	};
}

/** Whether every count the user confirmed equals what the selection removes under the exact report. */
export function confirmedCountsMatch(
	scope: ErasureImpactScope,
	selectedContainerIds: readonly string[],
	confirmed: ErasureConfirmedCounts
) {
	const expected = selectedErasureCounts(scope, selectedContainerIds);
	return (Object.keys(expected) as (keyof ErasureConfirmedCounts)[]).every(
		(key) => expected[key] === confirmed[key]
	);
}

/** The selected ids that name no container of the exact report. */
export function unknownErasureContainerIds(
	scope: ErasureImpactScope,
	selectedContainerIds: readonly string[]
) {
	const known = new Set(scope.containers.map((container) => container.id));
	return selectedContainerIds.filter((id) => !known.has(id));
}

export function erasureApprovalRequestDigest(input: ErasureApprovalInput) {
	return recordContentDigest({
		confirmed: input.confirmed,
		projectId: input.projectId,
		reportDigest: input.reportDigest,
		reportId: input.reportId,
		selectedContainerIds: [...input.selectedContainerIds].sort(),
	});
}

export type ErasureApprovalRejection =
	/** The current scope no longer matches the report the user approved, or the digest given is not the report's. */
	| { reason: "report_changed" }
	| { reason: "report_not_found" }
	/** The stored report cannot be read or verified by this build. */
	| { reason: "report_unreadable" }
	| { reason: "counts_mismatch" }
	| { reason: "unknown_container"; containerIds: string[] };

export type ErasureApprovalResult<Operation> =
	| { operation: Operation; status: "accepted" }
	| ({ status: "rejected" } & ErasureApprovalRejection);

const receiptContainerSchema = erasureContainerRefSchema
	.extend({ manifestDigest: sha256Schema })
	.strict();

const receiptBackupSchema = z.discriminatedUnion("status", [
	z
		.object({
			purgeDueAt: z.iso.datetime(),
			purgeWindowDays: z.number().int().positive(),
			retentionScheduleVersion: z.string().min(1),
			status: z.literal("scheduled"),
			/** Backup clean-up is confirmed by an operational check outside this system, not by this receipt. */
			verification: z.literal("operational_check_pending"),
		})
		.strict(),
	z.object({ status: z.literal("unpublished") }).strict(),
]);

/**
 * Content-free proof of one completed Deletion Job: who, which operation,
 * which exact report, what was removed by identity and digest, and what
 * remains. It never carries file names, storage locations or content.
 */
export const deletionReceiptSchema = z
	.object({
		approvalId: z.string().min(1),
		approvedAt: z.iso.datetime(),
		backup: receiptBackupSchema,
		completedAt: z.iso.datetime(),
		contractVersion: z.string().min(1),
		counts: erasureConfirmedCountsSchema,
		erased: z
			.object({
				assetVersionIds: z.array(z.string().min(1)).min(1),
				containers: z.array(receiptContainerSchema),
			})
			.strict(),
		externalCopies: z
			.object({ recallable: z.literal(false), statement: z.string().min(1) })
			.strict(),
		id: z.string().min(1),
		operationId: z.string().min(1),
		projectId: z.string().min(1),
		/** Whole containers outside the selection: they still hold the content they embed. */
		remainingContainers: z.array(erasureContainerRefSchema),
		reportDigest: sha256Schema,
		reportId: z.string().min(1),
		requestedByUserId: z.string().min(1),
		targetAssetRecordId: z.string().min(1),
		/** Fulfilments that pinned an erased version; they stay as content-free records and can no longer be verified. */
		unverifiableFulfilmentIds: z.array(z.string().min(1)),
	})
	.strict();
export type DeletionReceipt = z.infer<typeof deletionReceiptSchema>;

export const deletionReceiptRecordSchema = deletionReceiptSchema
	.extend({ receiptDigest: sha256Schema })
	.strict();
export type DeletionReceiptRecord = z.infer<typeof deletionReceiptRecordSchema>;

export function deletionReceiptDigest(receipt: DeletionReceipt) {
	return recordContentDigest(receipt);
}

const dayMs = 86_400_000;

/** Builds the content-free receipt for a completed deletion from the exact approved scope. */
export function buildDeletionReceipt(input: {
	approval: {
		approvedAt: Date;
		approvedByUserId: string;
		id: string;
		reportId: string;
		selectedContainerIds: readonly string[];
	};
	completedAt: Date;
	operationId: string;
	reportDigest: string;
	scope: ErasureImpactScope;
}): DeletionReceipt {
	const { approval, completedAt, scope } = input;
	const selected = scope.containers.filter((container) =>
		approval.selectedContainerIds.includes(container.id)
	);
	const remaining = scope.containers.filter(
		(container) => !approval.selectedContainerIds.includes(container.id)
	);
	return {
		approvalId: approval.id,
		approvedAt: approval.approvedAt.toISOString(),
		backup:
			scope.backup.status === "scheduled"
				? {
						purgeDueAt: new Date(
							completedAt.getTime() + scope.backup.purgeWindowDays * dayMs
						).toISOString(),
						purgeWindowDays: scope.backup.purgeWindowDays,
						retentionScheduleVersion: scope.backup.retentionScheduleVersion,
						status: "scheduled",
						verification: "operational_check_pending",
					}
				: { status: "unpublished" },
		completedAt: completedAt.toISOString(),
		contractVersion: deletionReceiptContractVersion,
		counts: selectedErasureCounts(scope, approval.selectedContainerIds),
		erased: {
			assetVersionIds: scope.managedCopies.map((copy) => copy.assetVersionId),
			containers: selected.map((container) => ({
				id: container.id,
				kind: container.kind,
				manifestDigest: container.manifestDigest,
			})),
		},
		externalCopies: {
			recallable: false,
			statement: externalCopiesStatement,
		},
		id: approval.id,
		operationId: input.operationId,
		projectId: scope.projectId,
		remainingContainers: remaining.map((container) => ({
			id: container.id,
			kind: container.kind,
		})),
		reportDigest: input.reportDigest,
		reportId: approval.reportId,
		requestedByUserId: approval.approvedByUserId,
		targetAssetRecordId: scope.target.assetRecordId,
		unverifiableFulfilmentIds: scope.fulfilments
			.filter((fulfilment) => fulfilment.pinsErasedVersions)
			.map((fulfilment) => fulfilment.id),
	};
}
