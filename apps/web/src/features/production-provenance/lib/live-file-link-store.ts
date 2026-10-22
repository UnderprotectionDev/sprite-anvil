import Dexie, { type EntityTable } from "dexie";

export interface StoredLiveFileLink {
	modifiedAt: number | null;
	path: string;
	size: number;
}

export interface LiveFileLinkRow {
	key: string;
	link: StoredLiveFileLink;
}

export interface LiveFileLinkStore {
	read: (
		projectId: string,
		assetRecordId: string
	) => Promise<StoredLiveFileLink | null>;
	write: (
		projectId: string,
		assetRecordId: string,
		link: StoredLiveFileLink
	) => Promise<void>;
}

interface LiveFileLinkTable {
	get: (key: string) => Promise<LiveFileLinkRow | undefined>;
	put: (row: LiveFileLinkRow) => Promise<unknown>;
}

interface LegacyLinkStorage {
	getItem: (key: string) => string | null;
	removeItem: (key: string) => void;
}

export function legacyLinkStorageKey(projectId: string, assetRecordId: string) {
	return `sprite-anvil.live-file-link:${projectId}:${assetRecordId}`;
}

function linkKey(projectId: string, assetRecordId: string) {
	return `${projectId}:${assetRecordId}`;
}

export function parseStoredLink(value: unknown): StoredLiveFileLink | null {
	if (
		value &&
		typeof value === "object" &&
		"path" in value &&
		typeof value.path === "string" &&
		"size" in value &&
		typeof value.size === "number" &&
		Number.isSafeInteger(value.size) &&
		value.size > 0 &&
		"modifiedAt" in value &&
		(value.modifiedAt === null ||
			(typeof value.modifiedAt === "number" &&
				Number.isSafeInteger(value.modifiedAt) &&
				value.modifiedAt >= 0))
	) {
		return {
			path: value.path,
			size: value.size,
			modifiedAt: value.modifiedAt,
		};
	}
	return null;
}

function readLegacyLink(
	legacyStorage: LegacyLinkStorage | undefined,
	key: string
) {
	try {
		const raw = legacyStorage?.getItem(key);
		return raw ? parseStoredLink(JSON.parse(raw)) : null;
	} catch {
		return null;
	}
}

function removeLegacyLink(
	legacyStorage: LegacyLinkStorage | undefined,
	key: string
) {
	try {
		legacyStorage?.removeItem(key);
	} catch {
		// Blocked storage keeps nothing worth cleaning up.
	}
}

export function createLiveFileLinkStore({
	legacyStorage,
	table,
}: {
	legacyStorage?: LegacyLinkStorage;
	table: LiveFileLinkTable;
}): LiveFileLinkStore {
	return {
		async read(projectId, assetRecordId) {
			const key = linkKey(projectId, assetRecordId);
			const row = await table.get(key);
			const stored = row ? parseStoredLink(row.link) : null;
			if (stored) {
				return stored;
			}
			const legacyKey = legacyLinkStorageKey(projectId, assetRecordId);
			const legacyLink = readLegacyLink(legacyStorage, legacyKey);
			if (legacyLink) {
				await table.put({ key, link: legacyLink });
				removeLegacyLink(legacyStorage, legacyKey);
			}
			return legacyLink;
		},
		async write(projectId, assetRecordId, link) {
			await table.put({ key: linkKey(projectId, assetRecordId), link });
			removeLegacyLink(
				legacyStorage,
				legacyLinkStorageKey(projectId, assetRecordId)
			);
		},
	};
}

let defaultStore: LiveFileLinkStore | undefined;

export function getDefaultLiveFileLinkStore(): LiveFileLinkStore {
	if (!defaultStore) {
		const database = new Dexie("sprite-anvil-live-file-links") as Dexie & {
			links: EntityTable<LiveFileLinkRow, "key">;
		};
		database.version(1).stores({ links: "key" });
		defaultStore = createLiveFileLinkStore({
			table: database.links,
			legacyStorage:
				typeof window === "undefined" ? undefined : window.localStorage,
		});
	}
	return defaultStore;
}
