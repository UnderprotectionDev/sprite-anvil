import {
	canvasAnchorSchema,
	pixelColorSchema,
	pixelEditorMaxDimension,
	pixelEditorMaxScaleFactor,
} from "@sprite-anvil/api/pixel-editor";
import {
	pixelEditorMaxFrameDurationMs,
	pixelEditorMaxFrames,
	sheetReadingOrderSchema,
} from "@sprite-anvil/api/pixel-editor-structure";
import z from "zod";

const wholeNumberPattern = /^\d+$/;

export function wholeNumber(min: number, max: number, label: string) {
	return z
		.string()
		.trim()
		.regex(wholeNumberPattern, `${label}: use a whole number`)
		.transform(Number)
		.pipe(
			z
				.number()
				.min(min, `${label}: use at least ${min}`)
				.max(max, `${label}: use at most ${max}`)
		);
}

const signedWholeNumberPattern = /^-?\d+$/;

export function signedWholeNumber(min: number, max: number, label: string) {
	return z
		.string()
		.trim()
		.regex(signedWholeNumberPattern, `${label}: use a whole number`)
		.transform(Number)
		.pipe(
			z
				.number()
				.min(min, `${label}: use at least ${min}`)
				.max(max, `${label}: use at most ${max}`)
		);
}

export const slicingFormSchema = z.object({
	cellWidth: wholeNumber(1, pixelEditorMaxDimension, "Cell width"),
	cellHeight: wholeNumber(1, pixelEditorMaxDimension, "Cell height"),
	columns: wholeNumber(1, pixelEditorMaxFrames, "Columns"),
	rows: wholeNumber(1, pixelEditorMaxFrames, "Rows"),
	offsetX: wholeNumber(0, pixelEditorMaxDimension, "Offset X"),
	offsetY: wholeNumber(0, pixelEditorMaxDimension, "Offset Y"),
	gapX: wholeNumber(0, pixelEditorMaxDimension, "Gap X"),
	gapY: wholeNumber(0, pixelEditorMaxDimension, "Gap Y"),
	readingOrder: sheetReadingOrderSchema,
});

export const frameSettingsFormSchema = z.object({
	durationMs: wholeNumber(1, pixelEditorMaxFrameDurationMs, "Duration"),
	offsetX: signedWholeNumber(
		-pixelEditorMaxDimension,
		pixelEditorMaxDimension,
		"Offset X"
	),
	offsetY: signedWholeNumber(
		-pixelEditorMaxDimension,
		pixelEditorMaxDimension,
		"Offset Y"
	),
	pivotX: wholeNumber(0, pixelEditorMaxDimension, "Pivot X"),
	pivotY: wholeNumber(0, pixelEditorMaxDimension, "Pivot Y"),
});

export const resizeCanvasFormSchema = z.object({
	width: wholeNumber(1, pixelEditorMaxDimension, "Width"),
	height: wholeNumber(1, pixelEditorMaxDimension, "Height"),
	anchor: canvasAnchorSchema,
});

export const scaleFormSchema = z.object({
	factor: wholeNumber(2, pixelEditorMaxScaleFactor, "Factor"),
});

export const replaceColorFormSchema = z
	.object({ from: pixelColorSchema, to: pixelColorSchema })
	.refine((value) => value.from !== value.to, {
		message: "Choose two different colours",
		path: ["to"],
	});

export const frameSourceFormSchema = z.object({
	assetVersionId: z.string().trim().uuid("Enter a valid Asset Version ID"),
});
