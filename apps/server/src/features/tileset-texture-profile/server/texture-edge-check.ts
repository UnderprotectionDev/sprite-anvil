import type {
	TextureAtlasRegion,
	TextureEdgeCheck,
} from "@sprite-anvil/api/texture-repetition-reviews";
import sharp from "sharp";

/** Decode one static image without resizing, then compare opposite RGBA samples. */
export async function checkTextureImageEdges(
	bytes: Uint8Array,
	region: TextureAtlasRegion,
	axes: ("x" | "y")[]
): Promise<TextureEdgeCheck> {
	const decoder = sharp(bytes, { failOn: "warning" });
	const metadata = await decoder.metadata();
	if ((metadata.pages ?? 1) !== 1) {
		throw new Error("Texture repetition requires a static source image.");
	}
	const { data, info } = await decoder
		.extract({
			left: region.x,
			top: region.y,
			width: region.width,
			height: region.height,
		})
		.toColourspace("srgb")
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const result: TextureEdgeCheck = { x: null, y: null };
	for (const axis of axes) {
		let mismatchCount = 0;
		let firstMismatch: number | null = null;
		const length = axis === "x" ? info.height : info.width;
		for (let offset = 0; offset < length; offset += 1) {
			const first = axis === "x" ? offset * info.width * 4 : offset * 4;
			const last =
				axis === "x"
					? first + (info.width - 1) * 4
					: first + (info.height - 1) * info.width * 4;
			if (
				!data.subarray(first, first + 4).equals(data.subarray(last, last + 4))
			) {
				mismatchCount += 1;
				firstMismatch ??= offset;
			}
		}
		result[axis] = { mismatchCount, firstMismatch };
	}
	return result;
}
