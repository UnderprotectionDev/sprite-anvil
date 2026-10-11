import { expect, test } from "bun:test";
import type { VfxAppearanceFrame } from "@sprite-anvil/api/vfx-appearance-reviews";
import sharp from "sharp";
import { decodeVfxFrame } from "./features/vfx-profile/server/vfx-frame-decoder";

const frame: VfxAppearanceFrame = {
	assetVersionId: "effect",
	frameKey: "burst",
	durationMs: 100,
	region: { x: 0, y: 0, width: 16, height: 16 },
	offset: { x: -4, y: 0 },
};
const toBytes = (buffer: Buffer) => Uint8Array.from(buffer).buffer;
test("decodes transparent source data while rejecting broken images and out-of-source frames", async () => {
	const image = await sharp({
		create: {
			width: 16,
			height: 16,
			channels: 4,
			background: { r: 255, g: 40, b: 0, alpha: 0.5 },
		},
	})
		.png()
		.toBuffer();
	await expect(decodeVfxFrame(toBytes(image), frame)).resolves.toBeUndefined();
	await expect(
		decodeVfxFrame(toBytes(image), {
			...frame,
			region: { ...frame.region, x: 8 },
		})
	).rejects.toThrow();
	await expect(
		decodeVfxFrame(toBytes(image.subarray(0, 40)), frame)
	).rejects.toThrow();
	await expect(
		decodeVfxFrame(toBytes(Buffer.from("unreadable alpha")), frame)
	).rejects.toThrow();
});
