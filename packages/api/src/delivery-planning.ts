import { z } from "zod";
import { requiredSetItemSchema } from "./family-readiness";

const idSchema = z.uuid();

export const deliveryTargetPurposeSchema = z.enum([
	"demo",
	"chapter",
	"update",
	"other",
]);
export type DeliveryTargetPurpose = z.infer<typeof deliveryTargetPurposeSchema>;

/** One Asset Family the target covers, with the Required Items List revision it pins. */
export const deliveryTargetFamilyInputSchema = z
	.object({
		assetFamilyId: z.string().trim().min(1).max(128),
		requiredSetRevisionId: z.string().trim().min(1).max(128),
	})
	.strict();

export const deliveryTargetDraftSaveInputSchema = z
	.object({
		contextRevisionId: z.string().trim().min(1).max(128),
		deliveryTargetId: idSchema,
		families: z
			.array(deliveryTargetFamilyInputSchema)
			.min(2, "Teslimat Hedefi en az iki Varlık Ailesini kapsamalıdır.")
			.max(50)
			.refine(
				(families) =>
					new Set(families.map((family) => family.assetFamilyId)).size ===
					families.length,
				"Bir Varlık Ailesi hedefte yalnızca bir kez seçilebilir."
			),
		/** Doubles as the idempotency key: saving the same id again returns the stored draft. */
		id: idSchema,
		name: z.string().trim().min(1).max(120),
		projectId: idSchema,
		purpose: deliveryTargetPurposeSchema,
	})
	.strict();
export type DeliveryTargetDraftSaveInput = z.infer<
	typeof deliveryTargetDraftSaveInputSchema
>;

export const deliveryTargetActivateInputSchema = z
	.object({
		draftId: idSchema,
		/** Idempotency key for the new Delivery Target revision. */
		id: idSchema,
		projectId: idSchema,
	})
	.strict();
export type DeliveryTargetActivateInput = z.infer<
	typeof deliveryTargetActivateInputSchema
>;

export const deliveryTargetListInputSchema = z
	.object({ projectId: idSchema })
	.strict();

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
};

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

export type DeliveryTargetDraftSaveFailureReason =
	| "context_revision_not_found"
	| "required_set_revision_not_found";

export type DeliveryTargetDraftSaveResult =
	| { draft: DeliveryTargetDraft; status: "saved" }
	| { reason: DeliveryTargetDraftSaveFailureReason; status: "rejected" };

/** Authorized, project-scoped access to Delivery Target drafts and revisions. */
export interface DeliveryTargetStore {
	/** Turns a draft into the next immutable revision; null when the project or draft is not found. */
	activate: (
		userId: string,
		input: DeliveryTargetActivateInput
	) => Promise<DeliveryTargetRevision | null>;
	/** Null when the project is not found. */
	list: (
		userId: string,
		projectId: string
	) => Promise<DeliveryTargetCatalog | null>;
	/** Records a draft only; it changes no revision, readiness or Required Items List. Null when the project is not found. */
	saveDraft: (
		userId: string,
		input: DeliveryTargetDraftSaveInput
	) => Promise<DeliveryTargetDraftSaveResult | null>;
}
