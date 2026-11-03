import type { PixelRect } from "@sprite-anvil/api/pixel-editor";

export interface Cell {
	x: number;
	y: number;
}

export function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/** Logical pixel under a pointer position; the canvas may be CSS-scaled. */
export function cellFromPoint(
	point: { x: number; y: number },
	bounds: { left: number; top: number; width: number; height: number },
	canvas: { width: number; height: number },
	zoom: number,
	size: { width: number; height: number }
): Cell {
	const scaleX = bounds.width === 0 ? 1 : canvas.width / bounds.width;
	const scaleY = bounds.height === 0 ? 1 : canvas.height / bounds.height;
	return {
		x: clamp(
			Math.floor(((point.x - bounds.left) * scaleX) / zoom),
			0,
			size.width - 1
		),
		y: clamp(
			Math.floor(((point.y - bounds.top) * scaleY) / zoom),
			0,
			size.height - 1
		),
	};
}

/** Inclusive rectangle spanned by two cells, in any drag direction. */
export function rectFromCells(a: Cell, b: Cell): PixelRect {
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	return {
		x,
		y,
		width: Math.abs(a.x - b.x) + 1,
		height: Math.abs(a.y - b.y) + 1,
	};
}

export function moveRect(rect: PixelRect, dx: number, dy: number): PixelRect {
	return { ...rect, x: rect.x + dx, y: rect.y + dy };
}

export function rectIsInside(
	rect: PixelRect,
	size: { width: number; height: number }
) {
	return (
		rect.x >= 0 &&
		rect.y >= 0 &&
		rect.x + rect.width <= size.width &&
		rect.y + rect.height <= size.height
	);
}

/** `#rrggbbaa` to a CSS colour; fully transparent stays transparent. */
export function hexToCss(hex: string) {
	const channel = (offset: number) =>
		Number.parseInt(hex.slice(offset, offset + 2), 16);
	return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${(channel(7) / 255).toFixed(3)})`;
}

export function rgbaToHex(r: number, g: number, b: number, a: number) {
	return `#${[r, g, b, a].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** `#rrggbb` from a colour input to an opaque Working Draft colour. */
export function opaqueHex(rgb: string) {
	return `${rgb.toLowerCase()}ff`;
}
