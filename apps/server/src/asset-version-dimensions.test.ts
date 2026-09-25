import { expect, test } from "bun:test";
import sharp from "sharp";
import { getSourceImageDimensions } from "./features/asset-records/server/asset-version-store";

function createHeaderOnlyWebP(width: number, height: number) {
	const bytes = Buffer.alloc(30);
	bytes.write("RIFF", 0, "ascii");
	bytes.writeUInt32LE(22, 4);
	bytes.write("WEBP", 8, "ascii");
	bytes.write("VP8X", 12, "ascii");
	bytes.writeUInt32LE(10, 16);
	bytes.writeUIntLE(width - 1, 24, 3);
	bytes.writeUIntLE(height - 1, 27, 3);
	return bytes;
}

function createPng(width: number, height: number) {
	return sharp({
		create: {
			background: { alpha: 1, b: 200, g: 100, r: 40 },
			channels: 4,
			height,
			width,
		},
	})
		.png()
		.toBuffer();
}

test("reads Source Image Dimensions from decodable PNG and WebP files", async () => {
	const png = await createPng(1, 1);
	const webp = await sharp({
		create: {
			background: { alpha: 1, b: 200, g: 100, r: 40 },
			channels: 4,
			height: 32,
			width: 64,
		},
	})
		.webp()
		.toBuffer();

	expect(await getSourceImageDimensions(png, "image/png")).toEqual({
		height: 1,
		width: 1,
	});
	expect(await getSourceImageDimensions(webp, "image/webp")).toEqual({
		height: 32,
		width: 64,
	});
});

test("leaves malformed or unrecognized image dimensions unknown", async () => {
	expect(
		await getSourceImageDimensions(Buffer.from("not a PNG"), "image/png")
	).toBeNull();
	expect(
		await getSourceImageDimensions(Buffer.from("RIFFxxxxWEBP"), "image/webp")
	).toBeNull();
	expect(
		await getSourceImageDimensions(createHeaderOnlyWebP(64, 32), "image/webp")
	).toBeNull();
});

test("does not infer Source Image Dimensions from a truncated PNG", async () => {
	const headerOnlyPng = (await createPng(1, 1)).subarray(0, 33);

	expect(await getSourceImageDimensions(headerOnlyPng, "image/png")).toBeNull();
});
