import { createHash } from "node:crypto";
import type { PixelOperation } from "@sprite-anvil/api/pixel-editor";
import {
	type FrameOperation,
	pixelEditorMaxFrameEdits,
	pixelEditorMaxFrames,
	type SheetCell,
	type SheetFrameRecord,
	type SheetSlicing,
	type SheetStructure,
	sheetStructureSchema,
} from "@sprite-anvil/api/pixel-editor-structure";
import {
	anchorOffset,
	createRaster,
	PixelOperationError,
	type Raster,
	replayOperations,
} from "./pixel-operations";

/**
 * Deterministic frame and sprite sheet structure rules. Everything here is a
 * pure function of the sheet raster, the slicing and the frame records, so the
 * server can re-derive any frame image and fingerprint from the persisted
 * Working Draft. Nothing resamples: cells are cropped and shifted pixel for pixel.
 */

export type StructureFailureKind = "slicing" | "operation" | "protected";

export class SheetStructureError extends Error {
	readonly kind: StructureFailureKind;

	constructor(
		kind: StructureFailureKind,
		message: string,
		options?: ErrorOptions
	) {
		super(message, options);
		this.name = "SheetStructureError";
		this.kind = kind;
	}
}

const defaultFrameDurationMs = 100;

export interface RenderContext {
	/** The Working Draft raster the cells are cut from. */
	sheet: Raster;
	/** Pre-fetched rasters for frames that come from another Asset Version. */
	sources: Map<string, Raster>;
}

function gridOrder(slicing: SheetSlicing) {
	const rowsFirst = slicing.readingOrder.startsWith("rows");
	const reverseMinor =
		slicing.readingOrder === "rows-right-to-left" ||
		slicing.readingOrder === "columns-bottom-to-top";
	const major = rowsFirst ? slicing.rows : slicing.columns;
	const minor = rowsFirst ? slicing.columns : slicing.rows;
	const positions: { column: number; row: number }[] = [];
	for (let outer = 0; outer < major; outer += 1) {
		for (let inner = 0; inner < minor; inner += 1) {
			const second = reverseMinor ? minor - 1 - inner : inner;
			positions.push(
				rowsFirst
					? { column: second, row: outer }
					: { column: outer, row: second }
			);
		}
	}
	return positions;
}

/** Numbered cell rectangles in reading order; rejects a grid that leaves the sheet. */
export function computeCells(
	slicing: SheetSlicing,
	sheet: { height: number; width: number }
): SheetCell[] {
	const cellCount = slicing.columns * slicing.rows;
	if (cellCount > pixelEditorMaxFrames) {
		throw new SheetStructureError(
			"slicing",
			`A sheet can have at most ${pixelEditorMaxFrames} cells`
		);
	}
	const usedWidth =
		slicing.offsetX +
		slicing.columns * slicing.cellWidth +
		(slicing.columns - 1) * slicing.gapX;
	const usedHeight =
		slicing.offsetY +
		slicing.rows * slicing.cellHeight +
		(slicing.rows - 1) * slicing.gapY;
	if (usedWidth > sheet.width || usedHeight > sheet.height) {
		throw new SheetStructureError(
			"slicing",
			`The grid needs ${usedWidth}x${usedHeight} pixels but the sheet is ${sheet.width}x${sheet.height}`
		);
	}
	return gridOrder(slicing).map(({ column, row }, index) => ({
		index,
		x: slicing.offsetX + column * (slicing.cellWidth + slicing.gapX),
		y: slicing.offsetY + row * (slicing.cellHeight + slicing.gapY),
		width: slicing.cellWidth,
		height: slicing.cellHeight,
	}));
}

function newFrame(
	key: string,
	origin: SheetFrameRecord["origin"],
	slicing: SheetSlicing
): SheetFrameRecord {
	return {
		key: key as SheetFrameRecord["key"],
		origin,
		durationMs: defaultFrameDurationMs,
		offsetX: 0,
		offsetY: 0,
		pivotX: Math.floor(slicing.cellWidth / 2),
		pivotY: slicing.cellHeight,
		keep: false,
		issue: false,
		edits: [],
		committed: null,
	};
}

