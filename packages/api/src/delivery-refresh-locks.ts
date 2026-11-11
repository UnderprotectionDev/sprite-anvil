import { z } from "zod";
import {
	deliveryPathDigestSchema,
	deliveryRelativePathSchema,
} from "./delivery-path-schemas";
import {
	deliveryRefreshDecisionSchema,
	deliveryRefreshPathClasses,
} from "./delivery-refresh-classification";
import { sha256Schema } from "./export-bundle-manifest";
import { idempotencyKeySchema } from "./record-publication";

const idSchema = z.uuid();

/** The Delivery Refresh Lock contract version this build writes; an unknown major stops use of a lock. */
export const deliveryRefreshLockContractVersion = "1.0.0";

const windowsDrivePattern = /^[a-zA-Z]:/;

/** A human label for the destination. It names the folder for the user and is never a local path. */
export const deliveryDestinationLabelSchema = z
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
		destinationLabel: deliveryDestinationLabelSchema,
		idempotencyKey: idempotencyKeySchema,
		projectId: idSchema,
		written: z.array(deliveryPathDigestSchema).min(1).max(5000),
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

/**
 * What a surface reports for a user-started refresh of one destination: the state it
 * observed in the owned and bundle paths before writing, the user's decisions on diverged
 * paths, and the relative path and SHA-256 of every file it then wrote. `previousLockId`
 * is the lock the user chose for the destination; the destination has no other identity.
 * The server re-classifies the observation itself and verifies the report against it.
 */
export const deliveryRefreshLockRefreshInputSchema = z
	.object({
		bundleId: idSchema,
		decisions: z.array(deliveryRefreshDecisionSchema).max(5000),
		idempotencyKey: idempotencyKeySchema,
		observed: z
			.array(
				z
					.object({
						path: deliveryRelativePathSchema,
						sha256: sha256Schema.nullable(),
					})
					.strict()
			)
			.max(10_000),
		previousLockId: idSchema,
		projectId: idSchema,
		written: z.array(deliveryPathDigestSchema).max(5000),
	})
	.strict();
export type DeliveryRefreshLockRefreshInput = z.infer<
	typeof deliveryRefreshLockRefreshInputSchema
>;

const divergedPathSchema = z.object({
	class: z.enum(deliveryRefreshPathClasses),
	lockSha256: sha256Schema.nullable(),
	nextSha256: sha256Schema.nullable(),
	path: z.string(),
	targetSha256: sha256Schema.nullable(),
});

const heldPathSchema = z.object({
	decision: z.enum(["preserve", "other_destination"]),
	path: z.string(),
});

/**
 * A refresh either made a new lock, or halted on diverged paths that still wait for a
 * decision. Applied paths and halted divergences are always listed apart, and a halted or
 * partial refresh is never a completed delivery.
 */
export const deliveryRefreshLockRefreshResultSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			applied: z.array(z.string()),
			lock: deliveryRefreshLockSchema,
			/** `partial` when the user kept diverged paths out of the new lock. */
			outcome: z.enum(["complete", "partial"]),
			preserved: z.array(heldPathSchema),
			status: z.enum(["created", "replayed"]),
		}),
		z.object({
			applied: z.array(z.string()),
			halted: z.array(divergedPathSchema).min(1),
			preserved: z.array(heldPathSchema),
			status: z.literal("halted"),
		}),
	]
);
export type DeliveryRefreshLockRefreshResult = z.infer<
	typeof deliveryRefreshLockRefreshResultSchema
>;
