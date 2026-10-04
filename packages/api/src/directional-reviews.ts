import { z } from "zod";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().min(1).max(200);
export const directionalReviewCriteria = {
	silhouette: "Siluet",
	proportions: "Oran",
	equipmentSide: "Ekipman tarafı",
	palette: "Palet",
	perspective: "Perspektif",
	scale: "Ölçek",
	groundContact: "Zemine temas",
} as const;
export const directionalReviewFrameSchema = z
	.object({
		assetVersionId: id,
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
	})
	.strict();
export const directionalReviewListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();
export const directionalReviewInputSchema = directionalReviewListInputSchema
	.extend({
		id: z.string().uuid(),
		canonicalDesignId: id,
		contractRevisionId: id,
		directions: z
			.array(
				z
					.object({
						direction: z.string().trim().min(1).max(80),
						frames: z.array(directionalReviewFrameSchema).min(1).max(64),
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
		observations: z
			.object({
				silhouette: z.string().trim().min(1).max(1000),
				proportions: z.string().trim().min(1).max(1000),
				equipmentSide: z.string().trim().min(1).max(1000),
				palette: z.string().trim().min(1).max(1000),
				perspective: z.string().trim().min(1).max(1000),
				scale: z.string().trim().min(1).max(1000),
				groundContact: z.string().trim().min(1).max(1000),
			})
			.strict(),
		outcome: z.enum(["consistent", "needs_follow_up"]),
		rationale: z.string().trim().min(1).max(2000),
	})
	.strict();
export const directionalReviewRecordSchema = directionalReviewInputSchema
	.extend({
		createdAt: z.string().datetime(),
		reviewedByUserId: id,
		canonicalAssetVersionId: id,
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
export type DirectionalReviewInput = z.infer<
	typeof directionalReviewInputSchema
>;
export type DirectionalReviewRecord = z.infer<
	typeof directionalReviewRecordSchema
>;
export type DirectionalReviewFrame = z.infer<
	typeof directionalReviewFrameSchema
>;
export interface DirectionalReviewStore {
	append: (
		userId: string,
		record: DirectionalReviewRecord
	) => Promise<DirectionalReviewRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<DirectionalReviewRecord[] | null>;
	/** Ids of this family's Asset Versions whose record is not erased. */
	listAccessibleVersionIds: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<Set<string> | null>;
}