/** Validates a structure before it is persisted; a violation is a rule failure, not a crash. */
export function parseStructure(structure: SheetStructure): SheetStructure {
	const parsed = sheetStructureSchema.safeParse(structure);
	if (!parsed.success) {
		throw new SheetStructureError(
			"operation",
			`The frame structure would be invalid: ${parsed.error.issues[0]?.message ?? "unknown rule"}`
		);
	}
	return parsed.data;
}

/** First slicing: one frame per cell, in reading order. */
export function createStructure(
	slicing: SheetSlicing,
	sheet: { height: number; width: number }
): SheetStructure {
	const cells = computeCells(slicing, sheet);
	return {
		slicing,
		frames: cells.map((cell) =>
			newFrame(
				`frame-${cell.index + 1}`,
				{ kind: "cell", cellIndex: cell.index },
				slicing
			)
		),
		nextFrameNumber: cells.length + 1,
		lastCommit: null,
	};
}

/** Re-slicing keeps every frame record; cell frames follow their cell index. */
export function resliceStructure(
	structure: SheetStructure,
	slicing: SheetSlicing,
	sheet: { height: number; width: number }
): SheetStructure {
	const cells = computeCells(slicing, sheet);
	for (const frame of structure.frames) {
		if (
			frame.origin.kind === "cell" &&
			frame.origin.cellIndex >= cells.length
		) {
			throw new SheetStructureError(
				"slicing",
				`${frame.key} uses cell ${frame.origin.cellIndex + 1} but the new grid has ${cells.length} cells; delete the frame first`
			);
		}
		if (frame.pivotX > slicing.cellWidth || frame.pivotY > slicing.cellHeight) {
			throw new SheetStructureError(
				"slicing",
				`${frame.key} pivot would fall outside the new cell size`
			);
		}
	}
	return { ...structure, slicing };
}

function crop(
	raster: Raster,
	cell: { height: number; width: number; x: number; y: number }
) {
	const out = createRaster(cell.width, cell.height);
	for (let y = 0; y < cell.height; y += 1) {
		for (let x = 0; x < cell.width; x += 1) {
			const from = ((cell.y + y) * raster.width + cell.x + x) * 4;
			const to = (y * cell.width + x) * 4;
			if ((raster.data[from + 3] ?? 0) === 0) {
				continue;
			}
			out.data.set(raster.data.subarray(from, from + 4), to);
		}
	}
	return out;
}

function shift(raster: Raster, dx: number, dy: number) {
	if (dx === 0 && dy === 0) {
		return raster;
	}
	const out = createRaster(raster.width, raster.height);
	for (let y = 0; y < raster.height; y += 1) {
		const sourceY = y - dy;
		if (sourceY < 0 || sourceY >= raster.height) {
			continue;
		}
		for (let x = 0; x < raster.width; x += 1) {
			const sourceX = x - dx;
			if (sourceX < 0 || sourceX >= raster.width) {
				continue;
			}
			const from = (sourceY * raster.width + sourceX) * 4;
			out.data.set(
				raster.data.subarray(from, from + 4),
				(y * raster.width + x) * 4
			);
		}
	}
	return out;
}

function frameEditError(frame: SheetFrameRecord, cause: PixelOperationError) {
	return new SheetStructureError(
		"operation",
		`${frame.key} edit failed: ${cause.message}`,
		{ cause }
	);
}

/** Replays a frame's own pixel edits on its base image; the size must not change. */
function applyFrameEdits(frame: SheetFrameRecord, base: Raster) {
	if (frame.edits.length === 0) {
		return base;
	}
	try {
		const edited = replayOperations(base, frame.edits).raster;
		if (edited.width !== base.width || edited.height !== base.height) {
			throw new SheetStructureError(
				"operation",
				`${frame.key} edits may not change the frame size`
			);
		}
		return edited;
	} catch (error) {
		if (error instanceof PixelOperationError) {
			throw frameEditError(frame, error);
		}
		throw error;
	}
}

/**
 * Frame image: its origin cut at the cell size, then the frame's own pixel
 * edits (blank and Asset Version frames), then shifted by the frame offset.
 */
