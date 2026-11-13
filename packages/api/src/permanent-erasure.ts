import { z } from "zod";
import { recordContentDigest } from "./record-content-digest";
import { idempotencyKeySchema } from "./record-publication";

/**
 * The full contract version of an Erasure Impact Report. A reader accepts only
 * the major it knows; a newer major or an unknown field never starts a deletion.
 */
export const erasureImpactContractVersion = "erasure-impact-report/1.0.0";

const supportedMajor = 1;
const contractVersionPattern = /^erasure-impact-report\/(\d+)\.(\d+)\.(\d+)$/;

export type ErasureContractSupport =
	| { status: "supported" }
	| { status: "unsupported_major"; major: number }
	| { status: "malformed" };

/** Whether this build can read a report written under `version`. */
export function erasureContractSupport(
	version: string
): ErasureContractSupport {
	const match = contractVersionPattern.exec(version);
	if (!match) {
		return { status: "malformed" };
	}
	const major = Number(match[1]);
	return major === supportedMajor
		? { status: "supported" }
		: { major, status: "unsupported_major" };
}

export const uuidSchema = z.uuid();
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
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

const managedCopySchema = z
	.object({
		assetVersionId: z.string().min(1),
		byteSize: z.number().int().positive(),
		contentType: z.string(),
		fileName: z.string().nullable(),
		sha256: sha256Schema,
	})
	.strict();

