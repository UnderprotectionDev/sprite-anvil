import {
	type CanvasAnchor,
	type PixelOperation,
	type PixelRect,
	pixelEditorMaxDimension,
} from "@sprite-anvil/api/pixel-editor";

/**
 * Deterministic, grid-preserving operations over an RGBA raster. Every
 * operation copies or replaces whole logical pixels; no operation blends,
 * interpolates, or resamples, so no colour that was not already present (or
 * explicitly chosen) can appear. Fully transparent pixels are normalised to
 * 0,0,0,0 so all transparent pixels compare equal.
 */

export interface Raster {
	data: Uint8Array;
	height: number;
	width: number;
}

export class PixelOperationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PixelOperationError";
	}
}

type Rgba = readonly [number, number, number, number];

const transparent: Rgba = [0, 0, 0, 0];

export function parseColor(hex: string): Rgba {
	const value = (offset: number) =>
		Number.parseInt(hex.slice(offset, offset + 2), 16);
	const alpha = value(7);
	return alpha === 0 ? transparent : [value(1), value(3), value(5), alpha];
}

export function colorToHex(r: number, g: number, b: number, a: number) {
	const channels = a === 0 ? transparent : [r, g, b, a];
	return `#${channels.map((c) => (c ?? 0).toString(16).padStart(2, "0")).join("")}`;
}

export function createRaster(width: number, height: number): Raster {
	return { width, height, data: new Uint8Array(width * height * 4) };
}

function cloneRaster(raster: Raster): Raster {
	return { ...raster, data: raster.data.slice() };
}

function readPixel(raster: Raster, x: number, y: number): Rgba {
	const offset = (y * raster.width + x) * 4;
	const a = raster.data[offset + 3] ?? 0;
	if (a === 0) {
		return transparent;
	}
	return [
		raster.data[offset] ?? 0,
		raster.data[offset + 1] ?? 0,
		raster.data[offset + 2] ?? 0,
		a,
	];
}

function writePixel(raster: Raster, x: number, y: number, color: Rgba) {
	if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) {
		return;
	}
	const offset = (y * raster.width + x) * 4;
	const [red, green, blue, alpha] = color;
	raster.data[offset] = alpha === 0 ? 0 : red;
	raster.data[offset + 1] = alpha === 0 ? 0 : green;
	raster.data[offset + 2] = alpha === 0 ? 0 : blue;
	raster.data[offset + 3] = alpha;
}

