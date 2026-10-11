import type { VfxAppearanceFrame } from "@sprite-anvil/api/vfx-appearance-reviews";
import sharp from "sharp";

export async function decodeVfxFrame(
	bytes: ArrayBuffer,
	frame: VfxAppearanceFrame
) {
	await sharp(Buffer.from(bytes), { failOn: "warning" })
		.extract({
			left: frame.region.x,
			top: frame.region.y,
			width: frame.region.width,
			height: frame.region.height,
		})
		.ensureAlpha()
		.raw()
		.toBuffer();
}
