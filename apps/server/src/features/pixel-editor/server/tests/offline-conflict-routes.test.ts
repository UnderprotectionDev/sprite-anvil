// biome-ignore-all lint/performance/noAwaitInLoops: each request depends on the previous response
import { expect, test } from "bun:test";
import {
	createHarness,
	otherProjectId,
	projectId,
	readPixels,
	red,
	sourceVersionId,
} from "./pixel-editor-harness";

type Harness = Awaited<ReturnType<typeof createHarness>>;
type Json = Record<string, any>;

const green = "#00ff00ff";
const blue = "#0000ffff";

const penGreen = (x: number, y: number) => ({
	type: "pen",
	color: green,
	size: 1,
	points: [{ x, y }],
});
const penBlue = (x: number, y: number) => ({
	type: "pen",
	color: blue,
	size: 1,
	points: [{ x, y }],
});

/** A Working Draft staged offline: what the browser keeps, pinned to its base. */
async function stageDraft(harness: Harness) {
	const opened = (await (await harness.open()).json()) as Json;
	const edited = (await (
		await harness.apply(opened.id, opened.revision, penGreen(0, 0))
	).json()) as Json;
	return {
		draftId: edited.id as string,
		base: {
			revision: edited.revision as number,
			sourceAssetVersionId: edited.sourceAssetVersionId as string,
		},
		local: {
			operations: edited.operations as unknown[],
			appliedOperationCount: edited.appliedOperationCount as number,
		},
	};
}

