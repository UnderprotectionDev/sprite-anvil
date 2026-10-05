import { z } from "zod";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);

export const animationTimingReviewFrameSchema = z
	.object({
		assetVersionId: id,
		frameKey: z.string().min(1).max(512),
		durationMs: z.number().int().min(1).max(60_000),
		region: z
			.object({
				x: z.number().int().nonnegative().max(16_384),
				y: z.number().int().nonnegative().max(16_384),
				width: z.number().int().min(1).max(4096),
				height: z.number().int().min(1).max(4096),
			})
			.strict()
			.nullable(),
		motionPhase: z.string().trim().max(120).nullable(),
	})
	.strict();

export const animationTimingReviewListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();

export const animationTimingReviewInputSchema =
	animationTimingReviewListInputSchema
		.extend({
			id: z.string().uuid(),
			contractRevisionId: id,
			animationName: z.string().trim().min(1).max(120),
			playbackSpeed: z.number().min(0.1).max(4),
			looping: z.boolean(),
			directions: z
				.array(
					z
						.object({
							direction: z.string().trim().min(1).max(80),
							frames: z.array(animationTimingReviewFrameSchema).min(1).max(64),
						})
						.strict()
				)
				.refine(
					(directions) =>
						[4, 8].includes(directions.length) &&
						new Set(directions.map((item) => item.direction.toLowerCase()))
							.size === directions.length,
					"Choose four or eight distinct directions."
				),
			outcome: z.enum(["consistent", "needs_follow_up"]),
			rationale: z.string().trim().min(1).max(2000),
		})
		.strict();

export const animationTimingReviewRecordSchema =
	animationTimingReviewInputSchema
		.extend({
			createdAt: z.string().datetime(),
			reviewedByUserId: id,
			versionPins: z
				.array(
					z
						.object({
							assetVersionId: id,
							contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
						})
						.strict()
				)
				.min(1),
			contractSnapshot: specializedProfileContractSchema,
		})
		.strict();

export type AnimationTimingReviewInput = z.infer<
	typeof animationTimingReviewInputSchema
>;
export type AnimationTimingReviewRecord = z.infer<
	typeof animationTimingReviewRecordSchema
>;
export type AnimationTimingReviewFrame = z.infer<
	typeof animationTimingReviewFrameSchema
>;

export interface AnimationTimingReviewStore {
	append: (
		userId: string,
		record: AnimationTimingReviewRecord
	) => Promise<AnimationTimingReviewRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<AnimationTimingReviewRecord[] | null>;
	/** Ids of this family's Asset Versions whose record is not erased. */
	listAccessibleVersionIds: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<Set<string> | null>;
}
