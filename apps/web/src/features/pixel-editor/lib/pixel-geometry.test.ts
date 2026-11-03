import { expect, test } from "vitest";
import {
	cellFromPoint,
	hexToCss,
	moveRect,
	opaqueHex,
	rectFromCells,
	rectIsInside,
} from "./pixel-geometry";

test("maps a pointer position on a zoomed, CSS-scaled canvas to a logical pixel", () => {
	const bounds = { left: 10, top: 20, width: 80, height: 80 };
	const canvas = { width: 160, height: 160 };
	const size = { width: 10, height: 10 };
	// 160 canvas px / 80 CSS px = 2x; zoom 16 => each logical pixel is 8 CSS px.
	expect(cellFromPoint({ x: 10, y: 20 }, bounds, canvas, 16, size)).toEqual({
		x: 0,
		y: 0,
	});
	expect(cellFromPoint({ x: 27, y: 37 }, bounds, canvas, 16, size)).toEqual({
		x: 2,
		y: 2,
	});
	expect(cellFromPoint({ x: 500, y: -50 }, bounds, canvas, 16, size)).toEqual({
		x: 9,
		y: 0,
	});
});

test("builds an inclusive selection rectangle from two cells in any direction", () => {
	expect(rectFromCells({ x: 4, y: 5 }, { x: 1, y: 2 })).toEqual({
		x: 1,
		y: 2,
		width: 4,
		height: 4,
	});
	expect(moveRect({ x: 1, y: 2, width: 4, height: 4 }, -1, 3)).toEqual({
		x: 0,
		y: 5,
		width: 4,
		height: 4,
	});
	expect(
		rectIsInside({ x: 0, y: 0, width: 4, height: 4 }, { width: 4, height: 3 })
	).toBe(false);
});

test("converts colours without changing channels", () => {
	expect(opaqueHex("#A0B1C2")).toBe("#a0b1c2ff");
	expect(hexToCss("#ff000080")).toBe("rgba(255, 0, 0, 0.502)");
});