function post(harness: Harness, path: string, body: unknown) {
	return harness.app.request(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function reconcile(harness: Harness, staged: Json, extra: Json = {}) {
	return post(harness, `${harness.conflictBase}/reconcile`, {
		contractVersion: "offline-conflict/1.0.0",
		...staged,
		...extra,
	});
}

const keyA = "6f0f4c52-6c0f-4f0e-9d3c-000000000001";
const keyB = "6f0f4c52-6c0f-4f0e-9d3c-000000000002";

function resolve(harness: Harness, id: string, body: Json) {
	return post(harness, `${harness.conflictBase}/${id}/resolve`, body);
}

/** Staged draft with one more local edit, then the cloud draft advances: a conflict exists. */
async function openConflict(harness: Harness) {
	const staged = await stageDraft(harness);
	await harness.apply(staged.draftId, staged.base.revision, penGreen(3, 0));
	const response = await reconcile(harness, {
		...staged,
		local: {
			operations: [...staged.local.operations, penBlue(1, 1)],
			appliedOperationCount: staged.local.appliedOperationCount + 1,
		},
	});
	return { staged, response, conflict: (await response.json()) as Json };
}

test("a still-current base goes to normal finalization with no conflict record", async () => {
	const harness = await createHarness();
	const staged = await stageDraft(harness);
	const response = await reconcile(harness, staged);
	const body = (await response.json()) as Json;

	expect(response.status).toBe(200);
	expect(body).toEqual({
		outcome: "base-current",
		draft: {
			id: staged.draftId,
			revision: staged.base.revision,
			sourceAssetVersionId: sourceVersionId,
		},
	});
	expect(harness.conflicts.size).toBe(0);
	const committed = await harness.commit(staged.draftId, staged.base.revision);
	expect(committed.status).toBe(201);
});

test("a cloud draft that advanced opens a three-version record and the cloud stays authoritative", async () => {
	const harness = await createHarness();
	const { staged, response, conflict } = await openConflict(harness);

	expect(response.status).toBe(201);
	expect(conflict.outcome).toBe("conflict");
	const record = conflict.conflict as Json;
	expect(record).toMatchObject({
		draftId: staged.draftId,
		contractVersion: "offline-conflict/1.0.0",
		base: {
			revision: staged.base.revision,
			sourceAssetVersionId: sourceVersionId,
		},
		cloud: { revision: staged.base.revision + 1, status: "open" },
		resolution: null,
	});
	expect(record.cloud.operations).toHaveLength(2);
	expect(record.local.operations).toHaveLength(2);
	expect(record.local.operations[1]).toEqual(penBlue(1, 1));

	// Persisted, then re-read from the record.
	const reread = await harness.app.request(
		`${harness.conflictBase}/${record.id}`
	);
	expect(reread.status).toBe(200);
	expect(await reread.json()).toEqual(record);

	// Nothing merged or overwritten in the cloud draft.
	const cloud = harness.drafts.get(staged.draftId);
	expect(cloud?.revision).toBe(staged.base.revision + 1);
	expect(cloud?.operations).toHaveLength(2);
	expect(cloud?.status).toBe("open");

	// Repeating the reconnect check reuses the same record.
	const again = await reconcile(harness, { ...staged, local: record.local });
	expect(again.status).toBe(200);
	expect(((await again.json()) as Json).conflict.id).toBe(record.id);
	expect(harness.conflicts.size).toBe(1);
});

test("a local draft that differs from an unchanged cloud draft is a conflict, never a silent discard", async () => {
	const harness = await createHarness();
	const staged = await stageDraft(harness);
	const response = await reconcile(harness, {
		...staged,
		local: {
			operations: [...staged.local.operations, penBlue(2, 2)],
			appliedOperationCount: 2,
		},
	});
	expect(response.status).toBe(201);
	expect(((await response.json()) as Json).outcome).toBe("conflict");
});

test("the reconnect check refuses bad input, other projects and missing drafts", async () => {
	const harness = await createHarness();
	const staged = await stageDraft(harness);

	expect((await reconcile(harness, { local: "nope" })).status).toBe(400);
	expect((await reconcile(harness, { draftId: "not-a-uuid" })).status).toBe(
		400
	);
	expect(
		(
			await reconcile(harness, {
				local: { operations: [{ type: "bogus" }], appliedOperationCount: 1 },
			})
		).status
	).toBe(400);
	const unknown = await reconcile(harness, {
		...staged,
		draftId: "b17f5ff0-a50d-438f-8bf2-a0152b42c3aa",
	});
	expect(unknown.status).toBe(404);
	const otherProject = await post(
		harness,
		`${harness.conflictBase.replace(projectId, otherProjectId)}/reconcile`,
		{ contractVersion: "offline-conflict/1.0.0", ...staged }
	);
	expect(otherProject.status).toBe(404);
	expect(harness.conflicts.size).toBe(0);

	const signedOut = await createHarness(null);
	expect((await reconcile(signedOut, staged)).status).toBe(401);
});

test("a request from an unsupported contract major is stopped with a descriptive error", async () => {
	const harness = await createHarness();
	const staged = await stageDraft(harness);
	const response = await reconcile(harness, staged, {
		contractVersion: "offline-conflict/2.0.0",
	});
	const body = (await response.json()) as Json;
	expect(response.status).toBe(422);
	expect(body.error).toBe("Offline Conflict Record contract unsupported");
	expect(body.detail).toContain("offline-conflict/2.0.0");
	expect(harness.conflicts.size).toBe(0);
});

test("creating a Candidate Version from the local draft is separate, idempotent and leaves the cloud alone", async () => {
	const harness = await createHarness();
	const { staged, conflict } = await openConflict(harness);
	const id = conflict.conflict.id as string;
	const cloudBefore = structuredClone(harness.drafts.get(staged.draftId));

	const first = await resolve(harness, id, {
		idempotencyKey: keyA,
		choice: "create-candidate",
	});
	const created = (await first.json()) as Json;
	expect(first.status).toBe(201);
	expect(created.created).toBe(true);
	expect(created.conflict.resolution).toMatchObject({
		choice: "create-candidate",
		resolvedByUserId: "pixel-editor-user",
		idempotencyKey: keyA,
	});
	const candidateId = created.conflict.resolution
		.resultAssetVersionId as string;
	expect(candidateId).toBeString();
	expect(harness.calls.candidates).toHaveLength(1);

	// The candidate is the local draft rendered over the pinned base: green (0,0), blue (1,1).
	const stored = [...harness.objects.entries()].find(([key]) =>
		key.endsWith(candidateId)
	);
	const pixels = await readPixels(stored?.[1] as Uint8Array);
	expect(pixels.pixel(0, 0)).toBe(green);
	expect(pixels.pixel(1, 1)).toBe(blue);
	expect(pixels.pixel(3, 0)).toBe(blue);

	// Same key replays the same result and never makes a second Candidate Version.
	const replay = await resolve(harness, id, {
		idempotencyKey: keyA,
		choice: "create-candidate",
	});
	const replayed = (await replay.json()) as Json;
	expect(replay.status).toBe(200);
	expect(replayed.created).toBe(false);
	expect(replayed.conflict.resolution).toEqual(created.conflict.resolution);
	expect(harness.calls.candidates).toHaveLength(1);

	// A different key or choice cannot resolve it a second time.
	const otherKey = await resolve(harness, id, {
		idempotencyKey: keyB,
		choice: "create-candidate",
	});
	expect(otherKey.status).toBe(409);
	expect(((await otherKey.json()) as Json).error).toBe(
		"Offline Conflict Record already resolved"
	);
	const reused = await resolve(harness, id, {
		idempotencyKey: keyA,
		choice: "abandon",
		confirmAbandon: true,
		shownLocalDigest: conflict.conflict.localDigest,
	});
	expect(reused.status).toBe(409);
	expect(((await reused.json()) as Json).error).toBe(
		"Offline Conflict resolution key reused"
	);

	// The cloud draft and the base are untouched.
	expect(harness.drafts.get(staged.draftId)).toEqual(cloudBefore);
	expect(harness.conflicts.size).toBe(1);
});

test("a failed Candidate Version write leaves the record open and a retry with the same key creates one", async () => {
	const harness = await createHarness();
	const { conflict } = await openConflict(harness);
	const id = conflict.conflict.id as string;

	harness.faults.failPut = true;
	const failed = await resolve(harness, id, {
		idempotencyKey: keyA,
		choice: "create-candidate",
	});
	expect(failed.status).toBe(503);
	expect(harness.conflicts.get(id)?.resolution).toBeNull();

	harness.faults.failPut = false;
	const retried = await resolve(harness, id, {
		idempotencyKey: keyA,
		choice: "create-candidate",
	});
	expect(retried.status).toBe(201);
	expect(
		harness.conflicts.get(id)?.resolution?.resultAssetVersionId
	).toBeString();
});

test("keeping the cloud retains the local draft in the record and creates nothing", async () => {
	const harness = await createHarness();
	const { staged, conflict } = await openConflict(harness);
	const id = conflict.conflict.id as string;

	const response = await resolve(harness, id, {
		idempotencyKey: keyA,
		choice: "keep-cloud-retain-draft",
	});
	const body = (await response.json()) as Json;
	expect(response.status).toBe(201);
	expect(body.conflict.resolution).toMatchObject({
		choice: "keep-cloud-retain-draft",
		resultAssetVersionId: null,
	});
	expect(harness.calls.candidates).toHaveLength(0);
	const reread = (await (
		await harness.app.request(`${harness.conflictBase}/${id}`)
	).json()) as Json;
	expect(reread.local).toEqual(conflict.conflict.local);
	expect(harness.drafts.get(staged.draftId)?.revision).toBe(
		staged.base.revision + 1
	);
});

test("abandoning needs shown local content and a separate confirmation", async () => {
	const harness = await createHarness();
	const { conflict } = await openConflict(harness);
	const id = conflict.conflict.id as string;
	const digest = conflict.conflict.localDigest as string;

	for (const extra of [
		{},
		{ confirmAbandon: true },
		{ confirmAbandon: false, shownLocalDigest: digest },
		{ confirmAbandon: true, shownLocalDigest: "stale-digest" },
	]) {
		const refused = await resolve(harness, id, {
			idempotencyKey: keyA,
			choice: "abandon",
			...extra,
		});
		expect(refused.status).toBe(400);
		expect(((await refused.json()) as Json).error).toBe(
			"Abandoning a local Working Draft needs confirmation"
		);
	}
	expect(harness.conflicts.get(id)?.resolution).toBeNull();

	const abandoned = await resolve(harness, id, {
		idempotencyKey: keyA,
		choice: "abandon",
		confirmAbandon: true,
		shownLocalDigest: digest,
	});
	expect(abandoned.status).toBe(201);
	expect(harness.calls.candidates).toHaveLength(0);
	// The immutable record keeps the abandoned content.
	const kept = harness.conflicts.get(id)?.record.content as Json | undefined;
	expect(kept?.local.operations).toHaveLength(2);
});

test("resolution rejects bad input, unknown records and other projects", async () => {
	const harness = await createHarness();
	const { conflict } = await openConflict(harness);
	const id = conflict.conflict.id as string;

	expect((await resolve(harness, id, { choice: "abandon" })).status).toBe(400);
	expect(
		(await resolve(harness, id, { idempotencyKey: "x", choice: "abandon" }))
			.status
	).toBe(400);
	expect(
		(await resolve(harness, id, { idempotencyKey: keyA, choice: "merge" }))
			.status
	).toBe(400);
	expect(
		(
			await resolve(harness, "b17f5ff0-a50d-438f-8bf2-a0152b42c3aa", {
				idempotencyKey: keyA,
				choice: "keep-cloud-retain-draft",
			})
		).status
	).toBe(404);
	const otherProject = await post(
		harness,
		`${harness.conflictBase.replace(projectId, otherProjectId)}/${id}/resolve`,
		{ idempotencyKey: keyA, choice: "keep-cloud-retain-draft" }
	);
	expect(otherProject.status).toBe(404);
	expect(harness.conflicts.get(id)?.resolution).toBeNull();
});

test("an unknown major version or required field stops resolution; compatible optional fields keep the draft", async () => {
	const harness = await createHarness();
	const { conflict } = await openConflict(harness);
	const id = conflict.conflict.id as string;
	const entry = harness.conflicts.get(id);
	if (!entry) {
		throw new Error("missing record");
	}
	const original = entry.record.content as Json;
	const attempt = () =>
		resolve(harness, id, {
			idempotencyKey: keyA,
			choice: "keep-cloud-retain-draft",
		});

	entry.record.content = {
		...original,
		contractVersion: "offline-conflict/2.0.0",
	};
	const major = await attempt();
	expect(major.status).toBe(422);
	expect(((await major.json()) as Json).detail).toContain("2.0.0");

	entry.record.content = { ...original, requires: ["mergeStrategy"] };
	const required = await attempt();
	expect(required.status).toBe(422);
	expect(((await required.json()) as Json).detail).toContain("mergeStrategy");
	expect(
		(await harness.app.request(`${harness.conflictBase}/${id}`)).status
	).toBe(422);
	const list = (await (
		await harness.app.request(harness.conflictBase)
	).json()) as Json;
	expect(list.conflicts).toHaveLength(0);
	expect(list.unreadable[0]).toMatchObject({ id });
	expect(entry.resolution).toBeNull();

	entry.record.content = {
		...original,
		contractVersion: "offline-conflict/1.4.0",
		note: "optional future field",
		local: { ...original.local, label: "future" },
	};
	const compatible = await attempt();
	expect(compatible.status).toBe(201);
	expect((entry.record.content as Json).local.label).toBe("future");
	expect((entry.record.content as Json).note).toBe("optional future field");
});

test("a preview renders each of the three versions", async () => {
	const harness = await createHarness();
	const { conflict } = await openConflict(harness);
	const id = conflict.conflict.id as string;
	const side = async (name: string) =>
		new Uint8Array(
			await (
				await harness.app.request(
					`${harness.conflictBase}/${id}/preview/${name}`
				)
			).arrayBuffer()
		);
	const base = await readPixels(await side("base"));
	const cloud = await readPixels(await side("cloud"));
	const local = await readPixels(await side("local"));
	expect(base.pixel(0, 0)).toBe(red);
	expect(cloud.pixel(0, 0)).toBe(green);
	expect(cloud.pixel(3, 0)).toBe(green);
	expect(local.pixel(1, 1)).toBe(blue);
	expect(
		(await harness.app.request(`${harness.conflictBase}/${id}/preview/nope`))
			.status
	).toBe(404);
});
