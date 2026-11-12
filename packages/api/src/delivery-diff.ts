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
	.strict()
	.refine((input) => input.fromFulfilmentId !== input.toFulfilmentId, {
		message: "Pick two different Delivery Fulfilments to compare.",
		path: ["toFulfilmentId"],
	});
export type DeliveryDiffInput = z.infer<typeof deliveryDiffInputSchema>;

const requirementIdentityShape = {
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
	.object({
		...requirementIdentityShape,
		assetVersionIds: assetVersionIdsSchema,
	})
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
const notRecordedSectionSchema = z
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
							...requirementIdentityShape,
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
							...requirementIdentityShape,
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
		qualityWaiver: notRecordedSectionSchema,
		rights: notRecordedSectionSchema,
		runtimeEvidence: notRecordedSectionSchema,
		to: fulfilmentSummarySchema,
	})
	.strict();
export type DeliveryDiff = z.infer<typeof deliveryDiffSchema>;

/** The sections of a Delivery Diff whose source data a Delivery Fulfilment does not record. */
export type NotRecordedSectionKey =
	| "qualityEvidence"
	| "qualityWaiver"
	| "rights"
	| "runtimeEvidence";
