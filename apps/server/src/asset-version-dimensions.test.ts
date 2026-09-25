import { expect, test } from "bun:test";
import { getSourceImageDimensions } from "./features/asset-records/server/asset-version-store";

const onePixelPng = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZpUAAAAASUVORK5CYII=",
	"base64"
);

function createExtendedWebP(width: number, height: number) {
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

test("reads Source Image Dimensions from PNG and extended WebP headers", () => {
	expect(getSourceImageDimensions(onePixelPng, "image/png")).toEqual({
		height: 1,
		width: 1,
	});
	expect(
		getSourceImageDimensions(createExtendedWebP(64, 32), "image/webp")
	).toEqual({ height: 32, width: 64 });
});

test("leaves malformed or unrecognized image dimensions unknown", () => {
	expect(
		getSourceImageDimensions(Buffer.from("not a PNG"), "image/png")
	).toBeNull();
	expect(
		getSourceImageDimensions(Buffer.from("RIFFxxxxWEBP"), "image/webp")
	).toBeNull();
});
