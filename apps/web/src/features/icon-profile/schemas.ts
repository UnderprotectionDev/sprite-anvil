import { iconFamilyReviewInputSchema } from "@sprite-anvil/api/icon-family-reviews";
import z from "zod";

const iconFamilyReviewItemDraftSchema = z.object({
	assetRecordId: z.string(),
	assetVersionId: z.string(),
	height: z.string(),
	key: z.string(),
	usageVariant: z.string(),
	width: z.string(),
});

const iconFamilyReviewComparisonDraftSchema = z.object({
	assessment: z.string(),
	notes: z.string(),
});

const iconFamilyReviewFormValuesSchema = z.object({
	comparisons: z.object({
		detailDensity: iconFamilyReviewComparisonDraftSchema,
		lightingDirection: iconFamilyReviewComparisonDraftSchema,
		objectScale: iconFamilyReviewComparisonDraftSchema,
		outline: iconFamilyReviewComparisonDraftSchema,
		stateOrRarityColor: iconFamilyReviewComparisonDraftSchema,
	}),
	items: z.array(iconFamilyReviewItemDraftSchema),
	outcome: z.enum(["consistent", "needs_follow_up"]),
	rationale: z.string(),
});

type IconFamilyReviewApiInput = z.input<typeof iconFamilyReviewInputSchema>;

export type IconFamilyReviewFormValues = z.infer<
	typeof iconFamilyReviewFormValuesSchema
>;

/**
 * Validates the Icon Family Review draft by converting it into the saved
 * review input, so the form reports the same issues the API contract does.
 * Each successful parse issues a fresh review id.
 */
export function iconFamilyReviewFormSchema(context: {
	assetFamilyId: string;
	contractRevisionId: string;
	projectId: string;
}) {
	return iconFamilyReviewFormValuesSchema
		.transform(
			(draft): IconFamilyReviewApiInput => ({
				assetFamilyId: context.assetFamilyId,
				// The draft keeps assessments as free strings; the pipe below rejects any
				// value outside the saved review's assessment enums.
				comparisons:
					draft.comparisons as IconFamilyReviewApiInput["comparisons"],
				contractRevisionId: context.contractRevisionId,
				grayscaleCompared: true as const,
				id: crypto.randomUUID(),
				items: draft.items.map((item) => ({
					assetRecordId: item.assetRecordId,
					assetVersionId: item.assetVersionId,
					logicalSize: {
						height: Number(item.height),
						width: Number(item.width),
					},
					usageVariant: item.usageVariant,
				})),
				outcome: draft.outcome,
				projectId: context.projectId,
				rationale: draft.rationale,
				testedBackgrounds: ["light" as const, "dark" as const],
			})
		)
		.pipe(iconFamilyReviewInputSchema);
}
