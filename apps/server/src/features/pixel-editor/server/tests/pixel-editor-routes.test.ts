import { expect, test } from "bun:test";
import {
	assetRecordId,
	blue,
	clear,
	createHarness,
	green,
	otherProjectId,
	otherUserId,
	projectId,
	readPixels,
	red,
	sourceVersionId,
	unknownVersionId,
} from "./pixel-editor-harness";

async function openDraft(harness: Awaited<ReturnType<typeof createHarness>>) {
	const response = await harness.open();
	return (await response.json()) as {
		id: string;
		revision: number;
		[key: string]: unknown;
	};
}

test("opens a recoverable Working Draft from an Asset Version and reopens the same one", async () => {
	const harness = await createHarness();
	const first = await harness.open();
	const draft = (await first.json()) as Record<string, any>;

	expect(first.status).toBe(201);
	expect(draft).toMatchObject({
		status: "open",
		revision: 0,
		sourceAssetVersionId: sourceVersionId,
		sourceSize: { width: 4, height: 4 },
		size: { width: 4, height: 4 },
		canUndo: false,
		canRedo: false,
		diff: { changedPixelCount: 0, boundingBox: null, sizeChanged: false },
		palette: { origin: "source-image", colors: [blue, red] },
		outOfPaletteColors: [],
	});
	expect(draft.usedColors).toEqual([
		{ color: red, pixelCount: 8 },
		{ color: blue, pixelCount: 7 },
	]);

	const again = await harness.open();
	expect(again.status).toBe(200);
	expect(((await again.json()) as { id: string }).id).toBe(draft.id);
	const reread = await harness.read(draft.id);
	expect(reread.status).toBe(200);
});

test("pen edit is applied by the server, re-read from the record, and leaves the source untouched", async () => {
	const harness = await createHarness();
	const draft = await openDraft(harness);

	const response = await harness.apply(draft.id, 0, {
		type: "pen",
		color: green,
		size: 1,
		points: [{ x: 0, y: 0 }],
	});
	const updated = (await response.json()) as Record<string, any>;

	expect(response.status).toBe(200);
	expect(updated).toMatchObject({
		revision: 1,
		canUndo: true,
		diff: {
			changedPixelCount: 1,
			boundingBox: { x: 0, y: 0, width: 1, height: 1 },
		},
		outOfPaletteColors: [{ color: green, pixelCount: 1 }],
	});

	const reread = (await (await harness.read(draft.id)).json()) as Record<
		string,
		any
	>;
	expect(reread.operations).toHaveLength(1);
	const pixels = await readPixels(await harness.preview(draft.id));
	expect(pixels.pixel(0, 0)).toBe(green);
	expect(pixels.pixel(1, 0)).toBe(red);
	expect(harness.objects.get(harness.sourceKey)).toEqual(
		new Uint8Array(harness.sourcePng)
	);
});

test("undo and redo act on the Working Draft and a new edit drops the redo tail", async () => {
	const harness = await createHarness();
	const draft = await openDraft(harness);
	await harness.apply(draft.id, 0, {
		type: "pen",
		color: green,
		size: 1,
		points: [{ x: 0, y: 0 }],
	});

	const undone = (await (await harness.undo(draft.id, 1)).json()) as Record<
		string,
		any
	>;
	expect(undone).toMatchObject({ canUndo: false, canRedo: true, revision: 2 });
	expect(undone.diff.changedPixelCount).toBe(0);
	expect((await readPixels(await harness.preview(draft.id))).pixel(0, 0)).toBe(
		red
	);

	const redone = (await (await harness.redo(draft.id, 2)).json()) as Record<
		string,
		any
	>;
	expect(redone).toMatchObject({ canUndo: true, canRedo: false });
	expect(redone.diff.changedPixelCount).toBe(1);

	await harness.undo(draft.id, 3);
	const branched = (await (
		await harness.apply(draft.id, 4, {
			type: "eraser",
			size: 1,
			points: [{ x: 3, y: 0 }],
		})
	).json()) as Record<string, any>;
	expect(branched.canRedo).toBe(false);
	expect(branched.operations).toHaveLength(1);
	expect((await harness.undo(draft.id, 5)).status).toBe(200);
	expect((await harness.undo(draft.id, 6)).status).toBe(409);
	expect(((await (await harness.undo(draft.id, 6)).json()) as any).error).toBe(
		"Nothing to undo"
	);
});

test("exact-match fill, line, eraser and picker-free colour edits stay on the logical pixel grid", async () => {
	const harness = await createHarness();
	const draft = await openDraft(harness);

	const filled = (await (
		await harness.apply(draft.id, 0, {
			type: "fill",
			color: green,
			at: { x: 0, y: 0 },
		})
	).json()) as Record<string, any>;
	expect(filled.diff.changedPixelCount).toBe(8);
	expect(filled.outOfPaletteColors).toEqual([{ color: green, pixelCount: 8 }]);

	await harness.apply(draft.id, 1, {
		type: "line",
		color: red,
		size: 1,
		from: { x: 0, y: 0 },
		to: { x: 3, y: 3 },
	});
	const pixels = await readPixels(await harness.preview(draft.id));
	for (let i = 0; i < 4; i += 1) {
		expect(pixels.pixel(i, i)).toBe(red);
	}
	expect(pixels.pixel(1, 0)).toBe(green);
	expect(pixels.pixel(3, 0)).toBe(blue);

	// Fill only reaches pixels that exactly match the clicked colour.
	const transparentFill = await harness.apply(draft.id, 2, {
		type: "fill",
		color: blue,
		at: { x: 3, y: 3 },
	});
	expect(transparentFill.status).toBe(200);
	expect((await readPixels(await harness.preview(draft.id))).pixel(3, 3)).toBe(
		blue
	);
});

