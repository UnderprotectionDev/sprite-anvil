/**
 * The engine-neutral game data an Export Bundle pins at creation (manifest
 * contract 1.1.0): animation frames, timing, pivots and events, tile data and
 * UI nine-patch data. A Verified Engine Adapter reads only this section, never
 * the live Workbench stores, so the same bundle always gives the same output.
 *
 * Pure on purpose, like the manifest it belongs to.
 */
import { z } from "zod";

const idSchema = z.string().min(1);
const nonNegativeInt = z.number().int().nonnegative();
const positiveInt = z.number().int().positive();

export const engineDataRegionSchema = z
	.object({
		height: positiveInt,
		width: positiveInt,
		x: nonNegativeInt,
		y: nonNegativeInt,
	})
	.strict();

/** Pivot in source-image pixels from the top-left corner, as the Specialized Profile Contract declares. */
export const engineDataPivotSchema = z
	.object({ x: z.number(), y: z.number() })
	.strict();

export const engineDataEventSchema = z
	.object({ id: idSchema, timeMs: nonNegativeInt.nullable() })
	.strict();

export const engineDataFrameSchema = z
	.object({
		assetVersionId: idSchema,
		durationMs: positiveInt,
		events: z.array(engineDataEventSchema),
		frameKey: z.string().min(1),
		pivot: engineDataPivotSchema.nullable(),
		region: engineDataRegionSchema.nullable(),
	})
	.strict();

export const engineDataAnimationSchema = z
	.object({
		assetFamilyId: idSchema,
		directions: z.array(
			z
				.object({
					direction: idSchema,
					frames: z.array(engineDataFrameSchema),
				})
				.strict()
		),
		looping: z.boolean(),
		name: idSchema,
		playbackSpeed: z.number().positive(),
	})
	.strict();

export const engineDataTilesetSchema = z
	.object({
		assetFamilyId: idSchema,
		compositeVersionId: idSchema,
		tiles: z.array(
			z
				.object({
					assetVersionId: idSchema,
					edges: z
						.object({
							east: idSchema.nullable(),
							north: idSchema.nullable(),
							south: idSchema.nullable(),
							west: idSchema.nullable(),
						})
						.strict(),
					region: engineDataRegionSchema,
					terrainId: idSchema.nullable(),
					unitVersionId: idSchema,
				})
				.strict()
		),
	})
	.strict();

const sizeSchema = z.object({ height: z.number(), width: z.number() }).strict();
const marginsSchema = z
	.object({
		bottom: z.number(),
		left: z.number(),
		right: z.number(),
		top: z.number(),
	})
	.strict();
const safeAreaSchema = z
	.object({
		height: z.number(),
		width: z.number(),
		x: z.number(),
		y: z.number(),
	})
	.strict();

export const engineDataUiComponentSchema = z
	.object({
		assetFamilyId: idSchema,
		id: idSchema,
		states: z.array(
			z
				.object({
					assetVersionId: idSchema,
					id: idSchema,
					naturalSize: sizeSchema,
					stretchMargins: marginsSchema,
					textSafeArea: safeAreaSchema,
				})
				.strict()
		),
	})
	.strict();

export const exportBundleEngineDataSchema = z
	.object({
		animations: z.array(engineDataAnimationSchema),
		tilesets: z.array(engineDataTilesetSchema),
		uiComponents: z.array(engineDataUiComponentSchema),
	})
	.strict();
export type ExportBundleEngineData = z.infer<
	typeof exportBundleEngineDataSchema
>;

export const emptyExportBundleEngineData: ExportBundleEngineData = {
	animations: [],
	tilesets: [],
	uiComponents: [],
};

function compare(left: string, right: string): number {
	return Number(left > right) - Number(left < right);
}

function sortBy<T>(items: T[], key: (item: T) => string): T[] {
	return [...items].sort((left, right) => compare(key(left), key(right)));
}

/**
 * Canonical order so the same data always renders the same manifest. Frame
 * order inside a direction is playback order and is kept as given.
 */
export function canonicalizeExportBundleEngineData(
	data: ExportBundleEngineData
): ExportBundleEngineData {
	return {
		animations: sortBy(
			data.animations,
			(animation) => `${animation.assetFamilyId}/${animation.name}`
		).map((animation) => ({
			...animation,
			directions: sortBy(animation.directions, (entry) => entry.direction).map(
				(entry) => ({
					...entry,
					frames: entry.frames.map((frame) => ({
						...frame,
						events: sortBy(
							frame.events,
							(event) => `${event.timeMs ?? -1}`.padStart(12, "0") + event.id
						),
					})),
				})
			),
		})),
		tilesets: sortBy(
			data.tilesets,
			(tileset) => `${tileset.assetFamilyId}/${tileset.compositeVersionId}`
		).map((tileset) => ({
			...tileset,
			tiles: sortBy(tileset.tiles, (tile) => tile.unitVersionId),
		})),
		uiComponents: sortBy(
			data.uiComponents,
			(component) => `${component.assetFamilyId}/${component.id}`
		).map((component) => ({
			...component,
			states: sortBy(component.states, (state) => state.id),
		})),
	};
}
