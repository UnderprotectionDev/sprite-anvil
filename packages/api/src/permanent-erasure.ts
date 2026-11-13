import { z } from "zod";
import { contractVersionSupport } from "./contract-version";
import { sha256Schema } from "./export-bundle-manifest";
import { recordContentDigest } from "./record-content-digest";
import { idempotencyKeySchema } from "./record-publication";

/**
 * The full contract version of an Erasure Impact Report. A reader accepts only
 * the major it knows; a newer major or an unknown field never starts a deletion.
 */
export const erasureImpactContractVersion = "erasure-impact-report/1.0.0";

/** Whether this build can read a report written under `version`. */
export function erasureContractSupport(version: string) {
	return contractVersionSupport(version, {
		name: "erasure-impact-report",
		supportedMajor: 1,
	});
}

export const uuidSchema = z.uuid();
export const countSchema = z.number().int().nonnegative();

export const erasureImpactPrepareInputSchema = z
	.object({
		assetRecordId: uuidSchema,
		idempotencyKey: idempotencyKeySchema,
		projectId: uuidSchema,
	})
	.strict();
export type ErasureImpactPrepareInput = z.infer<
	typeof erasureImpactPrepareInputSchema
>;

export const erasureImpactGetInputSchema = z
	.object({ projectId: uuidSchema, reportId: uuidSchema })
	.strict();

/**
 * One copy in managed storage, by identity, size and digest only. A file name
 * is not kept: the report outlives the erasure and carries no content.
 */
const managedCopySchema = z
	.object({
		assetVersionId: z.string().min(1),
		byteSize: z.number().int().positive(),
		sha256: sha256Schema,
	})
	.strict();

export const erasureContainerKindSchema = z.enum([
	"export_bundle",
	"project_archive",
]);
export type ErasureContainerKind = z.infer<typeof erasureContainerKindSchema>;

/** A whole immutable container named by identity. */
export const erasureContainerRefSchema = z
	.object({ id: z.string().min(1), kind: erasureContainerKindSchema })
	.strict();
export type ErasureContainerRef = z.infer<typeof erasureContainerRefSchema>;

/** A whole immutable container that embeds content of the asset. It is removed whole or stays; never rewritten. */
const containerSchema = erasureContainerRefSchema
	.extend({
		embeddedAssetVersionIds: z.array(z.string().min(1)).min(1),
		embeddedFileCount: z.number().int().positive(),
		manifestDigest: sha256Schema,
		/** Selecting the container removes all of it; it is never partially rewritten. */
		removal: z.literal("whole"),
	})
	.strict();

const fulfilmentImpactSchema = z
	.object({
		bundleIds: z.array(z.string().min(1)),
		deliveryTargetId: z.string().min(1),
		id: z.string().min(1),
		/** True when the fulfilment pins an erased version, so it can no longer be verified. */
		pinsErasedVersions: z.boolean(),
		revisionNumber: z.number().int().positive(),
	})
	.strict();

const backupSchema = z.discriminatedUnion("status", [
	z
		.object({
			purgeWindowDays: z.number().int().positive(),
			retentionScheduleVersion: z.string().min(1),
			status: z.literal("scheduled"),
		})
		.strict(),
	/** No published retention schedule: no backup clean-up time is claimed. */
	z.object({ status: z.literal("unpublished") }).strict(),
]);

/** The counts of what an erasure touches; the user confirms exactly these against the exact report. */
export const erasureCountsSchema = z
	.object({
		archives: countSchema,
		bundles: countSchema,
		containerFiles: countSchema,
		fulfilments: countSchema,
		managedCopies: countSchema,
	})
	.strict();
export type ErasureCounts = z.infer<typeof erasureCountsSchema>;

export const erasureImpactScopeSchema = z
	.object({
		backup: backupSchema,
		containers: z.array(containerSchema),
		contractVersion: z.string().min(1),
		counts: erasureCountsSchema,
		/** Copies outside managed storage are never recalled and never claimed as removed. */
		externalCopies: z
			.object({ recallable: z.literal(false), statement: z.string().min(1) })
			.strict(),
		fulfilments: z.array(fulfilmentImpactSchema),
		managedCopies: z.array(managedCopySchema),
		projectId: z.string().min(1),
		target: z.object({ assetRecordId: z.string().min(1) }).strict(),
	})
	.strict();
export type ErasureImpactScope = z.infer<typeof erasureImpactScopeSchema>;

export const erasureImpactReportSchema = erasureImpactScopeSchema
	.extend({
		createdAt: z.iso.datetime(),
		id: z.string().min(1),
		reportDigest: sha256Schema,
	})
	.strict();
export type ErasureImpactReport = z.infer<typeof erasureImpactReportSchema>;

export const erasureImpactPrepareOutputSchema = z
	.object({
		report: erasureImpactReportSchema,
		status: z.enum(["created", "replayed"]),
	})
	.strict();

export const externalCopiesStatement =
	"Copies outside managed storage, such as downloaded files or delivered game folders, cannot be recalled and stay as they are.";

/** Digest of the exact scope, so an approval can be tied to it and any change invalidates the approval. */
export function erasureImpactDigest(scope: ErasureImpactScope) {
	return recordContentDigest(scope);
}

export function erasureImpactRequestDigest(input: {
	assetRecordId: string;
	projectId: string;
}) {
	return recordContentDigest({
		assetRecordId: input.assetRecordId,
		projectId: input.projectId,
	});
}
