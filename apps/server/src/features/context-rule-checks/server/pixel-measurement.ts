import type { MeasuredColour } from "@sprite-anvil/api/context-rule-checks";

/** Part of every stored measurement; raise it whenever a definition changes. */
export const pixelMeasurementVersion = "pixel-measurement/1.0.0";

export interface Raster {
	data: Uint8Array;
	height: number;
	width: number;
}

export interface PixelMeasurement {
	colours: MeasuredColour[];
	outlineWidth: number | null;
}

const directions = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
] as const;

/** `#rrggbbaa` of the pixel at a byte offset. */
export function readRgba(data: Uint8Array, offset: number) {
	return `#${Array.from(data.subarray(offset, offset + 4), (channel) =>
		channel.toString(16).padStart(2, "0")
	).join("")}`;
}

/** One RGBA value per pixel, or null where the pixel is fully transparent. */
function readColours({ data, width, height }: Raster) {
	return Array.from({ length: width * height }, (_, index) =>
		data[index * 4 + 3] ? readRgba(data, index * 4) : null
	);
}

/** Larger count first, then the smaller RGBA value. */
function byUse(left: MeasuredColour, right: MeasuredColour) {
	return right.pixels - left.pixels || left.rgba.localeCompare(right.rgba);
}

export function measureRaster(raster: Raster): PixelMeasurement {
	const { width, height } = raster;
	const pixels = readColours(raster);
	const at = (x: number, y: number) =>
		x < 0 || y < 0 || x >= width || y >= height
			? null
			: (pixels[y * width + x] ?? null);
	const counts = new Map<string, { pixels: number; boundaryPixels: number }>();
	/** Sides of boundary pixels that touch transparency or the image edge. */
	const exposed: { x: number; y: number; dx: number; dy: number }[] = [];
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const colour = at(x, y);
			if (colour === null) {
				continue;
			}
			const count = counts.get(colour) ?? { pixels: 0, boundaryPixels: 0 };
			count.pixels += 1;
			const open = directions.filter(([dx, dy]) => at(x + dx, y + dy) === null);
			if (open.length > 0) {
				count.boundaryPixels += 1;
				exposed.push(...open.map(([dx, dy]) => ({ x, y, dx, dy })));
			}
			counts.set(colour, count);
		}
	}
	const colours = [...counts]
		.map(([rgba, count]) => ({ rgba, ...count }))
		.sort(byUse);

	const outline = [...counts].sort(
		([leftColour, left], [rightColour, right]) =>
			right.boundaryPixels - left.boundaryPixels ||
			leftColour.localeCompare(rightColour)
	)[0]?.[0];
	const runs = new Map<number, number>();
	for (const { x, y, dx, dy } of exposed) {
		if (at(x, y) !== outline) {
			continue;
		}
		let length = 1;
		while (at(x - dx * length, y - dy * length) === outline) {
			length += 1;
		}
		runs.set(length, (runs.get(length) ?? 0) + 1);
	}
	const outlineWidth =
		[...runs].sort(
			([leftLength, left], [rightLength, right]) =>
				right - left || rightLength - leftLength
		)[0]?.[0] ?? null;

	return { colours, outlineWidth };
}
