import { z } from "zod";

export const assetRecordIdentityCriteria = [
	"independent_product_meaning",
	"independent_lifecycle",
	"delivery_identity",
] as const;

export const assetRecordIdentityCriteriaSchema = z.enum(
	assetRecordIdentityCriteria
);

export const assetRecordSupportLevels = ["general"] as const;

export const assetRecordAvailabilityValues = [
	"active",
	"archived",
	"erased",
] as const;

const pixelDimensionsSchema = z
	.object({
		height: z.number().int().positive(),
		width: z.number().int().positive(),
	})
	.strict();

const visibleContentBoundsSchema = z
	.object({
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
	.strict();

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

export const assetRecordSchema = z
	.object({
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
}
