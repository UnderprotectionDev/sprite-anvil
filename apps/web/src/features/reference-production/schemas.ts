import {
	referenceFeatureSchema,
	referenceRoleSchema,
} from "@sprite-anvil/api/asset-record-tracking";
import z from "zod";

export const referenceConstraintDraftSchema = z.object({
	contextOverrideRationale: z.string(),
	customPurpose: z.string(),
	forbiddenFeatures: z.array(referenceFeatureSchema),
	notes: z.string(),
	role: referenceRoleSchema,
	transferredFeatures: z.array(referenceFeatureSchema),
});

export type ReferenceConstraintDraft = z.infer<
	typeof referenceConstraintDraftSchema
>;

export function referenceConstraintFormSchema(hasCanonicalDesign: boolean) {
	return referenceConstraintDraftSchema.check((context) => {
		const draft = context.value;
		if (
			draft.transferredFeatures.length === 0 &&
			draft.forbiddenFeatures.length === 0
		) {
			context.issues.push({
				code: "custom",
				input: draft,
				message:
					"En az bir özelliği aktarılabilir veya kaçınılacak olarak seçin.",
			});
			return;
		}
		if (draft.role === "custom" && !draft.customPurpose.trim()) {
			context.issues.push({
				code: "custom",
				input: draft,
				message: "Özel kullanım amacını yazın.",
			});
			return;
		}
		if (
			hasCanonicalDesign &&
			draft.transferredFeatures.includes("identity") &&
			!draft.forbiddenFeatures.includes("identity") &&
			!draft.contextOverrideRationale.trim()
		) {
			context.issues.push({
				code: "custom",
				input: draft,
				message:
					"Ana Tasarım kimlik sınırını aşmak için Bağlam Kuralı İstisnası gerekçesi yazın.",
			});
		}
	});
}

export function referenceConstraintError(
	draft: ReferenceConstraintDraft,
	hasCanonicalDesign: boolean
) {
	return (
		referenceConstraintFormSchema(hasCanonicalDesign).safeParse(draft).error
			?.issues[0]?.message ?? null
	);
}

export const referenceVersionLinkFormSchema = z.object({
	selectedVersionId: z.string().min(1, "Bağlanacak Varlık Sürümünü seçin."),
});
