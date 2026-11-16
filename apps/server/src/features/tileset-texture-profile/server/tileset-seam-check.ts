import type { TextureAtlasRegion } from "@sprite-anvil/api/texture-repetition-reviews";
import type { TilesetSeamResult } from "@sprite-anvil/api/tileset-adjacency-reviews";
import sharp from "sharp";

export async function checkTilesetImageSeam(
	first: Uint8Array,
	firstRegion: TextureAtlasRegion,
	second: Uint8Array,
	secondRegion: TextureAtlasRegion,
	direction: "north" | "east" | "south" | "west"
): Promise<TilesetSeamResult> {
	const horizontal = direction === "east" || direction === "west";
	const length = horizontal ? firstRegion.height : firstRegion.width;
	if (length !== (horizontal ? secondRegion.height : secondRegion.width)) {
		throw new Error("Edge lengths differ.");
	}
	async function edge(
		bytes: Uint8Array,
		region: TextureAtlasRegion,
		side: "north" | "east" | "south" | "west"
	) {
		const decoder = sharp(bytes, { failOn: "warning" });
		const metadata = await decoder.metadata();
		if (
			(metadata.pages ?? 1) !== 1 ||
			!metadata.width ||
			!metadata.height ||
			region.x + region.width > metadata.width ||
			region.y + region.height > metadata.height
		) {
			throw new Error("Invalid image or region.");
		}
		const vertical = side === "east" || side === "west";
		return decoder
			.extract({
				left: region.x + (side === "east" ? region.width - 1 : 0),
				top: region.y + (side === "south" ? region.height - 1 : 0),
				width: vertical ? 1 : region.width,
				height: vertical ? region.height : 1,
			})
			.toColourspace("srgb")
			.ensureAlpha()
			.raw()
			.toBuffer();
	}
	const opposite = {
		north: "south",
		south: "north",
		east: "west",
		west: "east",
	} as const;
	const [a, b] = await Promise.all([
		edge(first, firstRegion, direction),
		edge(second, secondRegion, opposite[direction]),
	]);
	const mismatchOffsets: number[] = [];
	for (let offset = 0; offset < length; offset += 1) {
		if (
			!a
				.subarray(offset * 4, offset * 4 + 4)
				.equals(b.subarray(offset * 4, offset * 4 + 4))
		) {
			mismatchOffsets.push(offset);
		}
	}
	return {
		length,
		mismatchCount: mismatchOffsets.length,
		firstMismatch: mismatchOffsets[0] ?? null,
		mismatchOffsets,
	};
}
