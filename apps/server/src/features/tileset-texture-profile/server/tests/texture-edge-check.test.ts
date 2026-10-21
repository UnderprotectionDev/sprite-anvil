import { expect, test } from "bun:test";
import sharp from "sharp";
import { checkTextureImageEdges } from "../texture-edge-check";

test("compares exact cropped pixels including alpha on each declared repeat axis", async () => {
	const bytes = await sharp(
		Buffer.from([
			0, 0, 0, 255, 10, 20, 30, 255, 40, 50, 60, 255, 10, 20, 30, 255, 0, 0, 0,
			255, 10, 20, 30, 255, 40, 50, 60, 255, 10, 20, 30, 128,
		]),
		{ raw: { width: 4, height: 2, channels: 4 } }
	)
		.png()
		.toBuffer();
	expect(
		await checkTextureImageEdges(bytes, { x: 1, y: 0, width: 3, height: 2 }, [
			"x",
			"y",
		])
	).toEqual({
		x: { mismatchCount: 1, firstMismatch: 1 },
		y: { mismatchCount: 1, firstMismatch: 2 },
	});
	expect(
		await checkTextureImageEdges(bytes, { x: 1, y: 0, width: 1, height: 2 }, [
			"x",
		])
	).toEqual({ x: { mismatchCount: 0, firstMismatch: null }, y: null });
});