export function renderFrame(
	frame: SheetFrameRecord,
	cells: SheetCell[],
	slicing: SheetSlicing,
	context: RenderContext
): Raster {
	let base: Raster;
	if (frame.origin.kind === "cell") {
		const cell = cells[frame.origin.cellIndex];
		if (!cell) {
			throw new SheetStructureError(
				"operation",
				`${frame.key} points at a cell that does not exist`
			);
		}
		base = crop(context.sheet, cell);
	} else if (frame.origin.kind === "blank") {
		base = createRaster(slicing.cellWidth, slicing.cellHeight);
	} else {
		const raster = context.sources.get(frame.origin.assetVersionId);
		if (!raster) {
			throw new SheetStructureError(
				"operation",
				`${frame.key} image is unavailable`
			);
		}
		if (
			raster.width !== slicing.cellWidth ||
			raster.height !== slicing.cellHeight
		) {
			throw new SheetStructureError(
				"operation",
				`${frame.key} image is ${raster.width}x${raster.height} but cells are ${slicing.cellWidth}x${slicing.cellHeight}`
			);
		}
		base = raster;
	}
	return shift(applyFrameEdits(frame, base), frame.offsetX, frame.offsetY);
}

/** Digest of what a Unit Version for this frame would contain: pixels, duration, pivot, offset and issue mark. */
export function frameFingerprint(frame: SheetFrameRecord, raster: Raster) {
	const hash = createHash("sha256");
	const normalised = new Uint8Array(raster.data.length);
	for (let offset = 0; offset < raster.data.length; offset += 4) {
		if ((raster.data[offset + 3] ?? 0) !== 0) {
			normalised.set(raster.data.subarray(offset, offset + 4), offset);
		}
	}
	hash.update(normalised);
	hash.update(
		`|${raster.width}x${raster.height}|${frame.durationMs}|${frame.pivotX},${frame.pivotY}|${frame.offsetX},${frame.offsetY}|${frame.issue ? "issue" : "ok"}`
	);
	return hash.digest("hex");
}

export function renderFrames(
	structure: SheetStructure,
	cells: SheetCell[],
	context: RenderContext
) {
	const rendered = new Map<
		string,
		{ fingerprint: string; frame: SheetFrameRecord; raster: Raster }
	>();
	for (const frame of structure.frames) {
		const raster = renderFrame(frame, cells, structure.slicing, context);
		rendered.set(frame.key, {
			frame,
			raster,
			fingerprint: frameFingerprint(frame, raster),
		});
	}
	return rendered;
}

function sameRecordExceptKeep(a: SheetFrameRecord, b: SheetFrameRecord) {
	return (
		JSON.stringify({ ...a, keep: false }) ===
		JSON.stringify({ ...b, keep: false })
	);
}

/**
 * A kept frame holds its playback position: the frames that exist both before
 * and after must be the same set in front of it, so no move can cross it.
 * Adding or deleting other frames is not a move.
 */
function sameLeadingFrames(
	before: SheetStructure,
	after: SheetStructure,
	index: number
) {
	const key = before.frames[index]?.key;
	const beforeKeys = new Set(before.frames.map((frame) => frame.key));
	const afterKeys = new Set(after.frames.map((frame) => frame.key));
	const leadingBefore = before.frames
		.slice(0, index)
		.map((frame) => frame.key)
		.filter((entry) => afterKeys.has(entry));
	const afterIndex = after.frames.findIndex((frame) => frame.key === key);
	const leadingAfter = after.frames
		.slice(0, afterIndex)
		.map((frame) => frame.key)
		.filter((entry) => beforeKeys.has(entry));
	return (
		leadingBefore.length === leadingAfter.length &&
		leadingBefore.every((entry) => leadingAfter.includes(entry))
	);
}

/**
 * A protected ("keep") frame must still exist with an identical record and
 * identical pixels. Turning keep off is the only way to unlock it, and that
 * request may change nothing else about the frame or its cells, so an unlock
 * cannot smuggle in a pixel, duration, pivot or offset change.
 */
