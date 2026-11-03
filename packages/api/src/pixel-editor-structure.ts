import { z } from "zod";
import { pixelEditorMaxDimension } from "./pixel-editor";

/**
 * Frame and sprite sheet structure of a Last-Mile Pixel Editor Working Draft.
 * Slicing never changes the source Asset Version; each frame is a Unit Version
 * candidate and a commit pins them in a new Composite Version. Layers,
 * free-angle rotation and skeleton animation are not part of this contract.
 */

export const pixelEditorMaxFrames = 256;
export const pixelEditorMaxFrameDurationMs = 60_000;

const sheetDimensionSchema = z
	.number()
	.int()
	.min(1)
	.max(pixelEditorMaxDimension);
const nonNegativeSchema = z.number().int().min(0).max(pixelEditorMaxDimension);
const signedSchema = z
	.number()
	.int()
	.min(-pixelEditorMaxDimension)
	.max(pixelEditorMaxDimension);

export const sheetReadingOrders = [
	"rows-left-to-right",
	"rows-right-to-left",
	"columns-top-to-bottom",
	"columns-bottom-to-top",
] as const;
export const sheetReadingOrderSchema = z.enum(sheetReadingOrders);

export const sheetSlicingSchema = z
	.object({
		cellWidth: sheetDimensionSchema,
		cellHeight: sheetDimensionSchema,
		columns: z.number().int().min(1).max(pixelEditorMaxFrames),
		rows: z.number().int().min(1).max(pixelEditorMaxFrames),
		offsetX: nonNegativeSchema,
		offsetY: nonNegativeSchema,
		gapX: nonNegativeSchema,
		gapY: nonNegativeSchema,
		readingOrder: sheetReadingOrderSchema,
	})
	.strict();

export const frameKeySchema = z
	.string()
	.regex(/^frame-[1-9][0-9]{0,5}$/, "Use a frame-<number> key");

export const frameOriginSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("cell"), cellIndex: z.number().int().min(0) }),
	z.object({ kind: z.literal("blank") }),
	z.object({
		kind: z.literal("asset-version"),
		assetVersionId: z.string().uuid(),
	}),
]);

const durationSchema = z
	.number()
	.int()
	.min(1)
	.max(pixelEditorMaxFrameDurationMs);

export const frameCommittedSchema = z
	.object({
		unitVersionId: z.string().min(1),
		assetVersionId: z.string().min(1),
		fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
	})
	.strict();

/** Persisted frame entry. Order in `frames` is the playback order. */
export const sheetFrameRecordSchema = z
	.object({
		key: frameKeySchema,
		origin: frameOriginSchema,
		durationMs: durationSchema,
		offsetX: signedSchema,
		offsetY: signedSchema,
		pivotX: nonNegativeSchema,
		pivotY: nonNegativeSchema,
		keep: z.boolean(),
		committed: frameCommittedSchema.nullable(),
	})
	.strict();

export const sheetStructureSchema = z
	.object({
		slicing: sheetSlicingSchema,
		frames: z.array(sheetFrameRecordSchema).min(1).max(pixelEditorMaxFrames),
		nextFrameNumber: z.number().int().min(1),
		lastCommit: z
			.object({
				compositeVersionId: z.string().min(1),
				frameKeys: z.array(frameKeySchema),
				unitVersionIds: z.array(z.string().min(1)),
			})
			.strict()
			.nullable(),
	})
	.strict();

export const sheetSlicingPreviewInputSchema = z
	.object({ slicing: sheetSlicingSchema })
	.strict();

export const sheetSlicingApplyInputSchema = z
	.object({
		expectedRevision: z.number().int().min(0),
		slicing: sheetSlicingSchema,
	})
	.strict();

export const sheetCellSchema = z
	.object({
		index: z.number().int().min(0),
		x: nonNegativeSchema,
		y: nonNegativeSchema,
		width: sheetDimensionSchema,
		height: sheetDimensionSchema,
	})
	.strict();

export const sheetSlicingPreviewSchema = z
	.object({
		cells: z.array(sheetCellSchema),
		frameCount: z.number().int().min(1),
		sheetSize: z
			.object({ width: sheetDimensionSchema, height: sheetDimensionSchema })
			.strict(),
	})
	.strict();

