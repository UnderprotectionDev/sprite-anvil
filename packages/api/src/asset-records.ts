import { z } from "zod";

export const assetRecordIdentityCriteria = [
	"independent_product_meaning",
	"independent_lifecycle",
	"delivery_identity",
] as const;

export const assetRecordIdentityCriteriaSchema = z.enum(
	assetRecordIdentityCriteria
);
export type AssetRecordIdentityCriterion = z.infer<
	typeof assetRecordIdentityCriteriaSchema
>;

export const assetRecordSupportLevels = ["general"] as const;

export const assetRecordAvailabilityValues = [
	"active",
	"archived",
	"erased",
] as const;

export const assetRecordCategoryValues = [
	"character_creature_animation",
	"object_weapon_equipment_states",
	"icon",
	"visual_effect_projectile_shadow_mark",
	"tileset_terrain_texture",
	"background_parallax",
	"ui",
	"portrait_logo_marketing",
	"other",
] as const;

export const assetRecordCategorySchema = z.enum(assetRecordCategoryValues);

export const assetRecordTagsSchema = z
	.array(z.string().trim().min(1).max(40))
	.max(30)
	.refine(
		(tags) =>
			new Set(tags.map((tag) => tag.toLocaleLowerCase("tr-TR"))).size ===
			tags.length,
		"Tags must be unique ignoring case."
	);
export const visibleContentBoundsCoordinateSpaces = [
	"logicalResolution",
	"cellDimensions",
] as const;

const pixelDimensionsSchema = z
	.object({
		height: z.number().int().positive(),
		width: z.number().int().positive(),
	})
	.strict();

const visibleContentBoundsSchema = z
	.object({
		coordinateSpace: z.enum(visibleContentBoundsCoordinateSpaces),
		height: z.number().int().positive(),
		width: z.number().int().positive(),
		x: z.number().int().nonnegative(),
		y: z.number().int().nonnegative(),
	})
	.strict();

function measurementValueSchema<T extends z.ZodType>(valueSchema: T) {
	return z
		.object({
			confirmed: valueSchema.nullable(),
			proposal: valueSchema.nullable(),
		})
		.strict();
}

export const assetRecordMeasurementsSchema = z
	.object({
		atlasDimensions: measurementValueSchema(pixelDimensionsSchema),
		cellDimensions: measurementValueSchema(pixelDimensionsSchema),
		displayScale: measurementValueSchema(z.number().positive()),
		logicalResolution: measurementValueSchema(pixelDimensionsSchema),
		sourceImageDimensions: measurementValueSchema(pixelDimensionsSchema),
		visibleContentBounds: measurementValueSchema(visibleContentBoundsSchema),
	})
	.strict()
	.superRefine((measurements, context) => {
		for (const state of ["proposal", "confirmed"] as const) {
			const bounds = measurements.visibleContentBounds[state];
			if (!bounds) {
				continue;
			}

			const dimensions = measurements[bounds.coordinateSpace][state];
			if (!dimensions) {
				continue;
			}

			if (bounds.x + bounds.width > dimensions.width) {
				context.addIssue({
					code: "custom",
					path: ["visibleContentBounds", state, "width"],
					message:
						"Görünür İçerik Sınırı seçilen koordinat temelinin genişliğini aşamaz.",
				});
			}
			if (bounds.y + bounds.height > dimensions.height) {
				context.addIssue({
					code: "custom",
					path: ["visibleContentBounds", state, "height"],
					message:
						"Görünür İçerik Sınırı seçilen koordinat temelinin yüksekliğini aşamaz.",
				});
			}
		}
	});

export type AssetRecordMeasurements = z.infer<
	typeof assetRecordMeasurementsSchema
>;

export function createEmptyAssetRecordMeasurements(): AssetRecordMeasurements {
	return {
		atlasDimensions: { confirmed: null, proposal: null },
		cellDimensions: { confirmed: null, proposal: null },
		displayScale: { confirmed: null, proposal: null },
		logicalResolution: { confirmed: null, proposal: null },
		sourceImageDimensions: { confirmed: null, proposal: null },
		visibleContentBounds: { confirmed: null, proposal: null },
	};
}

const projectIdSchema = z.uuid();
const visualWorldIdSchema = z.uuid();
const themeIdSchema = z.uuid();

export const assetRecordSchema = z
	.object({
		assetCategory: assetRecordCategorySchema.nullable().optional(),
		availability: z.enum(assetRecordAvailabilityValues),
		createdAt: z.iso.datetime(),
		id: z.uuid(),
		identityCriteria: z
			.array(assetRecordIdentityCriteriaSchema)
			.max(assetRecordIdentityCriteria.length)
			.refine((criteria) => new Set(criteria).size === criteria.length),
		measurements: assetRecordMeasurementsSchema.default(() =>
			createEmptyAssetRecordMeasurements()
		),
		name: z.string().trim().min(1).max(120),
		projectId: projectIdSchema,
		supportLevel: z.enum(assetRecordSupportLevels),
		tags: assetRecordTagsSchema.optional(),
		themeId: themeIdSchema.nullable().optional(),
		visualWorldId: visualWorldIdSchema.nullable().optional(),
	})
	.strict();

