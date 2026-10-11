import { z } from "zod";
import { readinessEvidenceSchema } from "./family-readiness";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);
const point = z
	.object({
		x: z.number().int().min(-16_384).max(16_384),
		y: z.number().int().min(-16_384).max(16_384),
	})
	.strict();
export const vfxFrameSchema = z
	.object({
		assetVersionId: id,
		unitVersionId: id,
		frameKey: z.string().min(1).max(512),
		durationMs: z.number().int().min(1).max(60_000),
		origin: point,
		region: z
			.object({
				x: z.number().int().nonnegative(),
				y: z.number().int().nonnegative(),
				width: z.number().int().min(1).max(4096),
				height: z.number().int().min(1).max(4096),
			})
			.strict(),
	})
	.strict();
export const vfxClipSchema = z
	.object({
		looping: z.boolean(),
		frames: z.array(vfxFrameSchema).min(1).max(64),
	})
	.strict();
export const vfxBackgrounds = [
	"transparent",
	"light",
	"dark",
	"scene",
] as const;
const result = z.enum(["passed", "failed", "inconclusive"]);
export const vfxSynchronizationListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();
export const vfxSynchronizationInputSchema = vfxSynchronizationListInputSchema
	.extend({
		id: z.uuid(),
		name: z.string().trim().min(1).max(120),
		contractRevisionId: id,
		sourceReviewId: z.uuid().nullable().default(null),
		effect: vfxClipSchema,
		owner: vfxClipSchema,
		event: z
			.object({ id, timeMs: z.number().int().nonnegative().max(3_840_000) })
			.strict(),
		layer: z.number().int().min(-100).max(100),
		sceneAssetVersionId: id,
		overflowAllowed: z.boolean(),
		waiverEvidenceIds: z
			.array(id)
			.max(64)
			.refine((ids) => new Set(ids).size === ids.length),
		backgrounds: z
			.array(
				z
					.object({
						background: z.enum(vfxBackgrounds),
						alone: result,
						synchronized: result,
						notes: z.string().trim().min(1).max(1000),
					})
					.strict()
			)
			.length(4)
			.refine(
				(entries) => new Set(entries.map((e) => e.background)).size === 4
			),
		rationale: z.string().trim().min(1).max(2000),
	})
	.strict()
	.refine(
		(input) =>
			input.event.timeMs <
			input.owner.frames.reduce((sum, f) => sum + f.durationMs, 0),
		"The event must occur within the owner clip."
	);
export const vfxVersionPinSchema = z
	.object({
		assetVersionId: id,
		assetRecordId: id,
		assetFamilyId: id,
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		hasAlpha: z.boolean(),
		width: z.number().int().positive(),
		height: z.number().int().positive(),
	})
	.strict();
export const vfxSynchronizationRecordSchema = vfxSynchronizationInputSchema
	.extend({
		createdAt: z.iso.datetime(),
		reviewedByUserId: id,
		contractSnapshot: specializedProfileContractSchema,
		versionPins: z.array(vfxVersionPinSchema).min(2).max(129),
		waiverEvidence: z.array(readinessEvidenceSchema).max(64),
	})
	.strict();
export type VfxSynchronizationInput = z.infer<
	typeof vfxSynchronizationInputSchema
>;
export type VfxSynchronizationRecord = z.infer<
	typeof vfxSynchronizationRecordSchema
>;
export type VfxFrame = z.infer<typeof vfxFrameSchema>;
export type VfxClip = z.infer<typeof vfxClipSchema>;
export interface VfxSynchronizationStore {
	append: (
		userId: string,
		record: VfxSynchronizationRecord
	) => Promise<VfxSynchronizationRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<VfxSynchronizationRecord[] | null>;
}
/** The same clip-relative event survives selective frame replacement. */
export function getVfxFrameAt(
	clip: VfxClip,
	elapsedMs: number
): VfxFrame | null {
	const total = clip.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
	if (elapsedMs < 0 || (!clip.looping && elapsedMs >= total)) {
		return null;
	}
	let time = clip.looping ? elapsedMs % total : elapsedMs;
	for (const frame of clip.frames) {
		if (time < frame.durationMs) {
			return frame;
		}
		time -= frame.durationMs;
	}
	return null;
}

/** Time since the latest owner event, including effects that cross a loop boundary. */
export function getVfxEffectTime(
	owner: VfxClip,
	eventTimeMs: number,
	elapsedMs: number
): number {
	const duration = owner.frames.reduce(
		(sum, frame) => sum + frame.durationMs,
		0
	);
	const sinceFirstEvent = elapsedMs - eventTimeMs;
	return owner.looping && sinceFirstEvent >= 0
		? sinceFirstEvent % duration
		: sinceFirstEvent;
}
