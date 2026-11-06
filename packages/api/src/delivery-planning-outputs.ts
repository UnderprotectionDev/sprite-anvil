import { z } from "zod";
import {
	deliveryTargetPurposeSchema,
	pinnedEvidencePolicyFields,
} from "./delivery-planning-inputs";
import { requiredSetItemSchema } from "./family-readiness";

const idSchema = z.uuid();

/** A pinned family as the user reviews it: the pinned list revision plus the usage tests it declares. */
export const deliveryTargetFamilyScopeSchema = z
	.object({
		assetFamilyId: z.string(),
		assetFamilyName: z.string(),
		requiredItems: z.array(requiredSetItemSchema),
		requiredSetRevisionId: z.string(),
		requiredSetRevisionNumber: z.number().int().positive(),
		usageTests: z.array(requiredSetItemSchema),
	})
	.strict();
export type DeliveryTargetFamilyScope = z.infer<
	typeof deliveryTargetFamilyScopeSchema
>;

const scopeFields = {
	contextRevisionId: z.string(),
	contextRevisionNumber: z.number().int().positive(),
	families: z.array(deliveryTargetFamilyScopeSchema),
	...pinnedEvidencePolicyFields,
};

const revisionRefFields = {
	fromRevisionId: z.string(),
	fromRevisionNumber: z.number().int().positive(),
	toRevisionId: z.string(),
	toRevisionNumber: z.number().int().positive(),
};

const familyRefFields = {
	assetFamilyId: z.string(),
	assetFamilyName: z.string(),
};

/** What a revision's base changed against the target's previous revision. */
export const deliveryTargetScopeDiffSchema = z
	.object({
		contextChange: z.object(revisionRefFields).strict().nullable(),
		familiesAdded: z.array(z.object(familyRefFields).strict()),
		familiesRemoved: z.array(z.object(familyRefFields).strict()),
		previousRevisionId: idSchema,
		previousRevisionNumber: z.number().int().positive(),
		productionEvidencePolicyChanged: z.boolean(),
		requiredSetChanges: z.array(
			z
				.object({
					...familyRefFields,
					...revisionRefFields,
					/** Required items (including usage tests) in the new pinned list revision but not in the previous one; an edited item counts as both removed and added. */
					itemsAdded: z.array(requiredSetItemSchema),
					itemsRemoved: z.array(requiredSetItemSchema),
				})
				.strict()
		),
		rightsEvidencePolicyChanged: z.boolean(),
	})
	.strict();
export type DeliveryTargetScopeDiff = z.infer<
	typeof deliveryTargetScopeDiffSchema
>;

export const deliveryTargetDraftSchema = z
	.object({
		...scopeFields,
		/** The revision this draft was activated into, if any. */
		activatedRevisionId: idSchema.nullable(),
		createdAt: z.string(),
		id: idSchema,
	})
	.strict();
export type DeliveryTargetDraft = z.infer<typeof deliveryTargetDraftSchema>;

export const deliveryTargetRevisionSchema = z
	.object({
		...scopeFields,
		activatedAt: z.string(),
		draftId: idSchema,
		id: idSchema,
		revisionNumber: z.number().int().positive(),
		/** Null for a target's first revision. */
		scopeDiff: deliveryTargetScopeDiffSchema.nullable(),
	})
	.strict();
export type DeliveryTargetRevision = z.infer<
	typeof deliveryTargetRevisionSchema
>;

export const deliveryTargetSchema = z
	.object({
		/** The highest activated revision; null until the user activates a draft. */
		activeRevision: deliveryTargetRevisionSchema.nullable(),
		drafts: z.array(deliveryTargetDraftSchema),
		id: idSchema,
		name: z.string(),
		purpose: deliveryTargetPurposeSchema,
		revisions: z.array(deliveryTargetRevisionSchema),
	})
	.strict();
export type DeliveryTarget = z.infer<typeof deliveryTargetSchema>;

export const deliveryTargetCatalogSchema = z
	.object({ deliveryTargets: z.array(deliveryTargetSchema) })
	.strict();
export type DeliveryTargetCatalog = z.infer<typeof deliveryTargetCatalogSchema>;
