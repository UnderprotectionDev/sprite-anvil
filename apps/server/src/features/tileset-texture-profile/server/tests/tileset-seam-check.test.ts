import { expect, test } from "bun:test";
import sharp from "sharp";
import { checkTilesetImageSeam } from "../tileset-seam-check";

test("compares the declared source regions and direction in exact sRGB RGBA", async () => {
	const pixels = Buffer.from([
		255, 0, 0, 255, 0, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 0, 255,
		0, 255, 0, 255,
	]);
	const image = await sharp(pixels, {
		raw: { width: 3, height: 2, channels: 4 },
	})
		.png()
		.toBuffer();
	const left = { x: 0, y: 0, width: 1, height: 2 };
	const right = { x: 2, y: 0, width: 1, height: 2 };
	expect(
		await checkTilesetImageSeam(image, left, image, right, "east")
	).toEqual({
		length: 2,
		mismatchCount: 1,
		firstMismatch: 1,
		mismatchOffsets: [1],
	});
	expect(await checkTilesetImageSeam(image, left, image, left, "west")).toEqual(
		{ length: 2, mismatchCount: 0, firstMismatch: null, mismatchOffsets: [] }
	);
	await expect(
		checkTilesetImageSeam(image, left, image, { ...right, height: 3 }, "east")
	).rejects.toThrow();
	await expect(
		checkTilesetImageSeam(image, left, image, { ...right, x: 3 }, "east")
	).rejects.toThrow();
});
