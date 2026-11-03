import { z } from "zod";
import type { SheetStructure } from "./pixel-editor-structure";

/**
 * Last-Mile Pixel Editor contract. A Working Draft stores an ordered list of
 * deterministic, grid-preserving operations. The server re-applies them to the
 * source Asset Version; nothing here describes smoothing, layers, free-angle
 * rotation, or skeleton animation, which are out of scope.
 *
 * The clipboard is not stored: `copy` and `cut` take a rectangle of the raster
 * as it is at that point in the history, and `paste` places the most recent
 * one, so replaying the applied operations always rebuilds the same clipboard.
 */

export const pixelEditorMaxDimension = 2048;
export const pixelEditorMaxOperations = 1000;
export const pixelEditorMaxStrokePoints = 4096;
export const pixelEditorMaxBrushSize = 8;
export const pixelEditorMaxScaleFactor = 16;

const dimensionSchema = z.number().int().min(1).max(pixelEditorMaxDimension);
const coordinateSchema = z
	.number()
	.int()
	.min(-pixelEditorMaxDimension)
	.max(pixelEditorMaxDimension);

export const pixelColorSchema = z
	.string()
	.regex(/^#[0-9a-f]{8}$/, "Use a lowercase #rrggbbaa colour");

export const pixelPointSchema = z
	.object({ x: coordinateSchema, y: coordinateSchema })
	.strict();

export const pixelRectSchema = z
	.object({
		x: coordinateSchema,
		y: coordinateSchema,
		width: dimensionSchema,
		height: dimensionSchema,
	})
	.strict();

const brushSizeSchema = z.number().int().min(1).max(pixelEditorMaxBrushSize);

export const canvasAnchorSchema = z.enum([
	"top-left",
	"top",
	"top-right",
	"left",
	"center",
	"right",
	"bottom-left",
	"bottom",
	"bottom-right",
]);

export const pixelOperationSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("pen"),
			color: pixelColorSchema,
			size: brushSizeSchema,
			points: z.array(pixelPointSchema).min(1).max(pixelEditorMaxStrokePoints),
		})
		.strict(),
	z
		.object({
			type: z.literal("eraser"),
			size: brushSizeSchema,
			points: z.array(pixelPointSchema).min(1).max(pixelEditorMaxStrokePoints),
		})
		.strict(),
	z
		.object({
			type: z.literal("line"),
			color: pixelColorSchema,
			size: brushSizeSchema,
			from: pixelPointSchema,
			to: pixelPointSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("fill"),
			color: pixelColorSchema,
			at: pixelPointSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("move-selection"),
			rect: pixelRectSchema,
			dx: coordinateSchema,
			dy: coordinateSchema,
		})
		.strict(),
	z.object({ type: z.literal("copy"), rect: pixelRectSchema }).strict(),
	z.object({ type: z.literal("cut"), rect: pixelRectSchema }).strict(),
	z
		.object({
			type: z.literal("paste"),
			x: coordinateSchema,
			y: coordinateSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("flip"),
			axis: z.enum(["horizontal", "vertical"]),
			rect: pixelRectSchema.nullable(),
		})
		.strict(),
	z
		.object({
			type: z.literal("rotate-90"),
			direction: z.enum(["clockwise", "counterclockwise"]),
			rect: pixelRectSchema.nullable(),
		})
		.strict(),
	z.object({ type: z.literal("crop"), rect: pixelRectSchema }).strict(),
	z
		.object({
			type: z.literal("resize-canvas"),
			width: dimensionSchema,
			height: dimensionSchema,
			anchor: canvasAnchorSchema,
		})
		.strict(),
	z
		.object({
			type: z.literal("scale"),
			factor: z.number().int().min(2).max(pixelEditorMaxScaleFactor),
		})
		.strict(),
	z
		.object({
			type: z.literal("replace-color"),
			from: pixelColorSchema,
			to: pixelColorSchema,
		})
		.strict(),
]);

export const pixelDraftStatusSchema = z.enum([
	"open",
	"committed",
	"discarded",
]);

export const pixelDraftOpenInputSchema = z
	.object({ sourceAssetVersionId: z.string().uuid() })
	.strict();

export const pixelDraftOperationInputSchema = z
	.object({
		expectedRevision: z.number().int().min(0),
		operation: pixelOperationSchema,
	})
	.strict();

export const pixelDraftHistoryInputSchema = z
	.object({ expectedRevision: z.number().int().min(0) })
	.strict();

export const pixelDraftCommitInputSchema = z
	.object({ expectedRevision: z.number().int().min(0) })
	.strict();

export const pixelColorReplacePreviewInputSchema = z
	.object({ from: pixelColorSchema, to: pixelColorSchema })
	.strict();

export const pixelColorReplacePreviewSchema = z
	.object({
		from: pixelColorSchema,
		to: pixelColorSchema,
		affectedPixelCount: z.number().int().min(0),
		resultIsInPalette: z.boolean(),
	})
	.strict();

const colorUsageSchema = z
	.object({ color: pixelColorSchema, pixelCount: z.number().int().min(1) })
	.strict();

