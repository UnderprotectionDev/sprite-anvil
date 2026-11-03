import { expect, test } from "bun:test";
import type { SheetStructure } from "@sprite-anvil/api/pixel-editor-structure";
import { createRaster } from "../pixel-operations";
import {
	assertProtectedFramesUnchanged,
	assertSheetEditKeepsProtectedFrames,
	computeCells,
	createStructure,
	SheetStructureError,
} from "../sheet-structure";

const slicing = {
	cellWidth: 2,
	cellHeight: 2,
	columns: 2,
	rows: 1,
	offsetX: 0,
	offsetY: 0,
	gapX: 0,
	gapY: 0,
	readingOrder: "rows-left-to-right" as const,
};

type Frame = SheetStructure["frames"][number];

function setup() {
	const sheet = createRaster(4, 2);
	sheet.data.fill(255);
	const structure = createStructure(slicing, sheet);
	const kept = patchFirst(structure, { keep: true });
	const cells = computeCells(slicing, sheet);
	const context = { sheet, sources: new Map() };
	return { kept, cells, context };
}

function patchFirst(
	structure: SheetStructure,
	patch: Partial<Frame>
): SheetStructure {
	return {
		...structure,
		frames: structure.frames.map((frame, index) =>
			index === 0 ? { ...frame, ...patch } : frame
		),
	};
}

function check(before: SheetStructure, after: SheetStructure) {
	const { cells, context } = setup();
	assertProtectedFramesUnchanged(
		before,
		after,
		{ before: cells, after: cells },
		{ before: context, after: context }
	);
}

test("unlocking a kept frame must change only keep in that request", () => {
	const { kept } = setup();
	expect(() => check(kept, patchFirst(kept, { keep: false }))).not.toThrow();
	const mixed: Partial<Frame>[] = [
		{ durationMs: 500 },
		{ offsetX: 1 },
		{ pivotX: 0 },
		{ origin: { kind: "blank" } },
	];
	for (const patch of mixed) {
		expect(() =>
			check(kept, patchFirst(kept, { keep: false, ...patch }))
		).toThrow(SheetStructureError);
	}
});

test("unlocking a kept frame cannot ride along with a change to its cell pixels", () => {
	const { kept, cells, context } = setup();
	const changedSheet = createRaster(4, 2);
	expect(() =>
		assertProtectedFramesUnchanged(
			kept,
			patchFirst(kept, { keep: false }),
			{ before: cells, after: cells },
			{ before: context, after: { sheet: changedSheet, sources: new Map() } }
		)
	).toThrow(SheetStructureError);
});

test("sheet pixel edits cannot reach kept frames that are not cut from the sheet", () => {
	const { kept } = setup();
	const blankKept = patchFirst(kept, { origin: { kind: "blank" } });
	const before = createRaster(4, 2);
	const after = createRaster(4, 2);
	after.data.fill(9);
	// Cell 0 changed but no kept frame is cut from it: the blank frame renders
	// independently of the sheet, so the sheet guard has nothing to protect.
	expect(() =>
		assertSheetEditKeepsProtectedFrames(blankKept, before, after)
	).not.toThrow();
	expect(() =>
		assertSheetEditKeepsProtectedFrames(kept, before, after)
	).toThrow(SheetStructureError);
});
