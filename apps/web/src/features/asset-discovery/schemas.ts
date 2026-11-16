import z from "zod";

const maximumSourceImageSize = 100_000;

export const assetRecordSearchDraftSchema = z
	.object({
		assetCategory: z.string(),
		availability: z.string(),
		name: z.string(),
		sourceImageHeight: z.string(),
		sourceImageWidth: z.string(),
		tag: z.string(),
		themeId: z.string(),
		visualWorldId: z.string(),
	})
	.superRefine((draft, context) => {
		const width = draft.sourceImageWidth.trim();
		const height = draft.sourceImageHeight.trim();
		if (Boolean(width) !== Boolean(height)) {
			context.addIssue({
				code: "custom",
				message: "Enter both width and height to search by dimensions.",
			});
			return;
		}
		if (!(width || height)) {
			return;
		}
		const parsedWidth = Number(width);
		const parsedHeight = Number(height);
		if (
			!(
				Number.isSafeInteger(parsedWidth) && Number.isSafeInteger(parsedHeight)
			) ||
			parsedWidth < 1 ||
			parsedHeight < 1 ||
			parsedWidth > maximumSourceImageSize ||
			parsedHeight > maximumSourceImageSize
		) {
			context.addIssue({
				code: "custom",
				message: "Width and height must be integers from 1 to 100,000 px.",
			});
		}
	});

export type AssetRecordSearchDraft = z.infer<
	typeof assetRecordSearchDraftSchema
>;