export const pixelDraftSchema = z
	.object({
		id: z.string().uuid(),
		projectId: z.string().min(1),
		assetRecordId: z.string().min(1),
		sourceAssetVersionId: z.string().uuid(),
		status: pixelDraftStatusSchema,
		revision: z.number().int().min(0),
		operations: z.array(pixelOperationSchema),
		appliedOperationCount: z.number().int().min(0),
		canUndo: z.boolean(),
		canRedo: z.boolean(),
		sourceSize: z
			.object({ width: dimensionSchema, height: dimensionSchema })
			.strict(),
		size: z
			.object({ width: dimensionSchema, height: dimensionSchema })
			.strict(),
		diff: z
			.object({
				changedPixelCount: z.number().int().min(0),
				boundingBox: pixelRectSchema.nullable(),
				sizeChanged: z.boolean(),
			})
			.strict(),
		palette: z
			.object({
				origin: z.literal("source-image"),
				colors: z.array(pixelColorSchema),
			})
			.strict(),
		usedColors: z.array(colorUsageSchema),
		outOfPaletteColors: z.array(colorUsageSchema),
		sourcePreviewUrl: z.string().min(1),
		previewUrl: z.string().min(1),
		committedAssetVersionId: z.string().uuid().nullable(),
		updatedAt: z.string().datetime(),
	})
	.strict();

export const pixelDraftCommitResponseSchema = z
	.object({
		draft: pixelDraftSchema,
		assetVersionId: z.string().uuid(),
		created: z.boolean(),
	})
	.strict();

export const pixelEditorErrors = [
	"Unauthorized",
	"Not found",
	"Invalid Working Draft request",
	"Invalid pixel operation",
	"Working Draft revision conflict",
	"Working Draft is not open",
	"Working Draft has no changes",
	"Nothing to undo",
	"Nothing to redo",
	"Source Asset Version image unavailable",
	"Working Draft commit failed",
	"Invalid slicing parameters",
	"Invalid frame operation",
	"Protected frame",
	"Working Draft has no frame structure",
	"Frame structure has no changes",
	"Frame structure commit failed",
] as const;

export const pixelEditorErrorSchema = z
	.object({ error: z.enum(pixelEditorErrors), detail: z.string().optional() })
	.strict();

export type PixelColor = z.infer<typeof pixelColorSchema>;
export type PixelPoint = z.infer<typeof pixelPointSchema>;
export type PixelRect = z.infer<typeof pixelRectSchema>;
export type CanvasAnchor = z.infer<typeof canvasAnchorSchema>;
export type PixelOperation = z.infer<typeof pixelOperationSchema>;
export type PixelDraft = z.infer<typeof pixelDraftSchema>;
export type PixelDraftStatus = z.infer<typeof pixelDraftStatusSchema>;
export type PixelDraftCommitResponse = z.infer<
	typeof pixelDraftCommitResponseSchema
>;
export type PixelColorReplacePreview = z.infer<
	typeof pixelColorReplacePreviewSchema
>;

/** Persisted Working Draft row as the store sees it. */
export interface PixelDraftRecord {
	appliedOperationCount: number;
	assetFamilyId: string;
	assetRecordId: string;
	committedAssetVersionId: string | null;
	id: string;
	operations: PixelOperation[];
	ownerUserId: string;
	projectId: string;
	revision: number;
	sourceAssetVersionId: string;
	status: PixelDraftStatus;
	structure: SheetStructure | null;
	updatedAt: Date;
}

export interface PixelDraftCreateInput {
	assetFamilyId: string;
	assetRecordId: string;
	id: string;
	projectId: string;
	sourceAssetVersionId: string;
}

export type PixelDraftUpdateResult =
	| { kind: "updated"; draft: PixelDraftRecord }
	| { kind: "conflict" }
	| { kind: "not-open" };

export interface PixelEditorStore {
	createDraft: (
		userId: string,
		input: PixelDraftCreateInput
	) => Promise<{
		kind: "created" | "existing";
		draft: PixelDraftRecord;
	} | null>;
	discardDraft: (
		userId: string,
		projectId: string,
		draftId: string
	) => Promise<PixelDraftUpdateResult | null>;
	getDraft: (
		userId: string,
		projectId: string,
		draftId: string
	) => Promise<PixelDraftRecord | null>;
	markCommitted: (
		userId: string,
		projectId: string,
		draftId: string,
		assetVersionId: string
	) => Promise<PixelDraftUpdateResult | null>;
	updateOperations: (
		userId: string,
		projectId: string,
		draftId: string,
		update: {
			appliedOperationCount: number;
			expectedRevision: number;
			operations: PixelOperation[];
			/** Written in the same update when a sheet edit moved the frame grid. */
			structure?: SheetStructure;
		}
	) => Promise<PixelDraftUpdateResult | null>;
	updateStructure: (
		userId: string,
		projectId: string,
		draftId: string,
		update: { expectedRevision: number | null; structure: SheetStructure }
	) => Promise<PixelDraftUpdateResult | null>;
}
