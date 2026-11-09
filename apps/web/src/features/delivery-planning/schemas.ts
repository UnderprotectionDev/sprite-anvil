import {
	deliveryTargetPurposeSchema,
	productionEvidenceRequirementSchema,
	rightsEvidenceSubjectSchema,
} from "@sprite-anvil/api/delivery-planning-inputs";
import { rightsRecordStateSchema } from "@sprite-anvil/api/rights-records";
import { z } from "zod";

export const familyChoiceSchema = z.object({
	assetFamilyId: z.string(),
	assetFamilyName: z.string(),
	/** "default" means the target-wide Production Evidence requirement applies. */
	productionRequirement: z.union([
		z.literal("default"),
		productionEvidenceRequirementSchema,
	]),
	requiredSetRevisionId: z.string(),
	selected: z.boolean(),
});

export const deliveryTargetFormSchema = z.object({
	acceptableStates: z
		.array(rightsRecordStateSchema)
		.min(1, "A Rights Evidence Policy needs at least one acceptable state."),
	defaultProductionRequirement: productionEvidenceRequirementSchema,
	families: z
		.array(familyChoiceSchema)
		.refine(
			(families) => families.filter((family) => family.selected).length >= 2,
			"A Delivery Target must cover at least two Asset Families."
		),
	name: z.string().trim().min(1, "Name the Delivery Target."),
	purpose: deliveryTargetPurposeSchema,
	requireRecordFor: z.array(rightsEvidenceSubjectSchema),
});

export type DeliveryTargetFormValues = z.infer<typeof deliveryTargetFormSchema>;
