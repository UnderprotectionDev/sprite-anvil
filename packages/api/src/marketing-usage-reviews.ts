import { z } from "zod";
import { iconFamilyReviewVersionSummarySchema } from "./icon-family-reviews";
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
const outcome = z.enum(["passed", "failed", "inconclusive"]);
export const marketingUsageItemSchema = z
	.object({
		assetRecordId: id,
		assetVersionId: id,
		usePurpose: z.enum(["logo", "opening", "store", "marketing"]),
		naturalSize: size,
		displaySize: size,
		crop: rectangle,
		safeArea: rectangle,
		presentation: z.enum(["transparent", "opaque"]),
		opaqueColor: z
			.string()
			.regex(/^#[a-fA-F0-9]{6}$/)
			.nullable(),
		observations: z
			.array(
				z
					.object({
						background: z.enum(["light", "dark"]),
						readability: outcome,
						safeArea: outcome,
						crop: outcome,
						notes: z.string().trim().min(1).max(2000),
					})
					.strict()
			)
			.length(2)
			.refine(
				(items) => new Set(items.map((item) => item.background)).size === 2,
				"Review both light and dark backgrounds."
			),
	})
	.strict()
	.superRefine((item, ctx) => {
		const { crop, safeArea, naturalSize } = item;
		if (
			crop.x + crop.width > naturalSize.width ||
			crop.y + crop.height > naturalSize.height
		) {
			ctx.addIssue({
				code: "custom",
				path: ["crop"],
				message: "Crop must fit inside the source image.",
			});
		}
		if (
			safeArea.x < crop.x ||
			safeArea.y < crop.y ||
			safeArea.x + safeArea.width > crop.x + crop.width ||
			safeArea.y + safeArea.height > crop.y + crop.height
		) {
			ctx.addIssue({
				code: "custom",
				path: ["safeArea"],
				message: "Safe area must fit inside the crop.",
			});
		}
		if ((item.presentation === "opaque") !== (item.opaqueColor !== null)) {
			ctx.addIssue({
				code: "custom",
				path: ["opaqueColor"],
				message: "Choose a flattening color only for opaque use.",
			});
		}
	});
export const marketingUsageReviewListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();
export const marketingUsageReviewInputSchema =
	marketingUsageReviewListInputSchema
		.extend({
			id: z.uuid(),
			contractRevisionId: id,
			visualWorldId: id,
			canonicalDesignId: id.nullable(),
			items: z.array(marketingUsageItemSchema).min(1).max(24),
		})
		.strict();
export const marketingUsageReviewRecordSchema = marketingUsageReviewInputSchema
	.extend({
		canonicalAssetVersionId: id.nullable(),
		contractSnapshot: specializedProfileContractSchema,
		createdAt: z.string().datetime(),
		reviewedByUserId: id,
		versionPins: z
			.array(
				iconFamilyReviewVersionSummarySchema
					.extend({ naturalSize: size })
					.strict()
			)
			.min(1)
			.max(24),
	})
	.strict()
	.superRefine((record, ctx) => {
		if (
			(record.canonicalDesignId === null) !==
			(record.canonicalAssetVersionId === null)
		) {
			ctx.addIssue({
				code: "custom",
				message: "Canonical Design and exact version must be pinned together.",
			});
		}
		if (
			record.contractSnapshot.profileId !== "portrait_logo_marketing" ||
			record.contractRevisionId !==
				`${record.contractSnapshot.profileId}@${record.contractSnapshot.version}`
		) {
			ctx.addIssue({
				code: "custom",
				message:
					"Marketing review requires its exact Specialized Profile Contract.",
			});
		}
		if (
			new Set(record.versionPins.map((pin) => pin.assetVersionId)).size !==
				record.versionPins.length ||
			record.versionPins.some(
				(pin) =>
					!record.items.some(
						(item) => item.assetVersionId === pin.assetVersionId
					)
			) ||
			record.items.some(
				(item) =>
					!record.versionPins.some(
						(pin) =>
							pin.assetVersionId === item.assetVersionId &&
							pin.assetRecordId === item.assetRecordId &&
							pin.naturalSize.width === item.naturalSize.width &&
							pin.naturalSize.height === item.naturalSize.height
					)
			)
		) {
			ctx.addIssue({
				code: "custom",
				path: ["versionPins"],
				message:
					"Every usage must retain its exact source version and dimensions.",
			});
		}
	});
export const marketingUsageReviewPackageSchema = z
	.object({
		packageType: z.literal("sprite-anvil.marketing-usage-review"),
		schemaVersion: z.literal(1),
		record: marketingUsageReviewRecordSchema,
	})
	.strict();
export type MarketingUsageReviewInput = z.infer<
	typeof marketingUsageReviewInputSchema
>;
export type MarketingUsageReviewRecord = z.infer<
	typeof marketingUsageReviewRecordSchema
>;
export interface MarketingUsageReviewStore {
	append: (
		userId: string,
		record: MarketingUsageReviewRecord
	) => Promise<MarketingUsageReviewRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<MarketingUsageReviewRecord[] | null>;
	listAccessibleVersionIds: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<Set<string> | null>;
}
export function createMarketingUsageReviewPackage(
	record: MarketingUsageReviewRecord
) {
	return marketingUsageReviewPackageSchema.parse({
		packageType: "sprite-anvil.marketing-usage-review",
		schemaVersion: 1,
		record,
	});
}