export const assetRecordCreateInputSchema = z
	.object({
		id: z.uuid(),
		identityCriteria: z
			.array(assetRecordIdentityCriteriaSchema)
			.min(1)
			.max(assetRecordIdentityCriteria.length)
			.refine((criteria) => new Set(criteria).size === criteria.length),
		name: z.string().trim().min(1).max(120),
		projectId: projectIdSchema,
	})
	.strict();

export const assetRecordListInputSchema = z
	.object({ projectId: projectIdSchema })
	.strict();

export const assetRecordSearchInputSchema = z
	.object({
		assetCategory: assetRecordCategorySchema.optional(),
		availability: z.enum(assetRecordAvailabilityValues).optional(),
		name: z.string().trim().min(1).max(120).optional(),
		projectId: projectIdSchema,
		sourceImageHeight: z.number().int().positive().max(100_000).optional(),
		sourceImageWidth: z.number().int().positive().max(100_000).optional(),
		tag: z.string().trim().min(1).max(40).optional(),
		themeId: themeIdSchema.optional(),
		visualWorldId: visualWorldIdSchema.optional(),
	})
	.strict()
	.superRefine((input, context) => {
		if (
			(input.sourceImageWidth === undefined) !==
			(input.sourceImageHeight === undefined)
		) {
			context.addIssue({
				code: "custom",
				path: [
					input.sourceImageWidth === undefined
						? "sourceImageWidth"
						: "sourceImageHeight",
				],
				message: "Source Image Dimensions require both width and height.",
			});
		}
	});

export const assetRecordMetadataUpdateInputSchema = z
	.object({
		assetCategory: assetRecordCategorySchema.nullable(),
		assetRecordId: z.uuid(),
		projectId: projectIdSchema,
		tags: assetRecordTagsSchema,
		themeId: themeIdSchema.nullable(),
		visualWorldId: visualWorldIdSchema.nullable(),
	})
	.strict()
	.superRefine((input, context) => {
		if (input.themeId && !input.visualWorldId) {
			context.addIssue({
				code: "custom",
				path: ["themeId"],
				message: "A Theme requires its Visual World.",
			});
		}
	});

export const assetRecordSearchVersionSchema = z
	.object({
		fileName: z.string().min(1).max(255).nullable(),
		id: z.uuid(),
		sourceImageHeight: z.number().int().positive().max(100_000),
		sourceImageWidth: z.number().int().positive().max(100_000),
		versionNumber: z.number().int().positive(),
	})
	.strict();

export const assetRecordSearchResponseSchema = z
	.object({
		records: z.array(
			z
				.object({
					matchingVersions: assetRecordSearchVersionSchema.array(),
					record: assetRecordSchema,
				})
				.strict()
		),
		totalCount: z.number().int().nonnegative(),
	})
	.strict();

export const assetRecordGetInputSchema = z
	.object({
		assetRecordId: z.uuid(),
		projectId: projectIdSchema,
	})
	.strict();

export const assetRecordMeasurementsUpdateInputSchema = z
	.object({
		assetRecordId: z.uuid(),
		measurements: assetRecordMeasurementsSchema,
		projectId: projectIdSchema,
	})
	.strict();

export type AssetRecord = z.infer<typeof assetRecordSchema>;
export type MutableAssetRecordAvailability = Extract<
	AssetRecord["availability"],
	"active" | "archived"
>;
export type AssetRecordCreateInput = z.infer<
	typeof assetRecordCreateInputSchema
>;
export type AssetRecordSearchInput = z.infer<
	typeof assetRecordSearchInputSchema
>;
export type AssetRecordSearchResponse = z.infer<
	typeof assetRecordSearchResponseSchema
>;
export type AssetRecordMetadataUpdateInput = z.infer<
	typeof assetRecordMetadataUpdateInputSchema
>;

export type AssetRecordMetadataUpdateResult =
	| { ok: true; record: AssetRecord }
	| {
			ok: false;
			reason:
				| "not_found"
				| "invalid_scope"
				| "family_world_conflict"
				| "erased";
	  };
export type AssetRecordMeasurementsUpdateInput = z.infer<
	typeof assetRecordMeasurementsUpdateInputSchema
>;

export interface AssetRecordStore {
	create: (
		userId: string,
		input: AssetRecordCreateInput
	) => Promise<AssetRecord | null>;
	get: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<AssetRecord | null>;
	list: (userId: string, projectId: string) => Promise<AssetRecord[] | null>;
	search: (
		userId: string,
		input: AssetRecordSearchInput
	) => Promise<AssetRecordSearchResponse | null>;
	setAvailability: (
		userId: string,
		projectId: string,
		assetRecordId: string,
		availability: MutableAssetRecordAvailability
	) => Promise<AssetRecord | null>;
	updateMeasurements: (
		userId: string,
		input: AssetRecordMeasurementsUpdateInput
	) => Promise<AssetRecord | null>;
	updateMetadata: (
		userId: string,
		input: AssetRecordMetadataUpdateInput
	) => Promise<AssetRecordMetadataUpdateResult>;
}