test("previews and applies bulk colour replacement with the affected pixel count", async () => {
	const harness = await createHarness();
	const draft = await openDraft(harness);
	await harness.apply(draft.id, 0, {
		type: "pen",
		color: green,
		size: 2,
		points: [{ x: 0, y: 0 }],
	});

	const preview = await harness.app.request(
		`${harness.base}/${draft.id}/color-replace-preview`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ from: green, to: red }),
		}
	);
	expect(await preview.json()).toEqual({
		from: green,
		to: red,
		affectedPixelCount: 4,
		resultIsInPalette: true,
	});
	// The preview alone changes nothing.
	expect(((await (await harness.read(draft.id)).json()) as any).revision).toBe(
		1
	);

	const replaced = (await (
		await harness.apply(draft.id, 1, {
			type: "replace-color",
			from: green,
			to: red,
		})
	).json()) as Record<string, any>;
	expect(replaced.outOfPaletteColors).toEqual([]);
	expect(replaced.diff.changedPixelCount).toBe(0);
});

test("crop, canvas resize, nearest-neighbour scale, flip, rotate and move keep exact source colours", async () => {
	const harness = await createHarness();
	const draft = await openDraft(harness);

	const cropped = (await (
		await harness.apply(draft.id, 0, {
			type: "crop",
			rect: { x: 1, y: 1, width: 2, height: 2 },
		})
	).json()) as Record<string, any>;
	expect(cropped.size).toEqual({ width: 2, height: 2 });
	expect(cropped.diff.sizeChanged).toBe(true);

	const scaled = (await (
		await harness.apply(draft.id, 1, { type: "scale", factor: 3 })
	).json()) as Record<string, any>;
	expect(scaled.size).toEqual({ width: 6, height: 6 });
	expect(scaled.outOfPaletteColors).toEqual([]);
	const scaledPixels = await readPixels(await harness.preview(draft.id));
	expect(scaledPixels.pixel(0, 0)).toBe(red);
	expect(scaledPixels.pixel(2, 2)).toBe(red);
	expect(scaledPixels.pixel(3, 0)).toBe(blue);

	await harness.apply(draft.id, 2, {
		type: "resize-canvas",
		width: 8,
		height: 6,
		anchor: "right",
	});
	const resized = await readPixels(await harness.preview(draft.id));
	expect([resized.width, resized.height]).toEqual([8, 6]);
	expect(resized.pixel(0, 0)).toBe(clear);
	expect(resized.pixel(2, 0)).toBe(red);

	await harness.apply(draft.id, 3, {
		type: "rotate-90",
		direction: "clockwise",
		rect: null,
	});
	const rotated = await readPixels(await harness.preview(draft.id));
	expect([rotated.width, rotated.height]).toEqual([6, 8]);

	await harness.apply(draft.id, 4, {
		type: "flip",
		axis: "horizontal",
		rect: null,
	});
	await harness.apply(draft.id, 5, {
		type: "move-selection",
		rect: { x: 0, y: 0, width: 2, height: 2 },
		dx: 1,
		dy: 1,
	});
	const final = (await (await harness.read(draft.id)).json()) as Record<
		string,
		any
	>;
	expect(final.operations).toHaveLength(6);
	expect(final.outOfPaletteColors).toEqual([]);
});

test("commit creates exactly one derived Candidate Version from the server-rendered result", async () => {
	const harness = await createHarness();
	const draft = await openDraft(harness);
	await harness.apply(draft.id, 0, {
		type: "pen",
		color: green,
		size: 1,
		points: [{ x: 0, y: 0 }],
	});
	const rendered = await harness.preview(draft.id);

	const committed = await harness.commit(draft.id);
	const body = (await committed.json()) as Record<string, any>;
	expect(committed.status).toBe(201);
	expect(body.created).toBe(true);
	expect(body.draft).toMatchObject({
		status: "committed",
		committedAssetVersionId: body.assetVersionId,
	});
	expect(harness.calls.candidates).toHaveLength(1);
	expect(harness.calls.candidates[0]).toMatchObject({
		id: body.assetVersionId,
		assetRecordId,
		assetFamilyId: "pixel-editor-family",
		projectId,
		sourceKind: "derived",
		contentType: "image/png",
		idempotencyKey: `pixel-editor-draft:${draft.id}`,
		integrityVerified: true,
	});
	const stored = harness.objects.get(
		harness.calls.candidates[0]?.objectKey as string
	);
	expect(stored).toEqual(rendered);
	expect(body.assetVersionId).not.toBe(sourceVersionId);
	expect(harness.objects.get(harness.sourceKey)).toEqual(
		new Uint8Array(harness.sourcePng)
	);

	const again = await harness.commit(draft.id);
	expect(again.status).toBe(200);
	expect(((await again.json()) as any).assetVersionId).toBe(
		body.assetVersionId
	);
	expect(harness.calls.candidates).toHaveLength(1);

	const reread = (await (await harness.read(draft.id)).json()) as any;
	expect(reread.committedAssetVersionId).toBe(body.assetVersionId);
	const after = await harness.apply(draft.id, reread.revision, {
		type: "eraser",
		size: 1,
		points: [{ x: 0, y: 0 }],
	});
	expect(after.status).toBe(409);
	expect(((await after.json()) as any).error).toBe("Working Draft is not open");
});

