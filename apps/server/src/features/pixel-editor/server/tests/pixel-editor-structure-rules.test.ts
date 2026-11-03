// biome-ignore-all lint/performance/noAwaitInLoops: each request depends on the revision the previous one returned
import { expect, test } from "bun:test";
import {
	createHarness,
	createSheetPng,
	green,
	readPixels,
	red,
	sheetSlicing as slicing,
	solidPng,
} from "./pixel-editor-harness";

const yellow = "#ffff00ff";
const clearPixel = "#00000000";
const assetFrameVersionId = "b17f5ff0-a50d-438f-8bf2-a0152b42c302";

async function sheetHarness() {
	return await createHarness(undefined, {
		sourcePng: await createSheetPng(),
		versions: { [assetFrameVersionId]: await solidPng(2, 2, yellow) },
	});
}

type Harness = Awaited<ReturnType<typeof sheetHarness>>;
interface Json {
	[key: string]: any;
}

async function openSlicedDraft(harness: Harness) {
	const draft = (await (await harness.open()).json()) as Json;
	const response = await harness.slice(draft.id, draft.revision, slicing);
	expect(response.status).toBe(200);
	return draft.id as string;
}

async function readStructure(harness: Harness, draftId: string) {
	return (await (await harness.readStructure(draftId)).json()) as Json;
}

async function frameOp(harness: Harness, draftId: string, operation: unknown) {
	const current = await readStructure(harness, draftId);
	const response = await harness.frameOp(
		draftId,
		current.draftRevision,
		operation
	);
	return { response, body: (await response.json()) as Json };
}

async function sheetOp(harness: Harness, draftId: string, operation: unknown) {
	const current = await readStructure(harness, draftId);
	const response = await harness.apply(
		draftId,
		current.draftRevision,
		operation
	);
	return { response, body: (await response.json()) as Json };
}

async function history(
	harness: Harness,
	draftId: string,
	direction: "undo" | "redo"
) {
	const current = await readStructure(harness, draftId);
	const response = await harness[direction](draftId, current.draftRevision);
	return { response, body: (await response.json()) as Json };
}

async function commit(harness: Harness, draftId: string) {
	const current = await readStructure(harness, draftId);
	const response = await harness.commitStructure(
		draftId,
		current.draftRevision
	);
	return { response, body: (await response.json()) as Json };
}

test("a frame offset change makes a new Unit Version, including for a blank frame", async () => {
	const harness = await sheetHarness();
	const id = await openSlicedDraft(harness);
	await frameOp(harness, id, { type: "add-blank" });
	await commit(harness, id);
	const moved = await frameOp(harness, id, {
		type: "set-offset",
		frameKey: "frame-4",
		x: 1,
		y: 0,
	});
	// A blank frame renders the same pixels at any offset, so only the offset
	// itself can tell this from the committed unit.
	expect(moved.body.frames[3].status).toBe("changed");
	expect(moved.body.affectedFrameKeys).toEqual(["frame-4"]);
	const second = await commit(harness, id);
	expect(second.response.status).toBe(201);
	expect(second.body.createdUnitVersionIds).toHaveLength(1);
});

test("a frame can be marked as an issue and cleared, and the mark is versioned", async () => {
	const harness = await sheetHarness();
	const id = await openSlicedDraft(harness);
	const first = await commit(harness, id);
	expect(first.body.structure.frames.map((f: Json) => f.issue)).toEqual([
		false,
		false,
		false,
	]);

	const marked = await frameOp(harness, id, {
		type: "set-issue",
		frameKey: "frame-2",
		issue: true,
	});
	expect(marked.response.status).toBe(200);
	expect(marked.body.frames[1]).toMatchObject({
		issue: true,
		status: "changed",
	});
	const second = await commit(harness, id);
	expect(second.body.createdUnitVersionIds).toHaveLength(1);

	const cleared = await frameOp(harness, id, {
		type: "set-issue",
		frameKey: "frame-2",
		issue: false,
	});
	expect(cleared.body.frames[1]).toMatchObject({
		issue: false,
		status: "changed",
	});
	expect(
		(await frameOp(harness, id, { type: "set-issue", frameKey: "x", issue: 1 }))
			.response.status
	).toBe(400);
});

