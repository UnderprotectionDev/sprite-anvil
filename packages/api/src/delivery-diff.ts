import { z } from "zod";
import { idSchema } from "./delivery-fulfilment-shared";
import { requiredSetItemKindSchema } from "./family-readiness";

/**
 * Compares two Delivery Fulfilments of one project, `from` against `to`. It
 * reads only; it creates no Fulfilment and changes no Delivered status.
 */
export const deliveryDiffInputSchema = z
	.object({
		fromFulfilmentId: idSchema,
		projectId: idSchema,
		toFulfilmentId: idSchema,
	})
	.strict();
export type DeliveryDiffInput = z.infer<typeof deliveryDiffInputSchema>;

const requirementRefShape = {
	assetFamilyId: z.string(),
	assetFamilyName: z.string(),
	itemId: z.string(),
	itemKind: requiredSetItemKindSchema,
	itemName: z.string(),
};

const fulfilmentSummarySchema = z
	.object({
		createdAt: z.iso.datetime(),
		deliveryTargetId: idSchema,
		id: idSchema,
		revisionId: idSchema,
		revisionNumber: z.number().int().positive(),
	})
	.strict();

const assetVersionIdsSchema = z.array(z.string());

const assetVersionEntrySchema = z
	.object({ ...requirementRefShape, assetVersionIds: assetVersionIdsSchema })
	.strict();

const bundleMappingSchema = z
	.object({
		bundleId: z.string(),
		manifestDigest: z.string(),
		resolution: z.enum(["only_bundle", "identical_pins", "user_selected"]),
	})
	.strict();

const contextSideSchema = z
	.object({
		contextRevisionId: z.string(),
		contextRevisionNumber: z.number().int().positive(),
	})
	.strict();

/** A section whose source data the Delivery Fulfilment model does not record; it is shown as such, never as "no difference". */
export const notRecordedSectionSchema = z
	.object({ reason: z.string(), status: z.literal("not_recorded") })
	.strict();

export const deliveryDiffSchema = z
	.object({
		assetVersions: z
			.object({
				added: z.array(assetVersionEntrySchema),
				changed: z.array(
					z
						.object({
							...requirementRefShape,
							fromAssetVersionIds: assetVersionIdsSchema,
							toAssetVersionIds: assetVersionIdsSchema,
						})
						.strict()
				),
				removed: z.array(assetVersionEntrySchema),
				unchangedCount: z.number().int().nonnegative(),
			})
			.strict(),
		bundleMappings: z
			.object({
				/** Requirements whose bundle, manifest or resolution differs; a null side means the requirement is absent there. */
				changes: z.array(
					z
						.object({
							...requirementRefShape,
							from: bundleMappingSchema.nullable(),
							to: bundleMappingSchema.nullable(),
						})
						.strict()
				),
			})
			.strict(),
		context: z.discriminatedUnion("status", [
			z
				.object({
					changed: z.boolean(),
					from: contextSideSchema,
					status: z.literal("recorded"),
					to: contextSideSchema,
				})
				.strict(),
			notRecordedSectionSchema,
		]),
		from: fulfilmentSummarySchema,
		qualityEvidence: notRecordedSectionSchema,
		qualityException: notRecordedSectionSchema,
		rights: notRecordedSectionSchema,
		runtimeEvidence: notRecordedSectionSchema,
		to: fulfilmentSummarySchema,
	})
	.strict();
export type DeliveryDiff = z.infer<typeof deliveryDiffSchema>;

export type DeliveryDiffResult =
	| { diff: DeliveryDiff; status: "found" }
	| { status: "same_fulfilment" };
