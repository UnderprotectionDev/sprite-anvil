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
		fileName: z.string().min(1).max(255),
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

export type AssetRecord = z.infer<typeof assetRecordSchema>;
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
			reason: "not_found" | "invalid_scope" | "family_world_conflict";
	  };

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
	updateMetadata: (
		userId: string,
		input: AssetRecordMetadataUpdateInput
	) => Promise<AssetRecordMetadataUpdateResult>;
}
