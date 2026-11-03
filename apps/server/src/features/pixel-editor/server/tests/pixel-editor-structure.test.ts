// biome-ignore-all lint/performance/noAwaitInLoops: each request depends on the revision the previous one returned
import { expect, test } from "bun:test";
import {
	createHarness,
	createSheetPng,
	green,
	otherProjectId,
	otherUserId,
	readPixels,
	red,
	sheetSlicing as slicing,
	solidPng,
	sourceVersionId,
} from "./pixel-editor-harness";

const yellow = "#ffff00ff";
const clearPixel = "#00000000";
const replacementVersionId = "b17f5ff0-a50d-438f-8bf2-a0152b42c302";
const wrongSizeVersionId = "b17f5ff0-a50d-438f-8bf2-a0152b42c303";
const unknownVersionId = "b17f5ff0-a50d-438f-8bf2-a0152b42c3ee";

async function sheetHarness(session?: Parameters<typeof createHarness>[0]) {
	return await createHarness(session, {
		sourcePng: await createSheetPng(),
		versions: {
			[replacementVersionId]: await solidPng(2, 2, yellow),
			[wrongSizeVersionId]: await solidPng(3, 3, yellow),
		},
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
	return {
		id: draft.id as string,
		structure: (await response.json()) as Json,
	};
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

async function commit(harness: Harness, draftId: string) {
	const current = await readStructure(harness, draftId);
	const response = await harness.commitStructure(
		draftId,
		current.draftRevision
	);
	return { response, body: (await response.json()) as Json };
}

function keys(frames: Json[]) {
	return frames.map((frame) => frame.key);
}

test("slicing preview numbers cells in each reading order and never touches the source", async () => {
	const harness = await sheetHarness();
	const draft = (await (await harness.open()).json()) as Json;
	const sourceBefore = harness.objects.get(harness.sourceKey);

	const preview = await harness.slicingPreview(draft.id, {
		...slicing,
		cellWidth: 1,
		cellHeight: 1,
		columns: 2,
		rows: 2,
		offsetX: 1,
		offsetY: 0,
		gapX: 1,
		gapY: 0,
		readingOrder: "columns-bottom-to-top",
	});
	const body = (await preview.json()) as Json;

	expect(preview.status).toBe(200);
	expect(body.frameCount).toBe(4);
	expect(body.sheetSize).toEqual({ width: 6, height: 2 });
	expect(body.cells).toEqual([
		{ index: 0, x: 1, y: 1, width: 1, height: 1 },
		{ index: 1, x: 1, y: 0, width: 1, height: 1 },
		{ index: 2, x: 3, y: 1, width: 1, height: 1 },
		{ index: 3, x: 3, y: 0, width: 1, height: 1 },
	]);

	const rtl = (await (
		await harness.slicingPreview(draft.id, {
			...slicing,
			readingOrder: "rows-right-to-left",
		})
	).json()) as Json;
	expect(rtl.cells.map((cell: Json) => cell.x)).toEqual([4, 2, 0]);

	const reread = (await (await harness.read(draft.id)).json()) as Json;
	expect(reread.revision).toBe(0);
	expect((await harness.readStructure(draft.id)).status).toBe(409);
	expect(harness.objects.get(harness.sourceKey)).toEqual(sourceBefore);
});

test("rejects slicing that leaves the sheet or has invalid numbers", async () => {
	const harness = await sheetHarness();
	const draft = (await (await harness.open()).json()) as Json;

	const tooWide = await harness.slicingPreview(draft.id, {
		...slicing,
		columns: 4,
	});
	expect(tooWide.status).toBe(422);
	expect(((await tooWide.json()) as Json).error).toBe(
		"Invalid slicing parameters"
	);

	const gapOverflow = await harness.slice(draft.id, 0, { ...slicing, gapX: 1 });
	expect(gapOverflow.status).toBe(422);

	for (const bad of [
		{ ...slicing, cellWidth: 0 },
		{ ...slicing, columns: -1 },
		{ ...slicing, gapX: 1.5 },
		{ ...slicing, readingOrder: "diagonal" },
		{ ...slicing, extra: true },
	]) {
		expect((await harness.slicingPreview(draft.id, bad)).status).toBe(400);
	}
	expect((await harness.readStructure(draft.id)).status).toBe(409);
});

test("applies slicing as persisted frames that re-read from the record", async () => {
	const harness = await sheetHarness();
	const { id, structure } = await openSlicedDraft(harness);

	expect(keys(structure.frames)).toEqual(["frame-1", "frame-2", "frame-3"]);
	expect(structure.frames[0]).toMatchObject({
		durationMs: 100,
		offsetX: 0,
		offsetY: 0,
		pivotX: 1,
		pivotY: 2,
		keep: false,
		status: "new",
		unitVersionId: null,
	});
	expect(structure.affectedFrameKeys).toHaveLength(3);

	const reread = await readStructure(harness, id);
	expect(reread.slicing).toEqual(slicing);
	expect(reread.frames).toHaveLength(3);
	const second = await readPixels(await harness.framePreview(id, "frame-2"));
	expect([second.width, second.height]).toEqual([2, 2]);
	expect(second.pixel(0, 0)).toBe(green);
	const draft = (await (await harness.read(id)).json()) as Json;
	expect(draft.sourceSize).toEqual({ width: 6, height: 2 });
});

test("frame add, duplicate, replace, reorder and delete persist and render deterministically", async () => {
	const harness = await sheetHarness();
	const { id } = await openSlicedDraft(harness);

	const blank = await frameOp(harness, id, { type: "add-blank" });
	expect(keys(blank.body.frames)).toEqual([
		"frame-1",
		"frame-2",
		"frame-3",
		"frame-4",
	]);
	const blankPixels = await readPixels(
		await harness.framePreview(id, "frame-4")
	);
	expect(blankPixels.pixel(0, 0)).toBe(clearPixel);

	const dup = await frameOp(harness, id, {
		type: "duplicate",
		frameKey: "frame-1",
	});
	expect(keys(dup.body.frames)).toEqual([
		"frame-1",
		"frame-5",
		"frame-2",
		"frame-3",
		"frame-4",
	]);
	const duplicated = await readPixels(
		await harness.framePreview(id, "frame-5")
	);
	expect(duplicated.pixel(1, 1)).toBe(red);

	const fromVersion = await frameOp(harness, id, {
		type: "add-from-asset-version",
		assetVersionId: replacementVersionId,
		at: 0,
	});
	expect(fromVersion.body.frames[0]).toMatchObject({
		key: "frame-6",
		origin: { kind: "asset-version", assetVersionId: replacementVersionId },
	});

	const replaced = await frameOp(harness, id, {
		type: "replace",
		frameKey: "frame-3",
		assetVersionId: replacementVersionId,
	});
	expect(replaced.response.status).toBe(200);
	const replacedPixels = await readPixels(
		await harness.framePreview(id, "frame-3")
	);
	expect(replacedPixels.pixel(0, 0)).toBe(yellow);

	const moved = await frameOp(harness, id, {
		type: "reorder",
		frameKey: "frame-2",
		toIndex: 0,
	});
	expect(keys(moved.body.frames)).toEqual([
		"frame-2",
		"frame-6",
		"frame-1",
		"frame-5",
		"frame-3",
		"frame-4",
	]);

	const deleted = await frameOp(harness, id, {
		type: "delete",
		frameKey: "frame-6",
	});
	expect(keys(deleted.body.frames)).toEqual([
		"frame-2",
		"frame-1",
		"frame-5",
		"frame-3",
		"frame-4",
	]);

	const reread = await readStructure(harness, id);
	expect(keys(reread.frames)).toEqual(keys(deleted.body.frames));
	expect(reread.frames.map((frame: Json) => frame.index)).toEqual([
		0, 1, 2, 3, 4,
	]);
});

test("per-frame duration, X/Y offset and pivot persist; offset shifts pixels without wrapping or blending", async () => {
	const harness = await sheetHarness();
	const { id } = await openSlicedDraft(harness);

	await frameOp(harness, id, {
		type: "set-duration",
		frameKey: "frame-2",
		durationMs: 250,
	});
	await frameOp(harness, id, {
		type: "set-pivot",
		frameKey: "frame-2",
		x: 0,
		y: 1,
	});
	const shifted = await frameOp(harness, id, {
		type: "set-offset",
		frameKey: "frame-2",
		x: 1,
		y: 0,
	});
	expect(shifted.body.frames[1]).toMatchObject({
		durationMs: 250,
		pivotX: 0,
		pivotY: 1,
		offsetX: 1,
		offsetY: 0,
	});
	const pixels = await readPixels(await harness.framePreview(id, "frame-2"));
	expect(pixels.pixel(0, 0)).toBe(clearPixel);
	expect(pixels.pixel(1, 0)).toBe(green);
	expect(pixels.pixel(1, 1)).toBe(green);
	const first = await readPixels(await harness.framePreview(id, "frame-1"));
	expect(first.pixel(0, 0)).toBe(red);
});

test("rejects invalid frame operations without changing the record", async () => {
	const harness = await sheetHarness();
	const { id } = await openSlicedDraft(harness);
	const before = await readStructure(harness, id);

	const cases: [unknown, number][] = [
		[{ type: "delete", frameKey: "frame-99" }, 422],
		[{ type: "set-pivot", frameKey: "frame-1", x: 3, y: 0 }, 422],
		[{ type: "set-duration", frameKey: "frame-1", durationMs: 0 }, 400],
		[{ type: "set-offset", frameKey: "frame-1", x: 0.5, y: 0 }, 400],
		[{ type: "set-duration", frameKey: "bad key", durationMs: 10 }, 400],
		[
			{
				type: "replace",
				frameKey: "frame-1",
				assetVersionId: wrongSizeVersionId,
			},
			422,
		],
		[
			{
				type: "replace",
				frameKey: "frame-1",
				assetVersionId: unknownVersionId,
			},
			404,
		],
	];
	for (const [operation, status] of cases) {
		const { response } = await frameOp(harness, id, operation);
		expect(response.status).toBe(status);
	}
	expect(await readStructure(harness, id)).toEqual(before);

	const stale = await harness.frameOp(id, before.draftRevision + 5, {
		type: "add-blank",
	});
	expect(stale.status).toBe(409);
	expect(((await stale.json()) as Json).error).toBe(
		"Working Draft revision conflict"
	);

	await frameOp(harness, id, { type: "delete", frameKey: "frame-1" });
	await frameOp(harness, id, { type: "delete", frameKey: "frame-2" });
	const last = await frameOp(harness, id, {
		type: "delete",
		frameKey: "frame-3",
	});
	expect(last.response.status).toBe(422);
});

test("protected frames cannot be silently changed, deleted or moved until keep is turned off", async () => {
	const harness = await sheetHarness();
	const { id } = await openSlicedDraft(harness);
	await frameOp(harness, id, {
		type: "set-keep",
		frameKey: "frame-2",
		keep: true,
	});
	const before = await readStructure(harness, id);
	expect(before.frames[1].keep).toBe(true);

	const blocked = [
		{ type: "delete", frameKey: "frame-2" },
		{
			type: "replace",
			frameKey: "frame-2",
			assetVersionId: replacementVersionId,
		},
		{ type: "set-offset", frameKey: "frame-2", x: 1, y: 0 },
		{ type: "set-pivot", frameKey: "frame-2", x: 0, y: 0 },
		{ type: "set-duration", frameKey: "frame-2", durationMs: 500 },
		{ type: "reorder", frameKey: "frame-2", toIndex: 0 },
	];
	for (const operation of blocked) {
		const { response, body } = await frameOp(harness, id, operation);
		expect(response.status).toBe(409);
		expect(body.error).toBe("Protected frame");
	}
	expect(await readStructure(harness, id)).toEqual(before);

	// Neighbours stay editable; duplicating a kept frame does not change it.
	const neighbour = await frameOp(harness, id, {
		type: "set-duration",
		frameKey: "frame-1",
		durationMs: 40,
	});
	expect(neighbour.response.status).toBe(200);
	const dup = await frameOp(harness, id, {
		type: "duplicate",
		frameKey: "frame-2",
	});
	expect(dup.response.status).toBe(200);
	const copy = dup.body.frames.find((frame: Json) => frame.key === "frame-4");
	expect(copy.keep).toBe(false);

	// Sheet pixel edits cannot reach the kept cell but can change others.
	const revision = (await readStructure(harness, id)).draftRevision;
	const intoKept = await harness.apply(id, revision, {
		type: "pen",
		color: yellow,
		size: 1,
		points: [{ x: 2, y: 0 }],
	});
	expect(intoKept.status).toBe(409);
	expect(((await intoKept.json()) as Json).error).toBe("Protected frame");
	const crop = await harness.apply(id, revision, {
		type: "crop",
		rect: { x: 0, y: 0, width: 4, height: 2 },
	});
	expect(crop.status).toBe(422);
	const outside = await harness.apply(id, revision, {
		type: "pen",
		color: yellow,
		size: 1,
		points: [{ x: 0, y: 0 }],
	});
	expect(outside.status).toBe(200);

	// A re-slice that would change the kept cell is blocked too.
	const current = await readStructure(harness, id);
	const reslice = await harness.slice(id, current.draftRevision, {
		...slicing,
		cellWidth: 1,
	});
	expect(reslice.status).toBe(409);

	await frameOp(harness, id, {
		type: "set-keep",
		frameKey: "frame-2",
		keep: false,
	});
	const edited = await frameOp(harness, id, {
		type: "set-offset",
		frameKey: "frame-2",
		x: 1,
		y: 0,
	});
	expect(edited.response.status).toBe(200);
});

test("commit versions only affected frames and pins them in a new Composite Version", async () => {
	const harness = await sheetHarness();
	const { id } = await openSlicedDraft(harness);

	const first = await commit(harness, id);
	expect(first.response.status).toBe(201);
	expect(first.body.createdUnitVersionIds).toHaveLength(3);
	expect(first.body.reusedUnitVersionIds).toHaveLength(0);
	expect(first.body.structure.frames.map((f: Json) => f.status)).toEqual([
		"pinned",
		"pinned",
		"pinned",
	]);
	expect(first.body.structure.affectedFrameKeys).toEqual([]);
	const baselineUnits = first.body.structure.frames.map(
		(f: Json) => f.unitVersionId
	);
	const unitCandidates = harness.calls.candidates.filter(
		(candidate) => candidate.unitCorrection
	);
	expect(
		unitCandidates.map(
			(candidate) => (candidate.unitCorrection as Json).unitKey
		)
	).toEqual(["frame-1", "frame-2", "frame-3"]);
	expect(unitCandidates[0]).toMatchObject({
		sourceKind: "derived",
		unitCorrection: {
			sourceAssetVersionId: sourceVersionId,
			unitType: "frame",
		},
	});

	const noChange = await commit(harness, id);
	expect(noChange.response.status).toBe(400);
	expect(noChange.body.error).toBe("Frame structure has no changes");

	// Only the frame whose duration changed is rebuilt.
	const edited = await frameOp(harness, id, {
		type: "set-duration",
		frameKey: "frame-2",
		durationMs: 300,
	});
	expect(edited.body.affectedFrameKeys).toEqual(["frame-2"]);
	expect(edited.body.frames.map((f: Json) => f.status)).toEqual([
		"pinned",
		"changed",
		"pinned",
	]);

	const second = await commit(harness, id);
	expect(second.response.status).toBe(201);
	expect(second.body.createdUnitVersionIds).toHaveLength(1);
	expect(second.body.reusedUnitVersionIds).toEqual([
		baselineUnits[0],
		baselineUnits[2],
	]);
	const nextUnits = second.body.structure.frames.map(
		(f: Json) => f.unitVersionId
	);
	expect(nextUnits[0]).toBe(baselineUnits[0]);
	expect(nextUnits[1]).not.toBe(baselineUnits[1]);
	expect(nextUnits[2]).toBe(baselineUnits[2]);
	expect(second.body.compositeVersionId).not.toBe(
		first.body.compositeVersionId
	);

	// The first Composite Version still pins the original units.
	expect(harness.calls.composites[0]?.unitVersionIds).toEqual(baselineUnits);
	expect(harness.calls.composites[1]?.unitVersionIds).toEqual(nextUnits);
	expect(second.body.structure.lastCommit).toMatchObject({
		compositeVersionId: second.body.compositeVersionId,
		frameKeys: ["frame-1", "frame-2", "frame-3"],
	});

	// The Working Draft stays open.
	const draft = (await (await harness.read(id)).json()) as Json;
	expect(draft.status).toBe("open");
});

test("reorder-only and delete-only changes pin a new Composite Version without rebuilding units", async () => {
	const harness = await sheetHarness();
	const { id } = await openSlicedDraft(harness);
	const first = await commit(harness, id);
	const units = first.body.structure.frames.map((f: Json) => f.unitVersionId);
	const candidatesBefore = harness.calls.candidates.length;

	const reordered = await frameOp(harness, id, {
		type: "reorder",
		frameKey: "frame-3",
		toIndex: 0,
	});
	expect(reordered.body.orderChanged).toBe(true);
	expect(reordered.body.affectedFrameKeys).toEqual([]);
	const second = await commit(harness, id);
	expect(second.response.status).toBe(201);
	expect(second.body.createdUnitVersionIds).toEqual([]);
	expect(second.body.structure.lastCommit.frameKeys).toEqual([
		"frame-3",
		"frame-1",
		"frame-2",
	]);
	expect(harness.calls.candidates.length).toBe(candidatesBefore);
	expect(
		second.body.structure.frames.map((f: Json) => f.unitVersionId)
	).toEqual([units[2], units[0], units[1]]);

	await frameOp(harness, id, { type: "delete", frameKey: "frame-1" });
	const third = await commit(harness, id);
	expect(third.response.status).toBe(201);
	expect(third.body.createdUnitVersionIds).toEqual([]);
	expect(harness.calls.composites[2]?.unitVersionIds).toEqual([
		units[2],
		units[1],
	]);
});

test("requires a session, project membership and ownership for every structure route", async () => {
	const anonymous = await sheetHarness(null);
	const draftId = "b17f5ff0-a50d-438f-8bf2-a0152b42c4aa";
	for (const response of [
		await anonymous.slicingPreview(draftId, slicing),
		await anonymous.slice(draftId, 0, slicing),
		await anonymous.frameOp(draftId, 0, { type: "add-blank" }),
		await anonymous.commitStructure(draftId, 0),
		await anonymous.readStructure(draftId),
	]) {
		expect(response.status).toBe(401);
	}

	const harness = await sheetHarness();
	const { id } = await openSlicedDraft(harness);
	const wrongProject = `/api/projects/${otherProjectId}/pixel-editor/drafts/${id}/structure`;
	expect((await harness.app.request(wrongProject)).status).toBe(404);
	const foreign = await sheetHarness({ user: { id: otherUserId } });
	expect((await foreign.readStructure(id)).status).toBe(404);
	expect((await foreign.slicingPreview(id, slicing)).status).toBe(404);
	expect((await harness.readStructure("not-a-uuid")).status).toBe(404);
});

test("a stale commit revision conflicts and a discarded draft is read-only", async () => {
	const harness = await sheetHarness();
	const { id } = await openSlicedDraft(harness);
	expect((await harness.commitStructure(id, 0)).status).toBe(409);
	expect(harness.calls.composites).toHaveLength(0);

	await harness.app.request(`${harness.base}/${id}/discard`, {
		method: "POST",
	});
	const closed = await harness.frameOp(id, 99, { type: "add-blank" });
	expect(closed.status).toBe(409);
});

test("does not offer layers, free-angle rotation or skeleton animation", async () => {
	const harness = await sheetHarness();
	const { id } = await openSlicedDraft(harness);

	for (const operation of [
		{ type: "set-rotation", frameKey: "frame-1", degrees: 33 },
		{ type: "add-layer", frameKey: "frame-1" },
		{ type: "set-skeleton", frameKey: "frame-1" },
		{ type: "set-pivot", frameKey: "frame-1", x: 0, y: 0, angle: 12 },
	]) {
		expect((await harness.frameOp(id, 1, operation)).status).toBe(400);
	}
	const freeRotation = await harness.apply(id, 1, {
		type: "rotate",
		angle: 33,
	});
	expect(freeRotation.status).toBe(400);
	for (const path of ["layers", "skeleton", "rotation"]) {
		const response = await harness.app.request(
			`${harness.base}/${id}/structure/${path}`,
			{ method: "POST" }
		);
		expect(response.status).toBe(404);
	}
});