test("rejects a commit without changes and a discarded draft", async () => {
	const harness = await createHarness();
	const draft = await openDraft(harness);
	const empty = await harness.commit(draft.id);
	expect(empty.status).toBe(400);
	expect(((await empty.json()) as any).error).toBe(
		"Working Draft has no changes"
	);
	expect(harness.calls.candidates).toHaveLength(0);

	const discarded = await harness.app.request(
		`${harness.base}/${draft.id}/discard`,
		{ method: "POST" }
	);
	expect(discarded.status).toBe(200);
	expect(((await discarded.json()) as any).status).toBe("discarded");
	expect((await harness.commit(draft.id)).status).toBe(409);
});

test("denies access without a session, for another project, other users and unknown sources", async () => {
	const anonymous = await createHarness(null);
	expect((await anonymous.open()).status).toBe(401);
	expect(anonymous.drafts.size).toBe(0);

	const harness = await createHarness();
	expect((await harness.open(sourceVersionId, otherProjectId)).status).toBe(
		404
	);
	expect((await harness.open(unknownVersionId)).status).toBe(404);
	expect(
		(
			await harness.app.request(`${harness.base}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sourceAssetVersionId: "not-a-uuid" }),
			})
		).status
	).toBe(400);

	const draft = await openDraft(harness);
	const stranger = harness.drafts.get(draft.id);
	if (stranger) {
		stranger.ownerUserId = otherUserId;
	}
	expect((await harness.read(draft.id)).status).toBe(404);
	expect((await harness.commit(draft.id)).status).toBe(404);
	expect((await harness.undo(draft.id, 0)).status).toBe(404);
});

test("rejects stale revisions and invalid operations without changing the draft", async () => {
	const harness = await createHarness();
	const draft = await openDraft(harness);
	const pen = {
		type: "pen",
		color: green,
		size: 1,
		points: [{ x: 0, y: 0 }],
	};
	await harness.apply(draft.id, 0, pen);

	const stale = await harness.apply(draft.id, 0, pen);
	expect(stale.status).toBe(409);
	expect(((await stale.json()) as any).error).toBe(
		"Working Draft revision conflict"
	);

	const cropOutside = await harness.apply(draft.id, 1, {
		type: "crop",
		rect: { x: 3, y: 3, width: 4, height: 4 },
	});
	expect(cropOutside.status).toBe(422);
	const nonSquareRotate = await harness.apply(draft.id, 1, {
		type: "rotate-90",
		direction: "clockwise",
		rect: { x: 0, y: 0, width: 3, height: 2 },
	});
	expect(nonSquareRotate.status).toBe(422);
	const scale = { type: "scale", factor: 16 };
	expect((await harness.apply(draft.id, 1, scale)).status).toBe(200);
	expect((await harness.apply(draft.id, 2, scale)).status).toBe(200);
	// 4 -> 64 -> 1024 -> 16384 pixels wide exceeds the 2048 limit.
	const tooLarge = await harness.apply(draft.id, 3, {
		type: "scale",
		factor: 16,
	});
	expect(tooLarge.status).toBe(422);
	expect(harness.drafts.get(draft.id)?.operations).toHaveLength(3);
});

test("does not offer layers, free-angle rotation, smoothing or other out-of-scope tools", async () => {
	const harness = await createHarness();
	const draft = await openDraft(harness);
	const outOfScope: unknown[] = [
		{ type: "layer-merge", layers: [1, 2] },
		{ type: "rotate", degrees: 17 },
		{ type: "scale", factor: 1.5 },
		{ type: "scale", factor: 2, smoothing: "bilinear" },
		{ type: "smooth", radius: 2 },
		{ type: "skeleton-animate", bones: [] },
		{ type: "brush", color: green, points: [{ x: 0, y: 0 }] },
		{ type: "pen", color: "#00ff00", size: 1, points: [{ x: 0, y: 0 }] },
	];
	const results = await Promise.all(
		outOfScope.map(async (operation) => {
			const response = await harness.apply(draft.id, 0, operation);
			return {
				status: response.status,
				error: ((await response.json()) as { error: string }).error,
			};
		})
	);
	expect(results).toEqual(
		outOfScope.map(() => ({ status: 400, error: "Invalid pixel operation" }))
	);
	expect(harness.drafts.get(draft.id)?.revision).toBe(0);
});
