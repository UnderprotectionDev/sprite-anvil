import { z } from "zod";
import {
	backgroundLayerLayoutListInputSchema,
	backgroundLayerLayoutRecordSchema,
} from "./background-layer-layouts";

const id = z.string().trim().min(1).max(200);
export const backgroundScrollingChecks = [
	"loop",
	"seam",
	"crop",
	"contrast",
	"playerVisibility",
] as const;
const outcome = z.enum(["passed", "failed", "inconclusive"]);
const observation = z
	.object({ outcome, notes: z.string().trim().min(1).max(2000) })
	.strict();
export const backgroundScrollingSetupSchema = z
	.object({
		layoutId: z.uuid(),
		motions: z
			.array(
				z
					.object({
						layerId: id,
						speed: z.number().min(-10_000).max(10_000),
						loop: z.boolean(),
						startOffset: z.number().int().nonnegative().max(32_768),
					})
					.strict()
			)
			.min(1)
			.max(24)
			.refine(
				(items) =>
					new Set(items.map((item) => item.layerId)).size === items.length,
				"Scrolling settings must use unique layer identities."
			)
			.refine(
				(items) => items.some((item) => item.speed !== 0),
				"At least one layer must move during the scrolling test."
			),
		durationMs: z.number().int().min(1).max(120_000),
		player: z
			.object({
				assetVersionId: id,
				x: z.number().int().nonnegative(),
				y: z.number().int().nonnegative(),
				width: z.number().int().positive().max(32_768),
				height: z.number().int().positive().max(32_768),
				afterLayerId: id.nullable(),
			})
			.strict(),
	})
	.strict();
export const backgroundScrollingTestInputSchema =
	backgroundLayerLayoutListInputSchema
		.extend({
			id: z.uuid(),
			setup: backgroundScrollingSetupSchema,
			playbackMs: z.number().int().positive().max(120_000),
			observations: z
				.object({
					loop: observation,
					seam: observation,
					crop: observation,
					contrast: observation,
					playerVisibility: observation,
				})
				.strict(),
		})
		.strict()
		.superRefine((input, ctx) => {
			if (input.playbackMs !== input.setup.durationMs) {
				ctx.addIssue({
					code: "custom",
					message:
						"Play the complete configured scrolling test before recording observations.",
					path: ["playbackMs"],
				});
			}
		});
export const backgroundScrollingTestRecordSchema =
	backgroundScrollingTestInputSchema
		.safeExtend({
			layoutSnapshot: backgroundLayerLayoutRecordSchema,
			playerPin: z
				.object({
					assetVersionId: id,
					assetRecordId: id,
					assetRecordName: z.string().min(1).max(120),
					contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
					versionNumber: z.number().int().positive(),
					width: z.number().int().positive(),
					height: z.number().int().positive(),
				})
				.strict(),
			outcome,
			createdAt: z.string().datetime(),
			createdByUserId: id,
		})
		.superRefine((record, ctx) => {
			const layout = record.layoutSnapshot;
			const [first] = layout.layers;
			if (
				!first ||
				layout.id !== record.setup.layoutId ||
				layout.projectId !== record.projectId ||
				layout.assetFamilyId !== record.assetFamilyId
			) {
				ctx.addIssue({
					code: "custom",
					message: "Scrolling test must pin its exact accessible layer layout.",
				});
				return;
			}
			const { width, height } = first.crop;
			const { player } = record.setup;
			if (
				record.playerPin.assetVersionId !== player.assetVersionId ||
				player.width * record.playerPin.height !==
					player.height * record.playerPin.width
			) {
				ctx.addIssue({
					code: "custom",
					message:
						"Player geometry must preserve its exact source aspect ratio.",
				});
			}
			if (
				player.afterLayerId !== null &&
				!layout.layers.some((layer) => layer.id === player.afterLayerId)
			) {
				ctx.addIssue({
					code: "custom",
					message: "Player order must reference a layer in this layout.",
				});
			}
			if (
				record.setup.motions.length !== layout.layers.length ||
				layout.layers.some(
					(layer) =>
						!record.setup.motions.some((motion) => motion.layerId === layer.id)
				)
			) {
				ctx.addIssue({
					code: "custom",
					message: "Every layout layer requires exactly one scrolling setting.",
				});
			}
			for (const layer of layout.layers) {
				if (layer.crop.width * height !== layer.crop.height * width) {
					ctx.addIssue({
						code: "custom",
						message: "All scrolling layers must share one target aspect ratio.",
					});
				}
				const scale = width / layer.crop.width;
				const safe = layer.safeArea;
				if (
					player.x < (safe.x - layer.crop.x) * scale ||
					player.y < (safe.y - layer.crop.y) * scale ||
					player.x + player.width >
						(safe.x - layer.crop.x + safe.width) * scale ||
					player.y + player.height >
						(safe.y - layer.crop.y + safe.height) * scale
				) {
					ctx.addIssue({
						code: "custom",
						message:
							"Player silhouette must remain inside every layer's safe area.",
					});
				}
			}
			if (
				record.outcome !== getBackgroundScrollingOutcome(record.observations)
			) {
				ctx.addIssue({
					code: "custom",
					message: "Scrolling outcome must match the human observations.",
				});
			}
		});
export type BackgroundScrollingSetup = z.infer<
	typeof backgroundScrollingSetupSchema
>;
export type BackgroundScrollingTestInput = z.infer<
	typeof backgroundScrollingTestInputSchema
>;
export type BackgroundScrollingTestRecord = z.infer<
	typeof backgroundScrollingTestRecordSchema
>;
export function getBackgroundScrollingOutcome(
	observations: BackgroundScrollingTestInput["observations"]
) {
	const results = backgroundScrollingChecks.map(
		(check) => observations[check].outcome
	);
	if (results.includes("failed")) {
		return "failed" as const;
	}
	return results.includes("inconclusive")
		? ("inconclusive" as const)
		: ("passed" as const);
}
export interface BackgroundScrollingTestStore {
	append: (
		userId: string,
		record: BackgroundScrollingTestRecord
	) => Promise<BackgroundScrollingTestRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<BackgroundScrollingTestRecord[] | null>;
}
