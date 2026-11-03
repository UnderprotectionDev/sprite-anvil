import {
	canvasAnchorSchema,
	pixelColorSchema,
	pixelEditorMaxDimension,
	pixelEditorMaxScaleFactor,
} from "@sprite-anvil/api/pixel-editor";
import z from "zod";

const wholeNumberPattern = /^\d+$/;

function wholeNumber(min: number, max: number, label: string) {
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

const gridCoordinate = (label: string) => wholeNumber(0, 100_000, label);

export const correctionFormSchema = z.object({
	issueNote: z.string().trim().min(1, "Describe the issue").max(2000),
	regionX: gridCoordinate("Region x"),
	regionY: gridCoordinate("Region y"),
	regionWidth: wholeNumber(1, pixelEditorMaxDimension, "Region width"),
	regionHeight: wholeNumber(1, pixelEditorMaxDimension, "Region height"),
	targetUnitVersionId: z.string(),
	preservedUnitVersionIds: z.array(z.string()),
});

export const correctionAnnotationFormSchema = z.object({
	kind: z.enum(["arrow", "line", "region", "note"]),
	x: gridCoordinate("x"),
	y: gridCoordinate("y"),
	x2: gridCoordinate("x2"),
	y2: gridCoordinate("y2"),
	text: z.string().trim().max(500),
});
