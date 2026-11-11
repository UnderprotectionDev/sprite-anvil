import { z } from "zod";
import { rightsRecordStateSchema } from "./rights-records";
import { runtimeValidationCriterionSchema } from "./runtime-validation-readiness";

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

/** The evidence policies a Delivery Target pins; shared by the save input and the read-side scope. */
export const pinnedEvidencePolicyFields = {
	productionEvidencePolicy: productionEvidencePolicySchema,
	rightsEvidencePolicy: rightsEvidencePolicySchema,
};

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
		...pinnedEvidencePolicyFields,
		projectId: idSchema,
		purpose: deliveryTargetPurposeSchema,
		/** Optional acceptance criterion; null keeps the target as it was without one. */
		runtimeValidationCriterion: runtimeValidationCriterionSchema
			.nullable()
			.default(null),
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
