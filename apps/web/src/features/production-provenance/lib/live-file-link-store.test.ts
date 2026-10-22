import { expect, test } from "vitest";
import {
	createLiveFileLinkStore,
	type LiveFileLinkRow,
	legacyLinkStorageKey,
} from "./live-file-link-store";

const projectId = "project-ash-knight";
const assetRecordId = "record-ash-knight";
const link = {
	modifiedAt: 1000,
	path: "/Users/example/Art/Ash Knight.aseprite",
	size: 4,
};

function createFakes(initialLegacy: Record<string, string> = {}) {
	const rows = new Map<string, LiveFileLinkRow>();
	const legacy = new Map(Object.entries(initialLegacy));
	return {
		rows,
		legacy,
		store: createLiveFileLinkStore({
			table: {
				get: (key) => Promise.resolve(rows.get(key)),
				put: (row) => {
					rows.set(row.key, row);
					return Promise.resolve(row.key);
				},
			},
			legacyStorage: {
				getItem: (key) => legacy.get(key) ?? null,
				removeItem: (key) => {
					legacy.delete(key);
				},
			},
		}),
	};
}

test("a written link reads back for the same project and Asset Record only", async () => {
	const { store } = createFakes();

	await store.write(projectId, assetRecordId, link);

	expect(await store.read(projectId, assetRecordId)).toEqual(link);
	expect(await store.read(projectId, "other-record")).toBeNull();
	expect(await store.read("other-project", assetRecordId)).toBeNull();
});

test("a legacy localStorage link moves into the table once and is removed", async () => {
	const legacyKey = legacyLinkStorageKey(projectId, assetRecordId);
	const { store, rows, legacy } = createFakes({
		[legacyKey]: JSON.stringify(link),
	});

	expect(await store.read(projectId, assetRecordId)).toEqual(link);
	expect(rows.size).toBe(1);
	expect(legacy.has(legacyKey)).toBe(false);
	expect(await store.read(projectId, assetRecordId)).toEqual(link);
});

test("the table link wins over a stale legacy value, which is cleaned up on write", async () => {
	const legacyKey = legacyLinkStorageKey(projectId, assetRecordId);
	const { store, legacy } = createFakes({
		[legacyKey]: JSON.stringify({ ...link, path: "/old/path.aseprite" }),
	});

	await store.write(projectId, assetRecordId, link);

	expect(legacy.has(legacyKey)).toBe(false);
	expect(await store.read(projectId, assetRecordId)).toEqual(link);
});

const invalidLegacyValues = [
	"not json",
	JSON.stringify({ path: "/a", size: 0, modifiedAt: null }),
	JSON.stringify({ path: "/a", size: 1.5, modifiedAt: null }),
	JSON.stringify({ path: 3, size: 1, modifiedAt: null }),
	JSON.stringify({ path: "/a", size: 1, modifiedAt: -1 }),
	"null",
];

test.each(invalidLegacyValues)(
	"invalid stored link %s reads as no link",
	async (raw) => {
		const { store } = createFakes({
			[legacyLinkStorageKey(projectId, assetRecordId)]: raw,
		});

		expect(await store.read(projectId, assetRecordId)).toBeNull();
	}
);

test("an unavailable legacy storage does not break reads or writes", async () => {
	const rows = new Map<string, LiveFileLinkRow>();
	const store = createLiveFileLinkStore({
		table: {
			get: (key) => Promise.resolve(rows.get(key)),
			put: (row) => {
				rows.set(row.key, row);
				return Promise.resolve(row.key);
			},
		},
		legacyStorage: {
			getItem: () => {
				throw new Error("storage blocked");
			},
			removeItem: () => {
				throw new Error("storage blocked");
			},
		},
	});

	await store.write(projectId, assetRecordId, link);

	expect(await store.read(projectId, assetRecordId)).toEqual(link);
	expect(await store.read(projectId, "other-record")).toBeNull();
});