test("no move can cross a kept frame, whichever frame is moved", async () => {
	const harness = await sheetHarness();
	const id = await openSlicedDraft(harness);
	await frameOp(harness, id, {
		type: "set-keep",
		frameKey: "frame-2",
		keep: true,
	});
	const before = await readStructure(harness, id);
	for (const operation of [
		{ type: "reorder", frameKey: "frame-3", toIndex: 0 },
		{ type: "reorder", frameKey: "frame-1", toIndex: 2 },
	]) {
		const { response, body } = await frameOp(harness, id, operation);
		expect(response.status).toBe(409);
		expect(body.error).toBe("Protected frame");
	}
	expect(await readStructure(harness, id)).toEqual(before);

	const harmless = await frameOp(harness, id, {
		type: "add-blank",
		at: 3,
	});
	expect(harmless.response.status).toBe(200);
	const insideTail = await frameOp(harness, id, {
		type: "reorder",
		frameKey: "frame-4",
		toIndex: 2,
	});
	expect(insideTail.response.status).toBe(200);
});

test("blank and Asset Version frames take pixel edits of their own; cell and kept frames do not", async () => {
	const harness = await sheetHarness();
	const id = await openSlicedDraft(harness);
	await frameOp(harness, id, { type: "add-blank" });
	await frameOp(harness, id, {
		type: "add-from-asset-version",
		assetVersionId: assetFrameVersionId,
	});

	const pen = {
		type: "pen",
		color: green,
		size: 1,
		points: [{ x: 1, y: 0 }],
	};
	const blank = await frameOp(harness, id, {
		type: "edit-pixels",
		frameKey: "frame-4",
		operation: pen,
	});
	expect(blank.response.status).toBe(200);
	expect(blank.body.frames[3]).toMatchObject({ editCount: 1, status: "new" });
	const blankPng = await readPixels(await harness.framePreview(id, "frame-4"));
	expect(blankPng.pixel(1, 0)).toBe(green);
	expect(blankPng.pixel(0, 0)).toBe(clearPixel);

	const asset = await frameOp(harness, id, {
		type: "edit-pixels",
		frameKey: "frame-5",
		operation: { type: "fill", color: red, at: { x: 0, y: 0 } },
	});
	expect(asset.response.status).toBe(200);
	const assetPng = await readPixels(await harness.framePreview(id, "frame-5"));
	expect(assetPng.pixel(1, 1)).toBe(red);

	const undone = await frameOp(harness, id, {
		type: "undo-pixel-edit",
		frameKey: "frame-4",
	});
	expect(undone.body.frames[3].editCount).toBe(0);
	const nothing = await frameOp(harness, id, {
		type: "undo-pixel-edit",
		frameKey: "frame-4",
	});
	expect(nothing.response.status).toBe(422);

	const cell = await frameOp(harness, id, {
		type: "edit-pixels",
		frameKey: "frame-1",
		operation: pen,
	});
	expect(cell.response.status).toBe(422);
	const resize = await frameOp(harness, id, {
		type: "edit-pixels",
		frameKey: "frame-4",
		operation: { type: "scale", factor: 2 },
	});
	expect(resize.response.status).toBe(422);

	await frameOp(harness, id, {
		type: "set-keep",
		frameKey: "frame-4",
		keep: true,
	});
	const kept = await frameOp(harness, id, {
		type: "edit-pixels",
		frameKey: "frame-4",
		operation: pen,
	});
	expect(kept.response.status).toBe(409);
	expect(kept.body.error).toBe("Protected frame");
});

test("scale carries the frame structure by the integer factor and undo restores it", async () => {
	const harness = await sheetHarness();
	const id = await openSlicedDraft(harness);
	await frameOp(harness, id, {
		type: "set-pivot",
		frameKey: "frame-1",
		x: 1,
		y: 2,
	});
	const scaled = await sheetOp(harness, id, { type: "scale", factor: 2 });
	expect(scaled.response.status).toBe(200);
	const view = await readStructure(harness, id);
	expect(view.sheetSize).toEqual({ width: 12, height: 4 });
	expect(view.slicing).toMatchObject({
		cellWidth: 4,
		cellHeight: 4,
		columns: 3,
	});
	expect(view.frames[0]).toMatchObject({ pivotX: 2, pivotY: 4 });
	const preview = await readPixels(await harness.framePreview(id, "frame-3"));
	expect(preview.width).toBe(4);

	const undone = await history(harness, id, "undo");
	expect(undone.response.status).toBe(200);
	const back = await readStructure(harness, id);
	expect(back.slicing).toMatchObject({ cellWidth: 2, cellHeight: 2 });
	expect(back.frames[0]).toMatchObject({ pivotX: 1, pivotY: 2 });
	const redone = await history(harness, id, "redo");
	expect(redone.response.status).toBe(200);
	expect((await readStructure(harness, id)).slicing.cellWidth).toBe(4);
});