/** A whole immutable container that embeds content of the asset. It is removed whole or stays; never rewritten. */
const containerSchema = z
	.object({
		embeddedAssetVersionIds: z.array(z.string().min(1)).min(1),
		embeddedFileCount: z.number().int().positive(),
		id: z.string().min(1),
		kind: z.enum(["export_bundle", "project_archive"]),
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

export const erasureImpactScopeSchema = z
	.object({
		backup: backupSchema,
		containers: z.array(containerSchema),
		contractVersion: z.string().min(1),
		counts: z
			.object({
				archives: countSchema,
				bundles: countSchema,
				containerFiles: countSchema,
				fulfilments: countSchema,
				managedCopies: countSchema,
			})
			.strict(),
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

// ---------------------------------------------------------------------------
// Source and building
// ---------------------------------------------------------------------------

/** The persisted records one asset's Erasure Impact Report is built from. */
export interface ErasureImpactSource {
	/** Project Archives that list any file of the asset's versions. */
	archives: {
		files: {
			assetVersionId: string | null;
			kind: string;
			presence: "included" | "excluded";
			sourceId: string;
		}[];
		id: string;
		manifestDigest: string;
	}[];
	assetRecord: { availability: string; id: string };
	/** Export Bundles that list any file of the asset's versions. */
	bundles: {
		files: { assetVersionId: string | null; path: string }[];
		id: string;
		manifestDigest: string;
	}[];
	/** Delivery Fulfilments whose requirements pin the asset's versions or use a listed bundle. */
	fulfilments: {
		deliveryTargetId: string;
		id: string;
		requirements: { assetVersionIds: string[]; bundleId: string }[];
		revisionNumber: number;
	}[];
	versions: {
		byteSize: number;
		contentType: string;
		fileName: string | null;
		id: string;
		sha256: string | null;
	}[];
}

export type ErasureImpactRejection =
	| { reason: "already_erased" }
	| { reason: "no_managed_copies" }
	| { assetVersionIds: string[]; reason: "copy_digest_missing" };

export type BuildErasureImpactResult =
	| { ok: true; scope: ErasureImpactScope }
	| ({ ok: false } & ErasureImpactRejection);

export interface RetentionSchedule {
	purgeWindowDays: number;
	version: string;
}

function byText(left: string, right: string) {
	return Number(left > right) - Number(left < right);
}

function byId<T extends { id: string }>(left: T, right: T) {
	return Number(left.id > right.id) - Number(left.id < right.id);
}

/** Builds the exact scope of erasing one asset: its copies, the whole containers holding them, and the fulfilments they touch. */
export function buildErasureImpactScope(
	source: ErasureImpactSource,
	options: { projectId: string; retention: RetentionSchedule | null }
): BuildErasureImpactResult {
	if (source.assetRecord.availability === "erased") {
		return { ok: false, reason: "already_erased" };
	}
	if (source.versions.length === 0) {
		return { ok: false, reason: "no_managed_copies" };
	}
	const unverifiable = source.versions
		.filter((version) => version.sha256 === null)
		.map((version) => version.id)
		.sort(byText);
	if (unverifiable.length > 0) {
		return {
			assetVersionIds: unverifiable,
			ok: false,
			reason: "copy_digest_missing",
		};
	}
	const targetIds = new Set(source.versions.map((version) => version.id));
	const embedded = (ids: readonly (string | null)[]) =>
		[...new Set(ids.filter((id): id is string => id !== null))]
			.filter((id) => targetIds.has(id))
			.sort(byText);

	const containers: ErasureImpactScope["containers"] = [];
	for (const bundle of source.bundles) {
		const files = bundle.files.filter(
			(file) =>
				file.assetVersionId !== null && targetIds.has(file.assetVersionId)
		);
		if (files.length > 0) {
			containers.push({
				embeddedAssetVersionIds: embedded(
					files.map((file) => file.assetVersionId)
				),
				embeddedFileCount: files.length,
				id: bundle.id,
				kind: "export_bundle",
				manifestDigest: bundle.manifestDigest,
				removal: "whole",
			});
		}
	}
	const bundleContainers = containers.sort(byId);
	const archiveContainers: ErasureImpactScope["containers"] = [];
	for (const archive of source.archives) {
		const files = archive.files.filter(
			(file) =>
				file.presence === "included" &&
				file.assetVersionId !== null &&
				targetIds.has(file.assetVersionId)
		);
		if (files.length > 0) {
			archiveContainers.push({
				embeddedAssetVersionIds: embedded(
					files.map((file) => file.assetVersionId)
				),
				embeddedFileCount: files.length,
				id: archive.id,
				kind: "project_archive",
				manifestDigest: archive.manifestDigest,
				removal: "whole",
			});
		}
	}
	archiveContainers.sort(byId);

	const containerBundleIds = new Set(
		bundleContainers.map((bundle) => bundle.id)
	);
	const fulfilments: ErasureImpactScope["fulfilments"] = [];
	for (const fulfilment of source.fulfilments) {
		const touching = fulfilment.requirements.filter(
			(requirement) =>
				requirement.assetVersionIds.some((id) => targetIds.has(id)) ||
				containerBundleIds.has(requirement.bundleId)
		);
		if (touching.length > 0) {
			fulfilments.push({
				bundleIds: [...new Set(touching.map((entry) => entry.bundleId))].sort(
					byText
				),
				deliveryTargetId: fulfilment.deliveryTargetId,
				id: fulfilment.id,
				pinsErasedVersions: touching.some((requirement) =>
					requirement.assetVersionIds.some((id) => targetIds.has(id))
				),
				revisionNumber: fulfilment.revisionNumber,
			});
		}
	}
	fulfilments.sort(byId);

	const allContainers = [...bundleContainers, ...archiveContainers];
	const managedCopies = source.versions
		.map((version) => ({
			assetVersionId: version.id,
			byteSize: version.byteSize,
			contentType: version.contentType,
			fileName: version.fileName,
			sha256: version.sha256 as string,
		}))
		.sort(
			(left, right) =>
				Number(left.assetVersionId > right.assetVersionId) -
				Number(left.assetVersionId < right.assetVersionId)
		);

	return {
		ok: true,
		scope: {
			backup: options.retention
				? {
						purgeWindowDays: options.retention.purgeWindowDays,
						retentionScheduleVersion: options.retention.version,
						status: "scheduled",
					}
				: { status: "unpublished" },
			containers: allContainers,
			contractVersion: erasureImpactContractVersion,
			counts: {
				archives: archiveContainers.length,
				bundles: bundleContainers.length,
				containerFiles: allContainers.reduce(
					(sum, container) => sum + container.embeddedFileCount,
					0
				),
				fulfilments: fulfilments.length,
				managedCopies: managedCopies.length,
			},
			externalCopies: {
				recallable: false,
				statement: externalCopiesStatement,
			},
			fulfilments,
			managedCopies,
			projectId: options.projectId,
			target: { assetRecordId: source.assetRecord.id },
		},
	};
}
