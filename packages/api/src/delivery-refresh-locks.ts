import { z } from "zod";
import { sha256Schema } from "./export-bundle-manifest";
import { idempotencyKeySchema } from "./record-publication";

const idSchema = z.uuid();

/** The Delivery Refresh Lock contract version this build writes; an unknown major stops use of a lock. */
export const deliveryRefreshLockContractVersion = "1.0.0";
export const supportedDeliveryRefreshLockContractMajor = 1;

const windowsDrivePattern = /^[a-zA-Z]:/;

/** A relative, forward-slash path inside the delivery destination; never absolute and never leaving it. */
export const deliveryRelativePathSchema = z
	.string()
	.min(1)
	.max(512)
	.refine(
		(path) =>
			!(
				path.startsWith("/") ||
				path.startsWith("~") ||
				path.includes("\\") ||
				windowsDrivePattern.test(path) ||
				path
					.split("/")
					.some((part) => part === "" || part === "." || part === "..")
			),
		"A path must be relative to the delivery destination."
	);

/** A human label for the destination. It names the folder for the user and is never a local path. */
const destinationLabelSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.refine(
		(label) =>
			!(
				label.startsWith("/") ||
				label.startsWith("~") ||
				label.includes("\\") ||
				label.includes("..") ||
				windowsDrivePattern.test(label)
			),
		"The destination label must be a name, not a local path."
	);

export const deliveryRefreshLockListInputSchema = z
	.object({ projectId: idSchema })
	.strict();

export const deliveryRefreshLockGetInputSchema = z
	.object({ lockId: idSchema, projectId: idSchema })
	.strict();

/**
 * What a surface reports after it wrote an Export Bundle to a destination: the
 * relative path and SHA-256 of every file it wrote. Applying is a user decision;
 * the same `idempotencyKey` replays the first lock and never creates a second one.
 */
export const deliveryRefreshLockApplyInputSchema = z
	.object({
		bundleId: idSchema,
		destinationLabel: destinationLabelSchema,
		idempotencyKey: idempotencyKeySchema,
		projectId: idSchema,
		written: z
			.array(
				z
					.object({ path: deliveryRelativePathSchema, sha256: sha256Schema })
					.strict()
			)
			.min(1)
			.max(5000),
	})
	.strict();
export type DeliveryRefreshLockApplyInput = z.infer<
	typeof deliveryRefreshLockApplyInputSchema
>;

export const deliveryRefreshLockFileSchema = z.object({
	byteSize: z.number().int().positive(),
	path: deliveryRelativePathSchema,
	sha256: sha256Schema,
});

export const deliveryRefreshLockSummarySchema = z.object({
	bundleId: idSchema,
	bundleManifestDigest: sha256Schema,
	contractVersion: z.string(),
	createdAt: z.iso.datetime(),
	destinationLabel: z.string(),
	id: idSchema,
	lockDigest: sha256Schema,
	profile: z.object({
		contentDigest: sha256Schema,
		profileId: z.string(),
		revisionId: z.string(),
		revisionNumber: z.number().int().positive(),
	}),
});

/** A lock re-read from its persisted record: the owned paths and their digests. */
export const deliveryRefreshLockSchema =
	deliveryRefreshLockSummarySchema.extend({
		files: z.array(deliveryRefreshLockFileSchema).min(1),
	});
export type DeliveryRefreshLock = z.infer<typeof deliveryRefreshLockSchema>;

export const deliveryRefreshLockCatalogSchema = z.object({
	locks: z.array(deliveryRefreshLockSummarySchema),
});
export type DeliveryRefreshLockCatalog = z.infer<
	typeof deliveryRefreshLockCatalogSchema
>;