export function assertProtectedFramesUnchanged(
	before: SheetStructure,
	after: SheetStructure,
	cells: { after: SheetCell[]; before: SheetCell[] },
	contexts: { after: RenderContext; before: RenderContext }
) {
	const afterByKey = new Map(after.frames.map((frame) => [frame.key, frame]));
	for (const [index, frame] of before.frames.entries()) {
		if (!frame.keep) {
			continue;
		}
		const next = afterByKey.get(frame.key);
		if (!next) {
			throw new SheetStructureError(
				"protected",
				`${frame.key} is protected; turn off keep before deleting it`
			);
		}
		if (!sameLeadingFrames(before, after, index)) {
			throw new SheetStructureError(
				"protected",
				`${frame.key} is protected; turn off keep before moving frames across it`
			);
		}
		const was = frameFingerprint(
			frame,
			renderFrame(frame, cells.before, before.slicing, contexts.before)
		);
		const now = frameFingerprint(
			next,
			renderFrame(next, cells.after, after.slicing, contexts.after)
		);
		if (was !== now || !sameRecordExceptKeep(frame, next)) {
			throw new SheetStructureError(
				"protected",
				next.keep
					? `${frame.key} is protected; turn off keep before changing it`
					: `${frame.key} can only be unlocked on its own; change it in a separate request`
			);
		}
	}
}

function findFrame(structure: SheetStructure, key: string) {
	const index = structure.frames.findIndex((entry) => entry.key === key);
	const found = structure.frames[index];
	if (!found) {
		throw new SheetStructureError("operation", `Unknown frame ${key}`);
	}
	return { frame: found, index };
}

function updateFrame(
	structure: SheetStructure,
	key: string,
	patch: Partial<SheetFrameRecord>
): SheetStructure {
	const { index } = findFrame(structure, key);
	return {
		...structure,
		frames: structure.frames.map((frame, at) =>
			at === index ? { ...frame, ...patch } : frame
		),
	};
}

function insertFrame(
	structure: SheetStructure,
	frame: SheetFrameRecord,
	at: number | undefined
): SheetStructure {
	if (structure.frames.length >= pixelEditorMaxFrames) {
		throw new SheetStructureError(
			"operation",
			`A sheet can have at most ${pixelEditorMaxFrames} frames`
		);
	}
	const position = Math.min(
		at ?? structure.frames.length,
		structure.frames.length
	);
	const frames = [...structure.frames];
	frames.splice(position, 0, frame);
	return {
		...structure,
		frames,
		nextFrameNumber: structure.nextFrameNumber + 1,
	};
}

function requireCellSize(
	raster: Raster | undefined,
	slicing: SheetSlicing,
	label: string
) {
	if (!raster) {
		throw new SheetStructureError("operation", `${label} image is unavailable`);
	}
	if (
		raster.width !== slicing.cellWidth ||
		raster.height !== slicing.cellHeight
	) {
		throw new SheetStructureError(
			"operation",
			`${label} image is ${raster.width}x${raster.height} but cells are ${slicing.cellWidth}x${slicing.cellHeight}`
		);
	}
}

function assertPivotInCell(slicing: SheetSlicing, x: number, y: number) {
	if (x > slicing.cellWidth || y > slicing.cellHeight) {
		throw new SheetStructureError(
			"operation",
			`Pivot must stay inside the ${slicing.cellWidth}x${slicing.cellHeight} cell`
		);
	}
}

