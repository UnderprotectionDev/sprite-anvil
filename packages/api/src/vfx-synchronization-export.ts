import { z } from "zod";
import {
	type VfxSynchronizationRecord,
	vfxFrameSchema,
} from "./vfx-synchronization";

const exportedFrame = z
	.object({
		id: z.string(),
		order: z.number().int().nonnegative(),
		duration_ms: z.number().int().positive(),
		asset_version_id: z.string(),
		unit_version_id: z.string(),
		region: vfxFrameSchema.shape.region,
		origin: vfxFrameSchema.shape.origin,
		alpha_data: z
			.object({
				asset_version_id: z.string(),
				content_digest: z.string(),
				encoding: z.literal("source_image_alpha"),
			})
			.strict(),
	})
	.strict();
export const vfxProfileManifestSchema = z
	.object({
		contract_revision_id: z.string(),
		review_id: z.uuid(),
		effect: z
			.object({
				frames: z.array(exportedFrame),
				origin: z.array(
					z
						.object({
							unit_version_id: z.string(),
							value: vfxFrameSchema.shape.origin,
						})
						.strict()
				),
				layer: z.number().int(),
				event_id: z.string(),
				event_time_ms: z.number().int().nonnegative(),
				overflow_allowed: z.boolean(),
				loop_mode: z.enum(["loop", "once"]),
			})
			.strict(),
		owner: z
			.object({
				frames: z.array(exportedFrame),
				event: z
					.object({
						id: z.string(),
						time_ms: z.number().int().nonnegative(),
						source: z.literal("authored"),
					})
					.strict(),
				loop_mode: z.enum(["loop", "once"]),
			})
			.strict(),
		scene_asset_version_id: z.string(),
		usage_test: z
			.object({
				id: z.literal("effect.owner_event_sync"),
				backgrounds: z.array(
					z
						.object({
							background: z.string(),
							alone: z.string(),
							synchronized: z.string(),
							notes: z.string(),
						})
						.strict()
				),
			})
			.strict(),
		waiver_evidence_ids: z.array(z.string()),
	})
	.strict();

/** Contract export paths are explicit; image alpha refers to the immutable original bytes. */
export function makeVfxProfileManifest(record: VfxSynchronizationRecord) {
	const frames = (clip: VfxSynchronizationRecord["effect"]) =>
		clip.frames.map((frame, order) => {
			const pin = record.versionPins.find(
				(p) => p.assetVersionId === frame.assetVersionId
			);
			if (!pin) {
				throw new Error("Export frame has no exact image pin.");
			}
			return {
				id: frame.frameKey,
				order,
				duration_ms: frame.durationMs,
				asset_version_id: frame.assetVersionId,
				unit_version_id: frame.unitVersionId,
				region: frame.region,
				origin: frame.origin,
				alpha_data: {
					asset_version_id: frame.assetVersionId,
					content_digest: pin.contentDigest,
					encoding: "source_image_alpha" as const,
				},
			};
		});
	return vfxProfileManifestSchema.parse({
		contract_revision_id: record.contractRevisionId,
		review_id: record.id,
		effect: {
			frames: frames(record.effect),
			origin: record.effect.frames.map((f) => ({
				unit_version_id: f.unitVersionId,
				value: f.origin,
			})),
			layer: record.layer,
			event_id: record.event.id,
			event_time_ms: record.event.timeMs,
			overflow_allowed: record.overflowAllowed,
			loop_mode: record.effect.looping ? "loop" : "once",
		},
		owner: {
			frames: frames(record.owner),
			event: {
				id: record.event.id,
				time_ms: record.event.timeMs,
				source: "authored",
			},
			loop_mode: record.owner.looping ? "loop" : "once",
		},
		scene_asset_version_id: record.sceneAssetVersionId,
		usage_test: {
			id: "effect.owner_event_sync",
			backgrounds: record.backgrounds,
		},
		waiver_evidence_ids: record.waiverEvidenceIds,
	});
}
