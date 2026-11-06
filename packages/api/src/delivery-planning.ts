import { z } from "zod";
import { requiredSetItemSchema } from "./family-readiness";
import { rightsRecordStateSchema } from "./rights-records";

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

/** Where a target needs full Generation Package history, accepts a Legacy Asset Attestation, or treats missing history as advisory. */
export const productionEvidenceRequirementSchema = z.enum([
	"full_generation_package_history",
	"legacy_asset_attestation_acceptable",
	"advisory",
]);
export type ProductionEvidenceRequirement = z.infer<
	typeof productionEvidenceRequirementSchema
>;

export const productionEvidencePolicySchema = z
	.object({
		/** Applies to every pinned family without its own requirement. */
		defaultRequirement: productionEvidenceRequirementSchema,
		familyRequirements: z
			.array(
				z
					.object({
						assetFamilyId: z.string().trim().min(1).max(128),
						requirement: productionEvidenceRequirementSchema,
					})
					.strict()
			)
			.max(50)
			.refine(
				(requirements) =>
					new Set(requirements.map((entry) => entry.assetFamilyId)).size ===
					requirements.length,
				"An Asset Family can have only one Production Evidence requirement."
			),
	})
	.strict();
export type ProductionEvidencePolicy = z.infer<
	typeof productionEvidencePolicySchema
>;

export const rightsEvidenceSubjectSchema = z.enum(["references", "results"]);

/** Which references and results need Rights Records, and which user-declared record states the target accepts. */
export const rightsEvidencePolicySchema = z
	.object({
		acceptableStates: z
			.array(rightsRecordStateSchema)
			.min(1, "A Rights Evidence Policy needs at least one acceptable state.")
			.refine(
				(states) => new Set(states).size === states.length,
				"A Rights Record state can be chosen only once."
			),
		requireRecordFor: z
			.array(rightsEvidenceSubjectSchema)
			.refine(
				(subjects) => new Set(subjects).size === subjects.length,
				"A scope can be chosen only once."
			),
	})
	.strict();
export type RightsEvidencePolicy = z.infer<typeof rightsEvidencePolicySchema>;

export const deliveryTargetDraftSaveInputSchema = z
	.object({
		contextRevisionId: z.string().trim().min(1).max(128),
		deliveryTargetId: idSchema,
		families: z
			.array(deliveryTargetFamilyInputSchema)
			.min(2, "A Delivery Target must cover at least two Asset Families.")
			.max(50)
			.refine(
				(families) =>
					new Set(families.map((family) => family.assetFamilyId)).size ===
					families.length,
				"An Asset Family can be chosen only once per Delivery Target."
			),
		/** Doubles as the idempotency key: saving the same id again with the same content returns the stored draft; different content is a conflict. */
		id: idSchema,
		name: z.string().trim().min(1).max(120),
		productionEvidencePolicy: productionEvidencePolicySchema,
		projectId: idSchema,
		purpose: deliveryTargetPurposeSchema,
		rightsEvidencePolicy: rightsEvidencePolicySchema,
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
	productionEvidencePolicy: productionEvidencePolicySchema,
	rightsEvidencePolicy: rightsEvidencePolicySchema,
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
			z.object({ ...familyRefFields, ...revisionRefFields }).strict()
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

export type DeliveryTargetDraftSaveFailureReason =
	| "context_revision_not_found"
	| "delivery_target_unavailable"
	| "draft_id_conflict"
	| "policy_family_not_pinned"
	| "required_set_revision_not_found";

export type DeliveryTargetDraftSaveResult =
	| { draft: DeliveryTargetDraft; status: "saved" }
	| { reason: DeliveryTargetDraftSaveFailureReason; status: "rejected" };

export type DeliveryTargetActivateResult =
	| { revision: DeliveryTargetRevision; status: "activated" }
	| { status: "revision_number_conflict" };

/** Authorized, project-scoped access to Delivery Target drafts and revisions. */
export interface DeliveryTargetStore {
	/** Turns a draft into the next immutable revision; null when the project or draft is not found, a conflict when the revision number stays contested. */
	activate: (
		userId: string,
		input: DeliveryTargetActivateInput
	) => Promise<DeliveryTargetActivateResult | null>;
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
