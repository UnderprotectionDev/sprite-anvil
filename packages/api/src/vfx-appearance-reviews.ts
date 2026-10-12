import { z } from "zod";
import { readinessEvidenceSchema } from "./family-readiness";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);
const size = z.number().int().min(1).max(4096);
export const vfxAppearanceFrameSchema = z
	.object({
		assetVersionId: id,
		frameKey: z.string().min(1).max(512),
		durationMs: z.number().int().min(1).max(60_000),
		region: z
			.object({
				x: z.number().int().nonnegative(),
				y: z.number().int().nonnegative(),
				width: size,
				height: size,
			})
			.strict(),
		offset: z
			.object({
				x: z.number().int().min(-4096).max(4096),
				y: z.number().int().min(-4096).max(4096),
			})
			.strict(),
	})
	.strict();
export const vfxAppearanceListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();
export const vfxAppearanceInputSchema = vfxAppearanceListInputSchema
	.extend({
		id: z.uuid(),
		contractRevisionId: id,
		name: z.string().trim().min(1).max(120),
		cell: z.object({ width: size, height: size }).strict(),
		frames: z
			.array(vfxAppearanceFrameSchema)
			.min(1)
			.max(64)
			.refine(
				(frames) =>
					new Set(frames.map((frame) => frame.frameKey)).size === frames.length,
				"Frame keys must be unique."
			),
		looping: z.boolean(),
		opacity: z.number().min(0).max(1),
		sceneAssetVersionId: id,
		overflowAllowed: z.boolean(),
		qualityWaiverEvidenceId: id.nullable(),
		backgrounds: z
			.array(z.enum(["light", "dark", "transparent", "scene"]))
			.length(4)
			.refine(
				(items) => new Set(items).size === 4,
				"Review all four backgrounds."
			),
		outcome: z.enum(["passed", "failed", "inconclusive"]),
		rationale: z.string().trim().min(1).max(2000),
	})
	.strict();
export const vfxAppearanceRecordSchema = vfxAppearanceInputSchema
	.extend({
		createdAt: z.string().datetime(),
		reviewedByUserId: id,
		measuredOverflowPx: z.number().int().nonnegative(),
		contractSnapshot: specializedProfileContractSchema,
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
		qualityWaiverSnapshot: readinessEvidenceSchema.nullable(),
	})
	.strict()
	.superRefine((record, ctx) => {
		if (
			record.contractSnapshot.profileId !==
			"visual_effect_projectile_shadow_mark"
		) {
			ctx.addIssue({
				code: "custom",
				message: "VFX reviews require the effect profile.",
			});
		}
		const pins = new Set(record.versionPins.map((pin) => pin.assetVersionId));
		if (
			record.frames.some((frame) => !pins.has(frame.assetVersionId)) ||
			!pins.has(record.sceneAssetVersionId)
		) {
			ctx.addIssue({
				code: "custom",
				message: "Every effect and scene version must be pinned.",
			});
		}
		if (
			Boolean(record.qualityWaiverEvidenceId) !==
			Boolean(record.qualityWaiverSnapshot)
		) {
			ctx.addIssue({
				code: "custom",
				message: "A waiver requires its exact evidence snapshot.",
			});
		}
	});
export type VfxAppearanceInput = z.infer<typeof vfxAppearanceInputSchema>;
export type VfxAppearanceRecord = z.infer<typeof vfxAppearanceRecordSchema>;
export type VfxAppearanceFrame = z.infer<typeof vfxAppearanceFrameSchema>;
export interface VfxAppearanceReviewStore {
	append: (
		userId: string,
		record: VfxAppearanceRecord
	) => Promise<VfxAppearanceRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<VfxAppearanceRecord[] | null>;
	listAccessibleVersionIds: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<Set<string> | null>;
}

/** Geometry is measured in native pixels; alpha corruption is never an overflow exception. */
export function measureVfxOverflow(
	input: Pick<VfxAppearanceInput, "frames" | "cell">
) {
	return Math.max(
		0,
		...input.frames.flatMap((frame) => [
			-frame.offset.x,
			-frame.offset.y,
			frame.offset.x + frame.region.width - input.cell.width,
			frame.offset.y + frame.region.height - input.cell.height,
		])
	);
}
