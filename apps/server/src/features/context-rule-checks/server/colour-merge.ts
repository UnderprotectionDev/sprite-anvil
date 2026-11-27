import type {
	ColourMergeStep,
	MeasuredColour,
} from "@sprite-anvil/api/context-rule-checks";
import type { Raster } from "./pixel-measurement";
import { readRgba } from "./pixel-measurement";

export type ColourMergeProposal =
	| {
			changesBoundary: boolean;
			colourCount: number;
			ok: true;
			steps: ColourMergeStep[];
	  }
	| { ok: false; source: string };

function channels(rgba: string) {
	return [1, 3, 5, 7].map((start) =>
		Number.parseInt(rgba.slice(start, start + 2), 16)
	) as [number, number, number, number];
}

function linear(channel: number) {
	const value = channel / 255;
	return value <= 0.040_45 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Björn Ottosson's OKLab transform of the straight sRGB channels. */
function toOklab(rgba: string) {
	const [red, green, blue] = channels(rgba);
	const r = linear(red);
	const g = linear(green);
	const b = linear(blue);
	const l = Math.cbrt(
		0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b
	);
	const m = Math.cbrt(
		0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b
	);
	const s = Math.cbrt(
		0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b
	);
	return [
		0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
		1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
		0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
	] as const;
}

function distance(left: string, right: string) {
	const from = toOklab(left);
	const to = toOklab(right);
	return Math.hypot(from[0] - to[0], from[1] - to[1], from[2] - to[2]);
}

/**
 * Merges the least used colour into its nearest remaining colour until the limit
 * holds. `targets` holds the user's choice for a source colour.
 */
export function proposeColourMerge(
	colours: MeasuredColour[],
	limit: number,
	targets: Record<string, string> = {}
): ColourMergeProposal {
	let remaining = colours.map((colour) => ({ ...colour }));
	const steps: ColourMergeStep[] = [];
	let changesBoundary = false;
	while (remaining.length > Math.max(limit, 1)) {
		const [source] = [...remaining].sort(
			(left, right) =>
				left.pixels - right.pixels || left.rgba.localeCompare(right.rgba)
		);
		if (!source) {
			break;
		}
		remaining = remaining.filter((colour) => colour !== source);
		const chosen = targets[source.rgba];
		const target = chosen
			? remaining.find((colour) => colour.rgba === chosen)
			: [...remaining].sort(
					(left, right) =>
						distance(source.rgba, left.rgba) -
							distance(source.rgba, right.rgba) ||
						left.rgba.localeCompare(right.rgba)
				)[0];
		if (!target) {
			return { ok: false, source: source.rgba };
		}
		target.pixels += source.pixels;
		target.boundaryPixels += source.boundaryPixels;
		changesBoundary ||= source.boundaryPixels > 0;
		steps.push({
			source: source.rgba,
			target: target.rgba,
			pixels: source.pixels,
		});
	}
	return { ok: true, steps, changesBoundary, colourCount: remaining.length };
}

/** Replaces exact colours in step order and leaves the source raster untouched. */
export function applyColourMerge(
	raster: Raster,
	steps: ColourMergeStep[]
): Raster {
	const resolved = new Map<string, string>();
	for (const { source, target } of steps) {
		for (const [from, to] of resolved) {
			if (to === source) {
				resolved.set(from, target);
			}
		}
		resolved.set(source, target);
	}
	const data = raster.data.slice();
	for (let offset = 0; offset < data.length; offset += 4) {
		const rgba = readRgba(data, offset);
		const target = resolved.get(rgba);
		if (target) {
			data.set(channels(target), offset);
		}
	}
	return { width: raster.width, height: raster.height, data };
}
