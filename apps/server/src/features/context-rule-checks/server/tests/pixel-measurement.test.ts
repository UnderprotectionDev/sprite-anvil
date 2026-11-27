import { describe, expect, test } from "bun:test";
import { applyColourMerge, proposeColourMerge } from "../colour-merge";
import { measureRaster } from "../pixel-measurement";
import { evaluateContextRules } from "../rule-evaluation";

const CLEAR = "#00000000";
const INK = "#101010ff";
const RED = "#c03020ff";
const NEAR_RED = "#c23222ff";
const BLUE = "#2040c0ff";

const key: Record<string, string> = {
	".": CLEAR,
	k: INK,
	r: RED,
	s: NEAR_RED,
	b: BLUE,
};

function raster(rows: string[]) {
	const width = rows[0]?.length ?? 0;
	const data = new Uint8Array(width * rows.length * 4);
	rows
		.join("")
		.split("")
		.forEach((symbol, index) => {
			const hex = key[symbol] ?? CLEAR;
			for (let channel = 0; channel < 4; channel += 1) {
				data[index * 4 + channel] = Number.parseInt(
					hex.slice(1 + channel * 2, 3 + channel * 2),
					16
				);
			}
		});
	return { width, height: rows.length, data };
}

const thinOutline = raster([
	"........",
	".kkkkkk.",
	".krrrrk.",
	".krsbrk.",
	".krrbrk.",
	".kkkkkk.",
	"........",
]);

const boundaryStray = raster(["kkkk", "krrs", "kkkk"]);

const thickOutline = raster([
	"kkkkkkkkkk",
	"kkkkkkkkkk",
	"kkrrrrrrkk",
	"kkrrrrrrkk",
	"kkrrrrrrkk",
	"kkrrrrrrkk",
	"kkrrrrrrkk",
	"kkrrrrrrkk",
	"kkkkkkkkkk",
	"kkkkkkkkkk",
]);

describe("measureRaster", () => {
	test("counts distinct non-transparent RGBA colours with their pixels", () => {
		const measured = measureRaster(thinOutline);

		expect(measured.colours.map((colour) => colour.rgba)).toEqual([
			INK,
			RED,
			BLUE,
			NEAR_RED,
		]);
		expect(measured.colours[0]).toEqual({
			rgba: INK,
			pixels: 18,
			boundaryPixels: 18,
		});
		expect(measured.colours[1]?.boundaryPixels).toBe(0);
	});

	test("ignores fully transparent pixels but counts partial alpha", () => {
		const data = new Uint8Array([9, 9, 9, 0, 9, 9, 9, 128, 9, 9, 9, 255]);

		expect(measureRaster({ width: 3, height: 1, data }).colours).toHaveLength(
			2
		);
	});

	test("measures the most common inward run of the outline colour", () => {
		expect(measureRaster(thinOutline).outlineWidth).toBe(1);
		expect(measureRaster(thickOutline).outlineWidth).toBe(2);
	});

	test("reports no outline for a fully transparent image", () => {
		const measured = measureRaster(raster(["..", ".."]));

		expect(measured).toEqual({ colours: [], outlineWidth: null });
	});
});

describe("proposeColourMerge", () => {
	const measured = measureRaster(thinOutline);

	test("maps the least used colour to its nearest colour until the limit holds", () => {
		expect(proposeColourMerge(measured.colours, 3)).toEqual({
			ok: true,
			steps: [{ source: NEAR_RED, target: RED, pixels: 1 }],
			changesBoundary: false,
			colourCount: 3,
		});
	});

	test("repeats until the limit holds", () => {
		const proposal = proposeColourMerge(measured.colours, 1);

		expect(proposal.ok && proposal.steps.map((step) => step.source)).toEqual([
			NEAR_RED,
			BLUE,
			RED,
		]);
		expect(proposal.ok && proposal.colourCount).toBe(1);
	});

	test("reports a change to boundary pixels", () => {
		const proposal = proposeColourMerge(
			measureRaster(boundaryStray).colours,
			2
		);

		expect(proposal.ok && proposal.changesBoundary).toBe(true);
	});

	test("breaks an equal pixel count by the smaller RGBA value", () => {
		const proposal = proposeColourMerge(
			measureRaster(raster(["rrsb"])).colours,
			2
		);

		expect(proposal.ok && proposal.steps[0]?.source).toBe(BLUE);
	});

	test("accepts a user chosen target among the remaining colours", () => {
		const proposal = proposeColourMerge(measured.colours, 3, {
			[NEAR_RED]: BLUE,
		});

		expect(proposal.ok && proposal.steps[0]?.target).toBe(BLUE);
	});

	test("rejects a target that is not a remaining colour", () => {
		expect(
			proposeColourMerge(measured.colours, 3, { [NEAR_RED]: "#ffffffff" })
		).toEqual({ ok: false, source: NEAR_RED });
		expect(
			proposeColourMerge(measured.colours, 3, { [NEAR_RED]: NEAR_RED })
		).toEqual({ ok: false, source: NEAR_RED });
	});

	test("applies chained steps without touching the source or transparency", () => {
		const before = thinOutline.data.slice();
		const merged = applyColourMerge(thinOutline, [
			{ source: NEAR_RED, target: BLUE, pixels: 1 },
			{ source: BLUE, target: RED, pixels: 2 },
		]);

		expect(measureRaster(merged).colours.map((colour) => colour.rgba)).toEqual([
			INK,
			RED,
		]);
		expect(merged.data[3]).toBe(0);
		expect(thinOutline.data).toEqual(before);
	});
});

describe("evaluateContextRules", () => {
	const thin = measureRaster(thinOutline);

	test("passes when every selected rule holds, even on a blocked version", () => {
		const evaluation = evaluateContextRules(thin, {
			limits: { maxColours: 4, outlineWidth: 1 },
			qaBlocked: true,
		});

		expect(evaluation.group).toBe("passing");
		expect(evaluation.merge).toBeNull();
	});

	test("is safe to merge when only the colour count fails off the boundary", () => {
		const evaluation = evaluateContextRules(thin, {
			limits: { maxColours: 3, outlineWidth: 1 },
			qaBlocked: false,
		});

		expect(evaluation.group).toBe("safe_to_merge");
		expect(evaluation.results).toEqual([
			{ ruleId: "palette.max_colors", limit: 3, observed: 4, passes: false },
			{ ruleId: "outline.width", limit: 1, observed: 1, passes: true },
		]);
	});

	test("needs a look for an outline mismatch or a boundary merge", () => {
		expect(
			evaluateContextRules(thin, {
				limits: { outlineWidth: 2 },
				qaBlocked: false,
			}).group
		).toBe("needs_a_look");
		expect(
			evaluateContextRules(measureRaster(boundaryStray), {
				limits: { maxColours: 2 },
				qaBlocked: false,
			}).group
		).toBe("needs_a_look");
	});

	test("is blocked when a failing version is already QA blocked", () => {
		expect(
			evaluateContextRules(thin, {
				limits: { maxColours: 3 },
				qaBlocked: true,
			}).group
		).toBe("blocked");
	});

	test("evaluates only the rules that have a limit", () => {
		expect(
			evaluateContextRules(thin, { limits: {}, qaBlocked: false }).results
		).toEqual([]);
	});
});
