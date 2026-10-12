import type { VfxSynchronizationInput } from "@sprite-anvil/api/vfx-synchronization";

/** Fit every source region around the shared attachment point, without changing stored origins. */
export function getVfxPreviewLayout(
	config: Pick<VfxSynchronizationInput, "effect" | "owner">
) {
	let left = -128;
	let top = -96;
	let right = 128;
	let bottom = 96;
	for (const frame of [...config.effect.frames, ...config.owner.frames]) {
		const x = frame.region.x - frame.origin.x;
		const y = frame.region.y - frame.origin.y;
		left = Math.min(left, x - 8);
		top = Math.min(top, y - 8);
		right = Math.max(right, x + frame.region.width + 8);
		bottom = Math.max(bottom, y + frame.region.height + 8);
	}
	// Extreme authored origins can span tens of thousands of pixels. Keep the
	// render target bounded while retaining the whole composition in view.
	const scale = Math.min(1, 2048 / (right - left), 2048 / (bottom - top));
	return {
		width: Math.ceil((right - left) * scale),
		height: Math.ceil((bottom - top) * scale),
		originX: -left * scale,
		originY: -top * scale,
		scale,
	};
}