/** Applies one frame edit to the structure (no protection check; see assertProtectedFramesUnchanged). */
export function applyFrameOperation(
	structure: SheetStructure,
	operation: FrameOperation,
	sources: Map<string, Raster>
): SheetStructure {
	const { slicing } = structure;
	const nextKey = `frame-${structure.nextFrameNumber}`;
	switch (operation.type) {
		case "add-blank":
			return insertFrame(
				structure,
				newFrame(nextKey, { kind: "blank" }, slicing),
				operation.at
			);
		case "add-from-asset-version":
			requireCellSize(sources.get(operation.assetVersionId), slicing, nextKey);
			return insertFrame(
				structure,
				newFrame(
					nextKey,
					{ kind: "asset-version", assetVersionId: operation.assetVersionId },
					slicing
				),
				operation.at
			);
		case "duplicate": {
			const { frame, index } = findFrame(structure, operation.frameKey);
			return insertFrame(
				structure,
				{
					...frame,
					key: nextKey as SheetFrameRecord["key"],
					keep: false,
					committed: null,
				},
				operation.at ?? index + 1
			);
		}
		case "delete": {
			findFrame(structure, operation.frameKey);
			if (structure.frames.length === 1) {
				throw new SheetStructureError(
					"operation",
					"A sheet needs at least one frame"
				);
			}
			return {
				...structure,
				frames: structure.frames.filter(
					(frame) => frame.key !== operation.frameKey
				),
			};
		}
		case "replace":
			findFrame(structure, operation.frameKey);
			requireCellSize(
				sources.get(operation.assetVersionId),
				slicing,
				operation.frameKey
			);
			return updateFrame(structure, operation.frameKey, {
				origin: {
					kind: "asset-version",
					assetVersionId: operation.assetVersionId,
				},
				offsetX: 0,
				offsetY: 0,
				edits: [],
			});
		case "reorder": {
			const { frame, index } = findFrame(structure, operation.frameKey);
			if (frame.keep) {
				throw new SheetStructureError(
					"protected",
					`${frame.key} is protected; turn off keep before moving it`
				);
			}
			const frames = structure.frames.filter((_, at) => at !== index);
			frames.splice(Math.min(operation.toIndex, frames.length), 0, frame);
			return { ...structure, frames };
		}
		case "set-duration":
			return updateFrame(structure, operation.frameKey, {
				durationMs: operation.durationMs,
			});
		case "set-offset":
			return updateFrame(structure, operation.frameKey, {
				offsetX: operation.x,
				offsetY: operation.y,
			});
		case "set-pivot":
			assertPivotInCell(slicing, operation.x, operation.y);
			return updateFrame(structure, operation.frameKey, {
				pivotX: operation.x,
				pivotY: operation.y,
			});
		case "set-issue":
			return updateFrame(structure, operation.frameKey, {
				issue: operation.issue,
			});
		case "edit-pixels":
			return editFramePixels(
				structure,
				operation.frameKey,
				operation.operation,
				sources
			);
		case "undo-pixel-edit": {
			const { frame } = findFrame(structure, operation.frameKey);
			if (frame.edits.length === 0) {
				throw new SheetStructureError(
					"operation",
					`${frame.key} has no pixel edit to undo`
				);
			}
			return updateFrame(structure, operation.frameKey, {
				edits: frame.edits.slice(0, -1),
			});
		}
		default:
			return updateFrame(structure, operation.frameKey, {
				keep: operation.keep,
			});
	}
}

/** Appends one pixel edit to a blank or Asset Version frame after proving it replays at the cell size. */
function editFramePixels(
	structure: SheetStructure,
	frameKey: string,
	edit: PixelOperation,
	sources: Map<string, Raster>
) {
	const { frame } = findFrame(structure, frameKey);
	const { slicing } = structure;
	if (frame.origin.kind === "cell") {
		throw new SheetStructureError(
			"operation",
			`${frame.key} is cut from the sheet; edit the sheet pixels instead`
		);
	}
	if (frame.edits.length >= pixelEditorMaxFrameEdits) {
		throw new SheetStructureError(
			"operation",
			`${frame.key} reached the limit of ${pixelEditorMaxFrameEdits} pixel edits`
		);
	}
	const next = updateFrame(structure, frameKey, {
		edits: [...frame.edits, edit],
	});
	const base =
		frame.origin.kind === "blank"
			? createRaster(slicing.cellWidth, slicing.cellHeight)
			: sources.get(frame.origin.assetVersionId);
	if (!base) {
		throw new SheetStructureError(
			"operation",
			`${frame.key} image is unavailable`
		);
	}
	applyFrameEdits(findFrame(next, frameKey).frame, base);
	return next;
}

export function frameStatus(
	frame: SheetFrameRecord,
	fingerprint: string
): "new" | "changed" | "pinned" {
	if (!frame.committed) {
		return "new";
	}
	return frame.committed.fingerprint === fingerprint ? "pinned" : "changed";
}

/** Whether the playback order differs from the last pinned Composite Version. */
export function orderChanged(structure: SheetStructure) {
	const last = structure.lastCommit;
	if (!last) {
		return false;
	}
	return (
		last.frameKeys.length !== structure.frames.length ||
		last.frameKeys.some((key, index) => structure.frames[index]?.key !== key)
	);
}

