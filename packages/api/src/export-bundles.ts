import { z } from "zod";
import { exportBundleManifestSchema } from "./export-bundle-manifest";
import { idempotencyKeySchema } from "./record-publication";

const idSchema = z.uuid();

export const exportBundleListInputSchema = z
	.object({ projectId: idSchema })
	.strict();

export const exportBundleGetInputSchema = z
	.object({ bundleId: idSchema, projectId: idSchema })
	.strict();

/**
 * Starts one Export Bundle. Starting a bundle is a user decision; the same
 * `idempotencyKey` replays the first bundle and never creates a second one.
 */
export const exportBundleCreateInputSchema = z
	.object({
		/** Verified Engine Adapter version, when one applies. */
		adapterVersion: z.string().trim().min(1).max(64).nullable().default(null),
		/** Asset Families whose active Required Set the bundle covers. */
		assetFamilyIds: z
			.array(idSchema)
			.min(1)
			.max(50)
			.refine(
				(ids) => new Set(ids).size === ids.length,
				"An Asset Family can be selected only once."
			),
		/** Delivery Target revision the bundle fulfils, when it is started for one. */
		deliveryTargetRevisionId: idSchema.nullable().default(null),
		idempotencyKey: idempotencyKeySchema,
		profileRevisionId: idSchema,
		projectId: idSchema,
	})
	.strict();
export type ExportBundleCreateInput = z.infer<
	typeof exportBundleCreateInputSchema
>;

export const exportBundleFileSchema = z.object({
	assetVersionId: z.string().nullable(),
	byteSize: z.number().int().positive(),
	/** Text of a generated file (manifest, checksums); null for an asset file kept in storage. */
	content: z.string().nullable(),
	path: z.string(),
	sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export const exportBundleSummarySchema = z.object({
	adapterVersion: z.string().nullable(),
	contextRevisionId: z.string(),
	contractVersion: z.string(),
	createdAt: z.iso.datetime(),
	deliveryTargetRevisionId: z.string().nullable(),
	id: idSchema,
	/** The movable latest-bundle marker points at exactly this bundle. */
	isLatest: z.boolean(),
	manifestDigest: z.string().regex(/^[0-9a-f]{64}$/),
	profileId: z.string(),
	profileRevisionId: z.string(),
});
export type ExportBundleSummary = z.infer<typeof exportBundleSummarySchema>;

/** A bundle re-read from its persisted record, manifest and files included. */
export const exportBundleSchema = exportBundleSummarySchema.extend({
	files: z.array(exportBundleFileSchema),
	manifest: exportBundleManifestSchema,
});
export type ExportBundle = z.infer<typeof exportBundleSchema>;

export const exportBundleCatalogSchema = z.object({
	bundles: z.array(exportBundleSummarySchema),
	/** Mutable marker; the bundles it points at are immutable. */
	latestBundleId: z.string().nullable(),
});
export type ExportBundleCatalog = z.infer<typeof exportBundleCatalogSchema>;
