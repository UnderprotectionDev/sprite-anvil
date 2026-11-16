import { expect, test } from "vitest";
import { displayedPoint } from "./spatial-frame-geometry";

test("maps source pixels into the centered cropped frame", () => {
	expect(
		displayedPoint(
			{ x: 43, y: 29 },
			{ x: 40, y: 20, width: 12, height: 16 },
			{ width: 20, height: 24 }
		)
	).toEqual({ x: 7, y: 13 });
});
