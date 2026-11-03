import { describe, expect, it } from "vitest";
import { frameSettingsFormSchema, slicingFormSchema } from "./schemas";

const slicing = {
	cellWidth: "16",
	cellHeight: "16",
	columns: "4",
	rows: "2",
	offsetX: "0",
	offsetY: "0",
	gapX: "1",
	gapY: "1",
	readingOrder: "rows-left-to-right",
};

describe("slicing form", () => {
	it("turns typed whole numbers into slicing parameters", () => {
		expect(slicingFormSchema.parse(slicing)).toMatchObject({
			cellWidth: 16,
			columns: 4,
			gapX: 1,
		});
	});

	it("rejects empty, fractional and zero-size cells", () => {
		expect(
			slicingFormSchema.safeParse({ ...slicing, cellWidth: "0" }).success
		).toBe(false);
		expect(
			slicingFormSchema.safeParse({ ...slicing, rows: "1.5" }).success
		).toBe(false);
		expect(slicingFormSchema.safeParse({ ...slicing, gapX: "" }).success).toBe(
			false
		);
		expect(
			slicingFormSchema.safeParse({ ...slicing, readingOrder: "spiral" })
				.success
		).toBe(false);
	});
});

describe("frame settings form", () => {
	it("allows negative offsets but not negative pivots or zero duration", () => {
		const base = {
			durationMs: "100",
			offsetX: "-2",
			offsetY: "3",
			pivotX: "8",
			pivotY: "16",
		};
		expect(frameSettingsFormSchema.parse(base).offsetX).toBe(-2);
		expect(
			frameSettingsFormSchema.safeParse({ ...base, pivotX: "-1" }).success
		).toBe(false);
		expect(
			frameSettingsFormSchema.safeParse({ ...base, durationMs: "0" }).success
		).toBe(false);
	});
});
