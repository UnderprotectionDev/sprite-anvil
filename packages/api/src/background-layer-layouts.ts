import { z } from "zod";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);
const size = z
	.object({
		width: z.number().int().positive().max(32_768),
		height: z.number().int().positive().max(32_768),
	})
	.strict();
const rectangle = size
	.extend({
		x: z.number().int().nonnegative(),
		y: z.number().int().nonnegative(),
	})
	.strict();

// Geometry is in source-image pixels, measured from the top-left corner.
export const backgroundLayerSchema = z
	.object({
		id,
		assetRecordId: id,
		assetVersionId: id,
		order: z.number().int().nonnegative(),
		naturalSize: size,
		targetAspectRatio: size,
		crop: rectangle,
		safeArea: rectangle,
	})
	.strict()
	.superRefine((layer, context) => {
		const { crop, safeArea, naturalSize, targetAspectRatio } = layer;
		if (
			crop.x + crop.width > naturalSize.width ||
			crop.y + crop.height > naturalSize.height
		) {
			context.addIssue({
				code: "custom",
				path: ["crop"],
				message: "Crop must fit inside the source image.",
			});
		}
		if (
			crop.width * targetAspectRatio.height !==
			crop.height * targetAspectRatio.width
		) {
			context.addIssue({
				code: "custom",
				path: ["targetAspectRatio"],
				message: "Crop must match the target aspect ratio.",
			});
		}
		if (
			safeArea.x < crop.x ||
			safeArea.y < crop.y ||
			safeArea.x + safeArea.width > crop.x + crop.width ||
			safeArea.y + safeArea.height > crop.y + crop.height
		) {
			context.addIssue({
				code: "custom",
				path: ["safeArea"],
				message: "Player safe area must remain inside the crop.",
			});
		}
	});
export const backgroundLayerLayoutListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();
export const backgroundLayerLayoutInputSchema =
	backgroundLayerLayoutListInputSchema
		.extend({
			id: z.uuid(),
			contractRevisionId: id,
			visualWorldId: id,
			layers: z
				.array(backgroundLayerSchema)
				.min(1)
				.max(24)
				.refine(
					(layers) =>
						new Set(layers.map((layer) => layer.id)).size === layers.length,
					"Layer identities must be unique."
				)
				.refine(
					(layers) =>
						new Set(layers.map((layer) => layer.order)).size === layers.length,
					"Layer order values must be unique."
				),
		})
		.strict();
const versionPin = z
	.object({
		assetRecordId: id,
		assetRecordName: z.string().min(1).max(120),
		assetVersionId: id,
		versionNumber: z.number().int().positive(),
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		contentLength: z.number().int().positive(),
		contentType: z.enum(["image/png", "image/webp"]),
		naturalSize: size,
	})
	.strict();
export const backgroundLayerLayoutRecordSchema =
	backgroundLayerLayoutInputSchema
		.extend({
			contractSnapshot: specializedProfileContractSchema,
			createdAt: z.string().datetime(),
			createdByUserId: id,
			versionPins: z.array(versionPin).min(1).max(24),
		})
		.strict()
		.superRefine((record, context) => {
			if (record.contractSnapshot.profileId !== "background_parallax") {
				context.addIssue({
					code: "custom",
					path: ["contractSnapshot"],
					message:
						"A background layout requires the background Specialized Profile Contract.",
				});
			}
			if (
				new Set(record.versionPins.map((pin) => pin.assetVersionId)).size !==
					record.versionPins.length ||
				record.versionPins.some(
					(pin) =>
						!record.layers.some(
							(layer) => layer.assetVersionId === pin.assetVersionId
						)
				) ||
				record.layers.some(
					(layer) =>
						!record.versionPins.some(
							(pin) =>
								pin.assetRecordId === layer.assetRecordId &&
								pin.assetVersionId === layer.assetVersionId &&
								pin.naturalSize.width === layer.naturalSize.width &&
								pin.naturalSize.height === layer.naturalSize.height
						)
				)
			) {
				context.addIssue({
					code: "custom",
					path: ["versionPins"],
					message:
						"Every layer must retain its exact source version and dimensions.",
				});
			}
		});
export type BackgroundLayerLayoutInput = z.infer<
	typeof backgroundLayerLayoutInputSchema
>;
export type BackgroundLayerLayoutRecord = z.infer<
	typeof backgroundLayerLayoutRecordSchema
>;
export interface BackgroundLayerLayoutStore {
	append: (
		userId: string,
		record: BackgroundLayerLayoutRecord
	) => Promise<BackgroundLayerLayoutRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<BackgroundLayerLayoutRecord[] | null>;
	listAccessibleVersionIds: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<Set<string> | null>;
}
