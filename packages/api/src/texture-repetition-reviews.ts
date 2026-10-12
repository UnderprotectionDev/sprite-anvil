import { z } from "zod";
import { unitVersionSchema } from "./asset-versions";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(128);
export const textureAtlasRegionSchema = z
	.object({
		x: z.number().int().nonnegative(),
		y: z.number().int().nonnegative(),
		width: z.number().int().min(1).max(4096),
		height: z.number().int().min(1).max(4096),
	})
	.strict();
const repeatAxes = z
	.array(z.enum(["x", "y"]))
	.min(1)
	.max(2)
	.refine(
		(axes) => new Set(axes).size === axes.length,
		"Repeat axes must be unique."
	);
export const textureRepetitionListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();
export const textureRepetitionTargetSchema = textureRepetitionListInputSchema
	.extend({
		contractRevisionId: id,
		unitVersionId: id,
		atlasRegion: textureAtlasRegionSchema,
		terrainId: id.nullable(),
		repeatAxes,
	})
	.strict();
export const textureRepetitionReviewInputSchema = textureRepetitionTargetSchema
	.extend({
		id: z.uuid(),
		shiftedOffset: z
			.object({
				x: z.number().int().nonnegative(),
				y: z.number().int().nonnegative(),
			})
			.strict(),
		observations: z
			.array(
				z
					.object({
						arrangement: z.enum(["2x2", "3x3", "shifted"]),
						outcome: z.enum([
							"passed",
							"failed",
							"inconclusive",
							"needs_follow_up",
						]),
						notes: z.string().trim().min(1).max(2000),
					})
					.strict()
			)
			.length(3)
			.refine(
				(items) => new Set(items.map((item) => item.arrangement)).size === 3,
				"Review all three repeat arrangements."
			),
	})
	.strict()
	.superRefine((input, ctx) => {
		if (
			input.shiftedOffset.x === 0 &&
			input.shiftedOffset.y === 0 &&
			input.repeatAxes.some(
				(axis) =>
					(axis === "x" ? input.atlasRegion.width : input.atlasRegion.height) >
					1
			)
		) {
			ctx.addIssue({
				code: "custom",
				path: ["shiftedOffset"],
				message:
					"Shift at least one repeated axis to inspect a shifted arrangement.",
			});
		}
		for (const axis of ["x", "y"] as const) {
			const size =
				axis === "x" ? input.atlasRegion.width : input.atlasRegion.height;
			if (
				input.shiftedOffset[axis] >= size ||
				(!input.repeatAxes.includes(axis) && input.shiftedOffset[axis] !== 0)
			) {
				ctx.addIssue({
					code: "custom",
					path: ["shiftedOffset", axis],
					message:
						"Offset must lie within the texture on an enabled repeat axis.",
				});
			}
		}
	});
const edgeAxisSchema = z
	.object({
		mismatchCount: z.number().int().nonnegative(),
		firstMismatch: z.number().int().nonnegative().nullable(),
	})
	.strict()
	.refine(
		(result) =>
			(result.mismatchCount === 0) === (result.firstMismatch === null),
		"Mismatch evidence must match the count."
	);
export const textureEdgeCheckSchema = z
	.object({ x: edgeAxisSchema.nullable(), y: edgeAxisSchema.nullable() })
	.strict();
export const textureRepetitionReviewRecordSchema =
	textureRepetitionReviewInputSchema
		.safeExtend({
			unitSnapshot: unitVersionSchema,
			contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
			contractSnapshot: specializedProfileContractSchema,
			edgeCheck: textureEdgeCheckSchema,
			createdAt: z.string().datetime(),
			reviewedByUserId: id,
		})
		.superRefine((record, ctx) => {
			if (
				record.unitSnapshot.id !== record.unitVersionId ||
				record.unitSnapshot.projectId !== record.projectId ||
				record.unitSnapshot.unitType !== "tile" ||
				record.contractSnapshot.profileId !== "tileset_terrain_texture"
			) {
				ctx.addIssue({
					code: "custom",
					message: "Texture review pins do not match its target.",
				});
			}
			for (const axis of ["x", "y"] as const) {
				if (
					(record.edgeCheck[axis] !== null) !==
					record.repeatAxes.includes(axis)
				) {
					ctx.addIssue({
						code: "custom",
						message: "Edge checks must cover exactly the declared repeat axes.",
					});
				}
			}
		});
export const textureRepetitionPackageSchema = z
	.object({
		packageType: z.literal("sprite-anvil.texture-repetition"),
		schemaVersion: z.literal(1),
		record: textureRepetitionReviewRecordSchema,
		tileset: z
			.object({
				tiles: z
					.array(
						z
							.object({
								id,
								unit_version_id: id,
								atlas_region: textureAtlasRegionSchema,
							})
							.strict()
					)
					.length(1),
				terrain_id: id.nullable(),
			})
			.strict(),
		texture: z.object({ repeat_axes: repeatAxes }).strict(),
	})
	.strict()
	.superRefine((value, ctx) => {
		const { record } = value;
		const [tile] = value.tileset.tiles;
		if (
			!tile ||
			tile.id !== record.unitSnapshot.unitKey ||
			tile.unit_version_id !== record.unitVersionId ||
			JSON.stringify(tile.atlas_region) !==
				JSON.stringify(record.atlasRegion) ||
			value.tileset.terrain_id !== record.terrainId ||
			value.texture.repeat_axes.join(",") !== record.repeatAxes.join(",")
		) {
			ctx.addIssue({
				code: "custom",
				message: "Texture metadata differs from its pinned review.",
			});
		}
		if (
			record.edgeCheck.x?.mismatchCount ||
			record.edgeCheck.y?.mismatchCount
		) {
			ctx.addIssue({
				code: "custom",
				message: "Exact edge mismatch blocks texture metadata export.",
			});
		}
	});
export type TextureRepetitionTarget = z.infer<
	typeof textureRepetitionTargetSchema
>;
export type TextureRepetitionReviewInput = z.infer<
	typeof textureRepetitionReviewInputSchema
>;
export type TextureRepetitionReviewRecord = z.infer<
	typeof textureRepetitionReviewRecordSchema
>;
export type TextureEdgeCheck = z.infer<typeof textureEdgeCheckSchema>;
export type TextureAtlasRegion = z.infer<typeof textureAtlasRegionSchema>;
export interface TextureRepetitionReviewStore {
	append: (
		userId: string,
		record: TextureRepetitionReviewRecord
	) => Promise<TextureRepetitionReviewRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<TextureRepetitionReviewRecord[] | null>;
}
export function createTextureRepetitionPackage(
	record: TextureRepetitionReviewRecord
) {
	const parsed = textureRepetitionReviewRecordSchema.parse(record);
	if (parsed.edgeCheck.x?.mismatchCount || parsed.edgeCheck.y?.mismatchCount) {
		throw new Error("Exact edge mismatch blocks texture metadata export.");
	}
	return textureRepetitionPackageSchema.parse({
		packageType: "sprite-anvil.texture-repetition",
		schemaVersion: 1,
		record: parsed,
		tileset: {
			tiles: [
				{
					id: parsed.unitSnapshot.unitKey,
					unit_version_id: parsed.unitVersionId,
					atlas_region: parsed.atlasRegion,
				},
			],
			terrain_id: parsed.terrainId,
		},
		texture: { repeat_axes: parsed.repeatAxes },
	});
}