test("scale is refused with a reason while a kept frame or a frame from another Asset Version would change", async () => {
	const harness = await sheetHarness();
	const id = await openSlicedDraft(harness);
	await frameOp(harness, id, {
		type: "set-keep",
		frameKey: "frame-1",
		keep: true,
	});
	const kept = await sheetOp(harness, id, { type: "scale", factor: 2 });
	expect(kept.response.status).toBe(409);
	expect(kept.body.error).toBe("Protected frame");
	await frameOp(harness, id, {
		type: "set-keep",
		frameKey: "frame-1",
		keep: false,
	});
	await frameOp(harness, id, {
		type: "add-from-asset-version",
		assetVersionId: assetFrameVersionId,
	});
	const foreign = await sheetOp(harness, id, { type: "scale", factor: 2 });
	expect(foreign.response.status).toBe(422);
	expect(foreign.body.detail).toContain("frame-4");
});

test("resize-canvas moves the grid with the cells and keeps kept frames pinned; a crop that cuts the grid is refused", async () => {
	const harness = await sheetHarness();
	const id = await openSlicedDraft(harness);
	await frameOp(harness, id, {
		type: "set-keep",
		frameKey: "frame-2",
		keep: true,
	});
	await commit(harness, id);

	const resized = await sheetOp(harness, id, {
		type: "resize-canvas",
		width: 8,
		height: 3,
		anchor: "bottom-right",
	});
	expect(resized.response.status).toBe(200);
	const view = await readStructure(harness, id);
	expect(view.slicing).toMatchObject({ offsetX: 2, offsetY: 1 });
	expect(view.frames.map((f: Json) => f.status)).toEqual([
		"pinned",
		"pinned",
		"pinned",
	]);

	const cut = await sheetOp(harness, id, {
		type: "crop",
		rect: { x: 0, y: 0, width: 5, height: 3 },
	});
	expect(cut.response.status).toBe(422);
	expect(cut.body.detail).toBeTruthy();

	const trim = await sheetOp(harness, id, {
		type: "crop",
		rect: { x: 2, y: 1, width: 6, height: 2 },
	});
	expect(trim.response.status).toBe(200);
	expect((await readStructure(harness, id)).slicing).toMatchObject({
		offsetX: 0,
		offsetY: 0,
	});

	const undone = await history(harness, id, "undo");
	expect(undone.response.status).toBe(200);
	expect((await readStructure(harness, id)).slicing).toMatchObject({
		offsetX: 2,
		offsetY: 1,
	});
});

test("a failed unit write cleans up its object and a retry adopts the units already built", async () => {
	const harness = await sheetHarness();
	const id = await openSlicedDraft(harness);
	const objectsBefore = harness.objects.size;

	harness.faults.failPut = true;
	const storageDown = await commit(harness, id);
	expect(storageDown.response.status).toBe(503);
	expect(storageDown.body.error).toBe("Frame structure commit failed");
	expect(harness.objects.size).toBe(objectsBefore);
	harness.faults.failPut = false;

	harness.faults.failCandidateOnCall = 2;
	const partial = await commit(harness, id);
	expect(partial.response.status).toBe(503);
	expect(harness.calls.composites).toHaveLength(0);
	const draftAfterFailure = await readStructure(harness, id);
	expect(draftAfterFailure.lastCommit).toBeNull();
	harness.faults.failCandidateOnCall = null;

	const retry = await commit(harness, id);
	expect(retry.response.status).toBe(201);
	expect(retry.body.createdUnitVersionIds).toHaveLength(3);
	expect(harness.calls.composites).toHaveLength(1);
	// frame-1 was built by the failed attempt; the retry adopted it by idempotency key.
	const frameOneKeys = harness.calls.candidates.filter(
		(candidate) => (candidate.unitCorrection as Json)?.unitKey === "frame-1"
	);
	expect(frameOneKeys).toHaveLength(2);
	expect(frameOneKeys[0]?.idempotencyKey).toBe(frameOneKeys[1]?.idempotencyKey);
	const stored = [...harness.objects.keys()].length;
	expect(stored).toBe(objectsBefore + 3);
});
