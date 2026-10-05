import { z } from "zod";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);

export const iconFamilyReviewLogicalSizeSchema = z
	.object({
		height: z.number().int().min(1).max(4096),
		width: z.number().int().min(1).max(4096),
	})
	.strict();

export const iconFamilyReviewItemSchema = z
	.object({
		assetRecordId: id,
		assetVersionId: id,
		logicalSize: iconFamilyReviewLogicalSizeSchema,
		usageVariant: z.string().trim().min(1).max(100),
	})
	.strict();

const iconFamilyReviewAssessmentSchema = z.enum([
	"consistent",
	"needs_follow_up",
	"inconclusive",
]);

const comparisonSchema = z
	.object({
		assessment: iconFamilyReviewAssessmentSchema,
		notes: z.string().trim().min(1).max(1000),
	})
	.strict();

const stateOrRarityColorComparisonSchema = z
	.object({
		assessment: z.enum([
			"identity_preserved",
			"identity_changed",
			"inconclusive",
		]),
		notes: z.string().trim().min(1).max(1000),
	})
	.strict();

export const iconFamilyReviewComparisonsSchema = z
	.object({
		detailDensity: comparisonSchema,
		lightingDirection: comparisonSchema,
		objectScale: comparisonSchema,
		outline: comparisonSchema,
		stateOrRarityColor: stateOrRarityColorComparisonSchema,
	})
	.strict();

export const iconFamilyReviewListInputSchema = z
	.object({ assetFamilyId: id, projectId: id })
	.strict();

export const iconFamilyReviewInputSchema = iconFamilyReviewListInputSchema
	.extend({
		comparisons: iconFamilyReviewComparisonsSchema,
		contractRevisionId: id,
		grayscaleCompared: z.literal(true),
		id: z.uuid(),
		items: z
			.array(iconFamilyReviewItemSchema)
			.min(2)
			.max(24)
			.refine(
				(items) => new Set(items.map((item) => item.assetRecordId)).size >= 2,
				"Compare at least two distinct icon Asset Records."
			)
			.refine(
				(items) =>
					new Set(
						items.map(
							(item) => `${item.logicalSize.width}x${item.logicalSize.height}`
						)
					).size >= 2,
				"Compare at least two distinct logical sizes."
			)
			.refine(
				(items) =>
					new Set(
						items.map(
							(item) =>
								`${item.assetVersionId}:${item.usageVariant}:${item.logicalSize.width}x${item.logicalSize.height}`
						)
					).size === items.length,
				"Duplicate icon usage entries are not allowed."
			),
		rationale: z.string().trim().min(1).max(2000),
		testedBackgrounds: z
			.array(z.enum(["light", "dark"]))
			.length(2)
			.refine((backgrounds) => new Set(backgrounds).size === 2),
		outcome: z.enum(["consistent", "needs_follow_up"]),
	})
	.strict();

export const iconFamilyReviewVersionSummarySchema = z
	.object({
		assetRecordId: id,
		assetRecordName: z.string().trim().min(1).max(120),
		assetVersionId: id,
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		contentLength: z.number().int().positive(),
		contentType: z.enum(["image/png", "image/webp"]),
		versionNumber: z.number().int().positive(),
	})
	.strict();

export const iconFamilyReviewRecordSchema = iconFamilyReviewInputSchema
	.extend({
		contractSnapshot: specializedProfileContractSchema,
		createdAt: z.string().datetime(),
		reviewedByUserId: id,
		versionPins: z
			.array(iconFamilyReviewVersionSummarySchema)
			.min(2)
			.refine(
				(pins) =>
					new Set(pins.map((pin) => pin.assetVersionId)).size === pins.length,
				"Each exact Asset Version must have one summary."
			),
	})
	.strict()
	.superRefine((record, context) => {
		if (record.contractSnapshot.profileId !== "icon") {
			context.addIssue({
				code: "custom",
				path: ["contractSnapshot", "profileId"],
				message:
					"An icon review requires the icon Specialized Profile Contract.",
			});
		}
		for (const item of record.items) {
			if (
				!record.versionPins.some(
					(pin) =>
						pin.assetRecordId === item.assetRecordId &&
						pin.assetVersionId === item.assetVersionId
				)
			) {
				context.addIssue({
					code: "custom",
					path: ["versionPins"],
					message:
						"Every compared icon must have a pinned Asset Version summary.",
				});
				break;
			}
		}
	});

export const iconFamilyReviewArchiveSchema = z
	.object({
		archiveType: z.literal("sprite-anvil.icon-family-review"),
		exportedAt: z.string().datetime(),
		record: iconFamilyReviewRecordSchema,
		schemaVersion: z.literal(1),
	})
	.strict();

export type IconFamilyReviewInput = z.infer<typeof iconFamilyReviewInputSchema>;
export type IconFamilyReviewRecord = z.infer<
	typeof iconFamilyReviewRecordSchema
>;
export type IconFamilyReviewVersionSummary = z.infer<
	typeof iconFamilyReviewVersionSummarySchema
>;
export type IconFamilyReviewArchive = z.infer<
	typeof iconFamilyReviewArchiveSchema
>;

export interface IconFamilyReviewStore {
	append: (
		userId: string,
		record: IconFamilyReviewRecord
	) => Promise<IconFamilyReviewRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<IconFamilyReviewRecord[] | null>;
	/** Versions whose Asset Record has not been erased. */
	listAccessibleVersionIds: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<Set<string> | null>;
}

export function createIconFamilyReviewArchive(
	record: IconFamilyReviewRecord,
	exportedAt = new Date().toISOString()
): IconFamilyReviewArchive {
	return iconFamilyReviewArchiveSchema.parse({
		archiveType: "sprite-anvil.icon-family-review",
		exportedAt,
		record,
		schemaVersion: 1,
	});
}
