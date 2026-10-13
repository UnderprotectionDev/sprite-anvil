import { z } from "zod";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);
const size = z
	.object({
		width: z.number().int().positive().max(32_768),
		height: z.number().int().positive().max(32_768),
	})
	.strict();
const region = size
	.extend({
		x: z.number().int().nonnegative(),
		y: z.number().int().nonnegative(),
	})
	.strict();
export const portraitReviewObservationSchema = z
	.object({
		outcome: z.enum(["passed", "failed", "inconclusive"]),
		notes: z.string().trim().min(1).max(1000),
	})
	.strict();
export const portraitReviewItemSchema = z
	.object({
		assetRecordId: id,
		assetVersionId: id,
		expression: z.string().trim().min(1).max(100),
		usagePurpose: z.enum(["dialogue", "ui"]),
		naturalSize: size,
		crop: region,
		targetSize: size,
		background: z.enum(["light", "dark", "transparent"]),
	})
	.strict()
	.superRefine((item, ctx) => {
		if (
			item.crop.x + item.crop.width > item.naturalSize.width ||
			item.crop.y + item.crop.height > item.naturalSize.height
		) {
			ctx.addIssue({
				code: "custom",
				path: ["crop"],
				message: "Crop must fit within the verified source image.",
			});
		}
	});
export const portraitIdentityReviewListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();
export const portraitIdentityReviewInputSchema =
	portraitIdentityReviewListInputSchema
		.extend({
			id: z.uuid(),
			contractRevisionId: id,
			visualWorldId: id,
			subjectIdentityId: id,
			canonicalDesignId: id,
			items: z
				.array(portraitReviewItemSchema)
				.min(2)
				.max(24)
				.refine(
					(items) => new Set(items.map((i) => i.expression)).size >= 2,
					"Compare at least two expressions."
				)
				.refine(
					(items) =>
						new Set(items.map((i) => JSON.stringify(i))).size === items.length,
					"Duplicate usage entries are not allowed."
				),
			observations: z
				.object({
					identity: portraitReviewObservationSchema,
					expression: portraitReviewObservationSchema,
					crop: portraitReviewObservationSchema,
				})
				.strict(),
			rationale: z.string().trim().min(1).max(2000),
		})
		.strict();
export const portraitReviewVersionPinSchema = z
	.object({
		assetRecordId: id,
		assetRecordName: z.string().trim().min(1).max(120),
		assetVersionId: id,
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		contentLength: z.number().int().positive(),
		contentType: z.enum(["image/png", "image/webp"]),
		versionNumber: z.number().int().positive(),
		naturalSize: size,
	})
	.strict();
export const portraitIdentityReviewRecordSchema =
	portraitIdentityReviewInputSchema
		.extend({
			contractSnapshot: specializedProfileContractSchema,
			createdAt: z.string().datetime(),
			reviewedByUserId: id,
			canonicalAssetVersionId: id,
			familyName: z.string().min(1).max(120),
			useContext: z.string().min(1).max(120),
			versionPins: z.array(portraitReviewVersionPinSchema).min(1).max(25),
			outcome: z.enum(["passed", "failed", "inconclusive"]),
		})
		.strict()
		.superRefine((record, ctx) => {
			if (record.contractSnapshot.profileId !== "portrait_logo_marketing") {
				ctx.addIssue({
					code: "custom",
					path: ["contractSnapshot"],
					message:
						"A portrait review requires its Specialized Profile Contract.",
				});
			}
			if (
				new Set(record.versionPins.map((p) => p.assetVersionId)).size !==
					record.versionPins.length ||
				!record.versionPins.some(
					(p) => p.assetVersionId === record.canonicalAssetVersionId
				)
			) {
				ctx.addIssue({
					code: "custom",
					path: ["versionPins"],
					message: "Pin the exact Canonical Design once.",
				});
			}
			for (const item of record.items) {
				if (
					!record.versionPins.some(
						(p) =>
							p.assetVersionId === item.assetVersionId &&
							p.assetRecordId === item.assetRecordId &&
							p.naturalSize.width === item.naturalSize.width &&
							p.naturalSize.height === item.naturalSize.height
					)
				) {
					ctx.addIssue({
						code: "custom",
						path: ["items"],
						message:
							"Every expression must match its exact version and source dimensions.",
					});
				}
			}
			if (record.outcome !== getPortraitReviewOutcome(record.observations)) {
				ctx.addIssue({
					code: "custom",
					path: ["outcome"],
					message: "Outcome must preserve the user's observations.",
				});
			}
		});
export type PortraitIdentityReviewInput = z.infer<
	typeof portraitIdentityReviewInputSchema
>;
export type PortraitIdentityReviewRecord = z.infer<
	typeof portraitIdentityReviewRecordSchema
>;
export type PortraitReviewItem = z.infer<typeof portraitReviewItemSchema>;
export function getPortraitReviewOutcome(
	observations: PortraitIdentityReviewInput["observations"]
) {
	const outcomes = Object.values(observations).map((o) => o.outcome);
	if (outcomes.includes("failed")) {
		return "failed";
	}
	return outcomes.includes("inconclusive") ? "inconclusive" : "passed";
}
export interface PortraitIdentityReviewStore {
	append: (
		userId: string,
		record: PortraitIdentityReviewRecord
	) => Promise<PortraitIdentityReviewRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<PortraitIdentityReviewRecord[] | null>;
	listAccessibleVersionIds: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<Set<string> | null>;
}
