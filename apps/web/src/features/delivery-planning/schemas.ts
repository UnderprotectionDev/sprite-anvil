import {
	deliveryTargetPurposeSchema,
	productionEvidenceRequirementSchema,
	rightsEvidenceSubjectSchema,
} from "@sprite-anvil/api/delivery-planning-inputs";
import { rightsRecordStateSchema } from "@sprite-anvil/api/rights-records";
import { optionalRuntimeEnvironmentText } from "@sprite-anvil/api/runtime-environment";
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

/** An enum the user must pick: "" is the unchosen starting value and fails with `message`. */
function explicitChoice<T extends z.ZodType>(schema: T, message: string) {
	return z
		.union([schema, z.literal("")])
		.refine((value) => value !== "", message);
}

// Blank is allowed here; the criterion check below asks for the required two only when it applies.
const runtimeEnvironmentChoiceSchema = z.object({
	adapterVersion: optionalRuntimeEnvironmentText(),
	engineVersion: optionalRuntimeEnvironmentText(),
	gameBuild: optionalRuntimeEnvironmentText(),
});

export const deliveryTargetFormSchema = z
	.object({
		acceptableStates: z
			.array(rightsRecordStateSchema)
			.min(1, "A Rights Evidence Policy needs at least one acceptable state."),
		defaultProductionRequirement: explicitChoice(
			productionEvidenceRequirementSchema,
			"Choose a default Production Evidence requirement."
		),
		families: z
			.array(familyChoiceSchema)
			.refine(
				(families) => families.filter((family) => family.selected).length >= 2,
				"A Delivery Target must cover at least two Asset Families."
			),
		name: z.string().trim().min(1, "Name the Delivery Target."),
		purpose: explicitChoice(deliveryTargetPurposeSchema, "Choose a purpose."),
		requireRecordFor: z.array(rightsEvidenceSubjectSchema),
		requireRuntimeValidation: z.boolean(),
		runtimeEnvironments: z.array(runtimeEnvironmentChoiceSchema),
	})
	.superRefine((value, context) => {
		if (!value.requireRuntimeValidation) {
			return;
		}
		if (value.runtimeEnvironments.length === 0) {
			context.addIssue({
				code: "custom",
				message: "Add at least one required environment.",
				path: ["runtimeEnvironments"],
			});
		}
		for (const [index, environment] of value.runtimeEnvironments.entries()) {
			for (const key of ["gameBuild", "engineVersion"] as const) {
				if (environment[key].trim() === "") {
					context.addIssue({
						code: "custom",
						message:
							key === "gameBuild"
								? "Enter the game build."
								: "Enter the engine version.",
						path: ["runtimeEnvironments", index, key],
					});
				}
			}
		}
	});

export type DeliveryTargetFormValues = z.infer<typeof deliveryTargetFormSchema>;