function sameColor(a: Rgba, b: Rgba) {
	return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function assertInside(raster: Raster, rect: PixelRect, label: string) {
	if (
		rect.x < 0 ||
		rect.y < 0 ||
		rect.x + rect.width > raster.width ||
		rect.y + rect.height > raster.height
	) {
		throw new PixelOperationError(`${label} must stay inside the canvas`);
	}
}

function assertDimensions(width: number, height: number) {
	if (width > pixelEditorMaxDimension || height > pixelEditorMaxDimension) {
		throw new PixelOperationError(
			`Canvas cannot exceed ${pixelEditorMaxDimension} pixels on a side`
		);
	}
}

function stamp(
	raster: Raster,
	x: number,
	y: number,
	size: number,
	color: Rgba
) {
	for (let dy = 0; dy < size; dy += 1) {
		for (let dx = 0; dx < size; dx += 1) {
			writePixel(raster, x + dx, y + dy, color);
		}
	}
}

function lineCells(x0: number, y0: number, x1: number, y1: number) {
	const cells: [number, number][] = [];
	const dx = Math.abs(x1 - x0);
	const dy = -Math.abs(y1 - y0);
	const sx = x0 < x1 ? 1 : -1;
	const sy = y0 < y1 ? 1 : -1;
	let error = dx + dy;
	let x = x0;
	let y = y0;
	for (;;) {
		cells.push([x, y]);
		if (x === x1 && y === y1) {
			return cells;
		}
		const doubled = 2 * error;
		if (doubled >= dy) {
			error += dy;
			x += sx;
		}
		if (doubled <= dx) {
			error += dx;
			y += sy;
		}
	}
}

function drawStroke(
	raster: Raster,
	points: { x: number; y: number }[],
	size: number,
	color: Rgba
) {
	let [previous] = points;
	for (const point of points) {
		const from = previous ?? point;
		for (const [x, y] of lineCells(from.x, from.y, point.x, point.y)) {
			stamp(raster, x, y, size, color);
		}
		previous = point;
	}
}

function floodFill(
	raster: Raster,
	startX: number,
	startY: number,
	color: Rgba
) {
	if (
		startX < 0 ||
		startY < 0 ||
		startX >= raster.width ||
		startY >= raster.height
	) {
		throw new PixelOperationError("Fill start must be inside the canvas");
	}
	const target = readPixel(raster, startX, startY);
	if (sameColor(target, color.at(3) === 0 ? transparent : color)) {
		return;
	}
	const stack: [number, number][] = [[startX, startY]];
	while (stack.length > 0) {
		const cell = stack.pop();
		if (!cell) {
			break;
		}
		const [x, y] = cell;
		if (
			x < 0 ||
			y < 0 ||
			x >= raster.width ||
			y >= raster.height ||
			!sameColor(readPixel(raster, x, y), target)
		) {
			continue;
		}
		writePixel(raster, x, y, color);
		stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
	}
}

function copyRegion(raster: Raster, rect: PixelRect) {
	const region = createRaster(rect.width, rect.height);
	for (let y = 0; y < rect.height; y += 1) {
		for (let x = 0; x < rect.width; x += 1) {
			writePixel(region, x, y, readPixel(raster, rect.x + x, rect.y + y));
		}
	}
	return region;
}

function pasteRegion(
	raster: Raster,
	region: Raster,
	left: number,
	top: number
) {
	for (let y = 0; y < region.height; y += 1) {
		for (let x = 0; x < region.width; x += 1) {
			writePixel(raster, left + x, top + y, readPixel(region, x, y));
		}
	}
}

function fullRect(raster: Raster): PixelRect {
	return { x: 0, y: 0, width: raster.width, height: raster.height };
}

function flipRegion(region: Raster, axis: "horizontal" | "vertical") {
	const flipped = createRaster(region.width, region.height);
	for (let y = 0; y < region.height; y += 1) {
		for (let x = 0; x < region.width; x += 1) {
			const sourceX = axis === "horizontal" ? region.width - 1 - x : x;
			const sourceY = axis === "vertical" ? region.height - 1 - y : y;
			writePixel(flipped, x, y, readPixel(region, sourceX, sourceY));
		}
	}
	return flipped;
}

function rotateRegion(
	region: Raster,
	direction: "clockwise" | "counterclockwise"
) {
	const rotated = createRaster(region.height, region.width);
	for (let y = 0; y < region.height; y += 1) {
		for (let x = 0; x < region.width; x += 1) {
			const targetX = direction === "clockwise" ? region.height - 1 - y : y;
			const targetY = direction === "clockwise" ? x : region.width - 1 - x;
			writePixel(rotated, targetX, targetY, readPixel(region, x, y));
		}
	}
	return rotated;
}

function anchorOffset(
	anchor: CanvasAnchor,
	from: { width: number; height: number },
	to: { width: number; height: number }
) {
	const extraX = to.width - from.width;
	const extraY = to.height - from.height;
	let x = Math.floor(extraX / 2);
	if (anchor.endsWith("left")) {
		x = 0;
	} else if (anchor.endsWith("right")) {
		x = extraX;
	}
	let y = Math.floor(extraY / 2);
	if (anchor.startsWith("top")) {
		y = 0;
	} else if (anchor.startsWith("bottom")) {
		y = extraY;
	}
	return { x, y };
}

function scaleRaster(raster: Raster, factor: number) {
	assertDimensions(raster.width * factor, raster.height * factor);
	const scaled = createRaster(raster.width * factor, raster.height * factor);
	for (let y = 0; y < scaled.height; y += 1) {
		for (let x = 0; x < scaled.width; x += 1) {
			writePixel(
				scaled,
				x,
				y,
				readPixel(raster, Math.floor(x / factor), Math.floor(y / factor))
			);
		}
	}
	return scaled;
}

function replaceColor(raster: Raster, from: Rgba, to: Rgba) {
	if (sameColor(from, to)) {
		throw new PixelOperationError("Choose a different target colour");
	}
	for (let y = 0; y < raster.height; y += 1) {
		for (let x = 0; x < raster.width; x += 1) {
			if (sameColor(readPixel(raster, x, y), from)) {
				writePixel(raster, x, y, to);
			}
		}
	}
}

function transformSelection(
	raster: Raster,
	rect: PixelRect | null,
	transform: (region: Raster) => Raster
) {
	const target = rect ?? fullRect(raster);
	assertInside(raster, target, "Selection");
	const next = transform(copyRegion(raster, target));
	if (!rect && (next.width !== raster.width || next.height !== raster.height)) {
		assertDimensions(next.width, next.height);
		return next;
	}
	const result = cloneRaster(raster);
	pasteRegion(result, next, target.x, target.y);
	return result;
}

/** Raster plus the rectangle last copied or cut in the applied history. */
export interface EditState {
	clipboard: Raster | null;
	raster: Raster;
}

function clearRect(raster: Raster, rect: PixelRect) {
	for (let y = 0; y < rect.height; y += 1) {
		for (let x = 0; x < rect.width; x += 1) {
			writePixel(raster, rect.x + x, rect.y + y, transparent);
		}
	}
}

/** Applies one operation, carrying the clipboard that copy, cut and paste share. */
export function applyOperationToState(
	state: EditState,
	operation: PixelOperation
): EditState {
	const { raster, clipboard } = state;
	switch (operation.type) {
		case "copy":
			assertInside(raster, operation.rect, "Selection");
			return { raster, clipboard: copyRegion(raster, operation.rect) };
		case "cut": {
			assertInside(raster, operation.rect, "Selection");
			const next = cloneRaster(raster);
			clearRect(next, operation.rect);
			return { raster: next, clipboard: copyRegion(raster, operation.rect) };
		}
		case "paste": {
			if (!clipboard) {
				throw new PixelOperationError("Copy or cut a selection before pasting");
			}
			const next = cloneRaster(raster);
			pasteRegion(next, clipboard, operation.x, operation.y);
			return { raster: next, clipboard };
		}
		default:
			return { raster: applyOperation(raster, operation), clipboard };
	}
}

export function applyOperation(raster: Raster, operation: PixelOperation) {
	switch (operation.type) {
		case "pen": {
			const next = cloneRaster(raster);
			drawStroke(
				next,
				operation.points,
				operation.size,
				parseColor(operation.color)
			);
			return next;
		}
		case "eraser": {
			const next = cloneRaster(raster);
			drawStroke(next, operation.points, operation.size, transparent);
			return next;
		}
		case "line": {
			const next = cloneRaster(raster);
			drawStroke(
				next,
				[operation.from, operation.to],
				operation.size,
				parseColor(operation.color)
			);
			return next;
		}
		case "fill": {
			const next = cloneRaster(raster);
			floodFill(
				next,
				operation.at.x,
				operation.at.y,
				parseColor(operation.color)
			);
			return next;
		}
		case "move-selection": {
			assertInside(raster, operation.rect, "Selection");
			const region = copyRegion(raster, operation.rect);
			const next = cloneRaster(raster);
			clearRect(next, operation.rect);
			pasteRegion(
				next,
				region,
				operation.rect.x + operation.dx,
				operation.rect.y + operation.dy
			);
			return next;
		}
		case "flip":
			return transformSelection(raster, operation.rect, (region) =>
				flipRegion(region, operation.axis)
			);
		case "rotate-90": {
			if (operation.rect && operation.rect.width !== operation.rect.height) {
				throw new PixelOperationError("Rotation needs a square selection");
			}
			return transformSelection(raster, operation.rect, (region) =>
				rotateRegion(region, operation.direction)
			);
		}
		case "crop":
			assertInside(raster, operation.rect, "Crop");
			return copyRegion(raster, operation.rect);
		case "resize-canvas": {
			assertDimensions(operation.width, operation.height);
			const next = createRaster(operation.width, operation.height);
			const offset = anchorOffset(operation.anchor, raster, next);
			pasteRegion(next, raster, offset.x, offset.y);
			return next;
		}
		case "scale":
			return scaleRaster(raster, operation.factor);
		case "replace-color": {
			const next = cloneRaster(raster);
			replaceColor(next, parseColor(operation.from), parseColor(operation.to));
			return next;
		}
		default:
			throw new PixelOperationError("Unsupported pixel operation");
	}
}

export function replayOperations(
	source: Raster,
	operations: PixelOperation[]
): EditState {
	let state: EditState = { raster: source, clipboard: null };
	for (const operation of operations) {
		state = applyOperationToState(state, operation);
	}
	return state;
}

export function applyOperations(source: Raster, operations: PixelOperation[]) {
	return replayOperations(source, operations).raster;
}

/** Opaque and translucent colours present in the raster, excluding transparent pixels. */
export function countColors(raster: Raster) {
	const counts = new Map<string, number>();
	for (let y = 0; y < raster.height; y += 1) {
		for (let x = 0; x < raster.width; x += 1) {
			const [r, g, b, a] = readPixel(raster, x, y);
			if (a === 0) {
				continue;
			}
			const key = colorToHex(r, g, b, a);
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	return counts;
}

export function countColor(raster: Raster, hex: string) {
	const target = parseColor(hex);
	let count = 0;
	for (let y = 0; y < raster.height; y += 1) {
		for (let x = 0; x < raster.width; x += 1) {
			if (sameColor(readPixel(raster, x, y), target)) {
				count += 1;
			}
		}
	}
	return count;
}

export function diffRasters(source: Raster, draft: Raster) {
	if (source.width !== draft.width || source.height !== draft.height) {
		// A different grid has no pixel correspondence, so every pixel counts.
		return {
			changedPixelCount: draft.width * draft.height,
			boundingBox: fullRect(draft),
			sizeChanged: true,
		};
	}
	let count = 0;
	let minX = draft.width;
	let minY = draft.height;
	let maxX = -1;
	let maxY = -1;
	for (let y = 0; y < draft.height; y += 1) {
		for (let x = 0; x < draft.width; x += 1) {
			if (!sameColor(readPixel(source, x, y), readPixel(draft, x, y))) {
				count += 1;
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		}
	}
	return {
		changedPixelCount: count,
		boundingBox:
			count === 0
				? null
				: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
		sizeChanged: false,
	};
}
