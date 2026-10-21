import { expect, test } from "bun:test";
import sharp from "sharp";
import { decodeVfxImage } from "../vfx-image-decode";

test("reads original alpha and distinguishes opaque RGB from truncated image data", async () => {
	const rgba = await sharp({
		create: {
			width: 16,
			height: 16,
			channels: 4,
			background: { r: 255, g: 0, b: 0, alpha: 0.5 },
		},
	})
		.png()
		.toBuffer();
	const rgb = await sharp(rgba).removeAlpha().png().toBuffer();
	expect(await decodeVfxImage(rgba)).toEqual({
		width: 16,
		height: 16,
		hasAlpha: true,
	});
	expect(await decodeVfxImage(rgb)).toEqual({
		width: 16,
		height: 16,
		hasAlpha: false,
	});
	expect(await decodeVfxImage(rgba.subarray(0, 40))).toBeNull();
});
