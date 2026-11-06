import { expect, test } from "vitest";
import {
	createOfflineStagingStore,
	maxStagedFileBytes,
	type OfflineStagingTable,
	type StagedDraftRow,
	type StagedFileRow,
	type StagedProjectRow,
} from "./offline-staging-store";

function fakeTable<Row extends { projectId: string }>(
	keyOf: (row: Row) => string
): OfflineStagingTable<Row> {
	const rows = new Map<string, Row>();
	return {
		get: (key) => Promise.resolve(rows.get(key)),
		put: (row) => {
			rows.set(keyOf(row), row);
			return Promise.resolve(keyOf(row));
		},
		delete: (key) => {
			rows.delete(key);
			return Promise.resolve();
		},
		listByProject: (owner) =>
			Promise.resolve(
				[...rows.values()].filter((row) => row.projectId === owner)
			),
	};
}

// A new store over the same tables stands in for a page reload.
function createTables() {
	return {
		projects: fakeTable<StagedProjectRow>((row) => row.projectId),
		files: fakeTable<StagedFileRow>((row) => row.id),
		drafts: fakeTable<StagedDraftRow>((row) => row.id),
	};
}

const projectId = "project-moonlit-vale";
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const pngBlob = (extra = 4) =>
	new Blob([new Uint8Array([...pngSignature, ...new Array(extra).fill(1)])], {
		type: "image/png",
	});

const sourceAssetVersionId = "11111111-1111-4111-8111-111111111111";
const draft = {
	id: "22222222-2222-4222-8222-222222222222",
	projectId,
	assetRecordId: "record-ash-knight",
	sourceAssetVersionId,
	revision: 3,
	operations: [{ kind: "example" }],
};

test("a cached project reads back after a reload and stays project scoped", async () => {
	const tables = createTables();
	await createOfflineStagingStore(tables).cacheProject(
		projectId,
		{ id: projectId, name: "Moonlit Vale" },
		1000
	);

	const reloaded = createOfflineStagingStore(tables);
	expect(await reloaded.readCachedProject(projectId)).toEqual({
		projectId,
		project: { id: projectId, name: "Moonlit Vale" },
		cachedAt: 1000,
	});
	expect(await reloaded.readCachedProject("other-project")).toBeNull();
});

test("a staged PNG file reads back with its bytes and waits for the Import Inbox", async () => {
	const tables = createTables();
	const staged = await createOfflineStagingStore(tables).stageFile(
		projectId,
		{ name: "ash-knight.png", data: pngBlob() },
		{ id: "file-1", now: 2000 }
	);
	expect(staged).toMatchObject({ ok: true });

	const reloaded = createOfflineStagingStore(tables);
	const [file] = await reloaded.listStagedFiles(projectId);
	expect(file).toMatchObject({
		id: "file-1",
		projectId,
		name: "ash-knight.png",
		type: "image/png",
		size: 12,
		stagedAt: 2000,
	});
	expect(new Uint8Array(await file.data.arrayBuffer())).toHaveLength(12);
	expect(await reloaded.listStagedFiles("other-project")).toEqual([]);
});

test("a file that is not a PNG or is too large is refused and nothing is stored", async () => {
	const tables = createTables();
	const store = createOfflineStagingStore(tables);
	const notPng = await store.stageFile(projectId, {
		name: "notes.png",
		data: new Blob(["not an image"], { type: "image/png" }),
	});
	const tooLarge = await store.stageFile(projectId, {
		name: "huge.png",
		data: pngBlob(maxStagedFileBytes),
	});
	expect(notPng).toEqual({ ok: false, reason: "not-png" });
	expect(tooLarge).toEqual({ ok: false, reason: "too-large" });
	expect(await store.listStagedFiles(projectId)).toEqual([]);
});

test("a staged file is removed only when asked", async () => {
	const tables = createTables();
	const store = createOfflineStagingStore(tables);
	await store.stageFile(
		projectId,
		{ name: "a.png", data: pngBlob() },
		{ id: "file-1" }
	);
	expect(await store.listStagedFiles(projectId)).toHaveLength(1);
	await store.removeStagedFile("file-1");
	expect(await store.listStagedFiles(projectId)).toEqual([]);
});

test("a staged Working Draft pins its base revision and source Asset Version and reads back", async () => {
	const tables = createTables();
	await createOfflineStagingStore(tables).stageWorkingDraft(draft, 3000);

	const [staged] =
		await createOfflineStagingStore(tables).listStagedDrafts(projectId);
	expect(staged).toEqual({
		id: draft.id,
		projectId,
		base: { revision: 3, sourceAssetVersionId },
		draft,
		stagedAt: 3000,
	});
});

test("staging the same Working Draft again keeps the first pinned base", async () => {
	const tables = createTables();
	const store = createOfflineStagingStore(tables);
	await store.stageWorkingDraft(draft, 3000);
	await store.stageWorkingDraft({ ...draft, revision: 5 }, 4000);

	const [staged] = await store.listStagedDrafts(projectId);
	expect(staged.base.revision).toBe(3);
	expect(staged.draft.revision).toBe(5);
	expect(staged.stagedAt).toBe(3000);
});

test("staged work carries no approval, activation or export marker", async () => {
	const tables = createTables();
	const store = createOfflineStagingStore(tables);
	await store.stageWorkingDraft(draft, 1);
	const [staged] = await store.listStagedDrafts(projectId);
	expect(Object.keys(staged).sort()).toEqual(
		["base", "draft", "id", "projectId", "stagedAt"].sort()
	);
});