/**
 * Pixel guard for whole-sheet edits: kept cells may not change and the grid may
 * not move. Only frames cut from a cell read sheet pixels; blank and
 * asset-version frames render from their own image (see renderFrame), so no
 * sheet pixel edit can alter a kept frame of those kinds.
 */
export function assertSheetEditKeepsProtectedFrames(
	structure: SheetStructure,
	before: Raster,
	after: Raster
) {
	if (before.width !== after.width || before.height !== after.height) {
		throw new SheetStructureError(
			"operation",
			"The sheet size is fixed while a frame structure exists"
		);
	}
	const cells = computeCells(structure.slicing, before);
	for (const frame of structure.frames) {
		if (!frame.keep || frame.origin.kind !== "cell") {
			continue;
		}
		const cell = cells[frame.origin.cellIndex];
		if (!cell) {
			throw new SheetStructureError(
				"operation",
				`${frame.key} points at a cell that does not exist`
			);
		}
		const was = crop(before, cell).data;
		const now = crop(after, cell).data;
		if (was.length !== now.length || was.some((value, i) => value !== now[i])) {
			throw new SheetStructureError(
				"protected",
				`${frame.key} is protected; turn off keep before editing its pixels`
			);
		}
	}
}

/** How a whole-sheet edit moves the grid: a translation (crop, canvas resize) or an integer scale. */
export type GeometryChange =
	| { dx: number; dy: number; kind: "translate" }
	| { factor: number; kind: "scale" };

/** The grid movement of a sheet edit; null when the edit leaves the sheet geometry alone. */
export function geometryChangeOf(
	operation: PixelOperation,
	before: Raster
): GeometryChange | null {
	switch (operation.type) {
		case "crop":
			return {
				kind: "translate",
				dx: -operation.rect.x,
				dy: -operation.rect.y,
			};
		case "resize-canvas": {
			const offset = anchorOffset(operation.anchor, before, operation);
			return { kind: "translate", dx: offset.x, dy: offset.y };
		}
		case "scale":
			return { kind: "scale", factor: operation.factor };
		default:
			return null;
	}
}

function divide(value: number, factor: number, label: string) {
	if (value % factor !== 0) {
		throw new SheetStructureError(
			"operation",
			`${label} ${value} is not a multiple of ${factor}; re-slice before undoing the scale`
		);
	}
	return value / factor;
}

/**
 * Maps the grid and the frame geometry through a sheet edit, so the frames keep
 * cutting the same pixels. `inverse` maps back (undo). Pure integer arithmetic;
 * the caller proves the result with computeCells and the protection check.
 */
export function remapStructure(
	structure: SheetStructure,
	change: GeometryChange,
	direction: "forward" | "inverse"
): SheetStructure {
	const { slicing } = structure;
	if (change.kind === "translate") {
		const sign = direction === "forward" ? 1 : -1;
		const offsetX = slicing.offsetX + sign * change.dx;
		const offsetY = slicing.offsetY + sign * change.dy;
		if (offsetX < 0 || offsetY < 0) {
			throw new SheetStructureError(
				"slicing",
				"The edit would cut into the frame grid; keep every cell inside the sheet"
			);
		}
		return { ...structure, slicing: { ...slicing, offsetX, offsetY } };
	}
	const scale = (value: number, label: string) =>
		direction === "forward"
			? value * change.factor
			: divide(value, change.factor, label);
	return {
		...structure,
		slicing: {
			...slicing,
			cellWidth: scale(slicing.cellWidth, "Cell width"),
			cellHeight: scale(slicing.cellHeight, "Cell height"),
			offsetX: scale(slicing.offsetX, "Grid offset X"),
			offsetY: scale(slicing.offsetY, "Grid offset Y"),
			gapX: scale(slicing.gapX, "Gap X"),
			gapY: scale(slicing.gapY, "Gap Y"),
		},
		frames: structure.frames.map((frame) => ({
			...frame,
			offsetX: scale(frame.offsetX, `${frame.key} offset X`),
			offsetY: scale(frame.offsetY, `${frame.key} offset Y`),
			pivotX: scale(frame.pivotX, `${frame.key} pivot X`),
			pivotY: scale(frame.pivotY, `${frame.key} pivot Y`),
		})),
	};
}