const frameKeyOperation = { frameKey: frameKeySchema };
const insertAt = z.number().int().min(0).max(pixelEditorMaxFrames).optional();

export const frameOperationSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("add-blank"), at: insertAt }).strict(),
	z
		.object({
			type: z.literal("add-from-asset-version"),
			assetVersionId: z.string().uuid(),
			at: insertAt,
		})
		.strict(),
	z
		.object({
			type: z.literal("duplicate"),
			...frameKeyOperation,
			at: insertAt,
		})
		.strict(),
	z.object({ type: z.literal("delete"), ...frameKeyOperation }).strict(),
	z
		.object({
			type: z.literal("replace"),
			...frameKeyOperation,
			assetVersionId: z.string().uuid(),
		})
		.strict(),
	z
		.object({
			type: z.literal("reorder"),
			...frameKeyOperation,
			toIndex: z.number().int().min(0).max(pixelEditorMaxFrames),
		})
		.strict(),
	z
		.object({
			type: z.literal("set-duration"),
			...frameKeyOperation,
			durationMs: durationSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("set-offset"),
			...frameKeyOperation,
			x: signedSchema,
			y: signedSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("set-pivot"),
			...frameKeyOperation,
			x: nonNegativeSchema,
			y: nonNegativeSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("set-keep"),
			...frameKeyOperation,
			keep: z.boolean(),
		})
		.strict(),
]);

export const frameOperationInputSchema = z
	.object({
		expectedRevision: z.number().int().min(0),
		operation: frameOperationSchema,
	})
	.strict();

export const frameStructureCommitInputSchema = z
	.object({ expectedRevision: z.number().int().min(0) })
	.strict();

export const frameStatusSchema = z.enum(["new", "changed", "pinned"]);

export const sheetFrameViewSchema = z
	.object({
		key: frameKeySchema,
		index: z.number().int().min(0),
		origin: frameOriginSchema,
		durationMs: durationSchema,
		offsetX: signedSchema,
		offsetY: signedSchema,
		pivotX: nonNegativeSchema,
		pivotY: nonNegativeSchema,
		keep: z.boolean(),
		/** pinned: matches its Unit Version; changed: differs from it; new: none yet. */
		status: frameStatusSchema,
		unitVersionId: z.string().nullable(),
		previewUrl: z.string().min(1),
	})
	.strict();

export const sheetStructureViewSchema = z
	.object({
		draftId: z.string().uuid(),
		draftRevision: z.number().int().min(0),
		sheetSize: z
			.object({ width: sheetDimensionSchema, height: sheetDimensionSchema })
			.strict(),
		slicing: sheetSlicingSchema,
		cells: z.array(sheetCellSchema),
		frames: z.array(sheetFrameViewSchema),
		affectedFrameKeys: z.array(frameKeySchema),
		orderChanged: z.boolean(),
		lastCommit: sheetStructureSchema.shape.lastCommit,
	})
	.strict();

export const frameStructureCommitResponseSchema = z
	.object({
		structure: sheetStructureViewSchema,
		compositeVersionId: z.string().min(1),
		createdUnitVersionIds: z.array(z.string().min(1)),
		reusedUnitVersionIds: z.array(z.string().min(1)),
		created: z.boolean(),
	})
	.strict();

export type FrameKey = z.infer<typeof frameKeySchema>;
export type SheetSlicing = z.infer<typeof sheetSlicingSchema>;
export type SheetReadingOrder = z.infer<typeof sheetReadingOrderSchema>;
export type SheetCell = z.infer<typeof sheetCellSchema>;
export type SheetSlicingPreview = z.infer<typeof sheetSlicingPreviewSchema>;
export type FrameOrigin = z.infer<typeof frameOriginSchema>;
export type SheetFrameRecord = z.infer<typeof sheetFrameRecordSchema>;
export type SheetStructure = z.infer<typeof sheetStructureSchema>;
export type FrameOperation = z.infer<typeof frameOperationSchema>;
export type SheetFrameView = z.infer<typeof sheetFrameViewSchema>;
export type SheetStructureView = z.infer<typeof sheetStructureViewSchema>;
export type FrameStructureCommitResponse = z.infer<
	typeof frameStructureCommitResponseSchema
>;
