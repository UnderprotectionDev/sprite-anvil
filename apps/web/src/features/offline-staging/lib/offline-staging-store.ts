import Dexie, { type Table } from "dexie";

/** Largest PNG accepted into Offline Staged Work (browser storage is quota-bound). */
export const maxStagedFileBytes = 10 * 1024 * 1024;

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface StagedProjectRow {
	cachedAt: number;
	project: unknown;
	projectId: string;
}

export interface StagedFileRow {
	data: Blob;
	id: string;
	name: string;
	projectId: string;
	size: number;
	stagedAt: number;
	type: "image/png";
}

/** The cloud record a Working Draft started from; pinned when it is staged. */
export interface StagedDraftBase {
	revision: number;
	sourceAssetVersionId: string;
}

export interface StageableDraft {
	id: string;
	projectId: string;
	revision: number;
	sourceAssetVersionId: string;
	[field: string]: unknown;
}

export interface StagedDraftRow {
	base: StagedDraftBase;
	draft: StageableDraft;
	id: string;
	projectId: string;
	stagedAt: number;
}

export interface OfflineStagingTable<Row> {
	delete: (key: string) => Promise<unknown>;
	get: (key: string) => Promise<Row | undefined>;
	listByProject: (projectId: string) => Promise<Row[]>;
	put: (row: Row) => Promise<unknown>;
}

export type StageFileResult =
	| { ok: true; file: StagedFileRow }
	| { ok: false; reason: "not-png" | "too-large" };

export interface OfflineStagingStore {
	cacheProject: (
		projectId: string,
		project: unknown,
		now?: number
	) => Promise<void>;
	listStagedDrafts: (projectId: string) => Promise<StagedDraftRow[]>;
	listStagedFiles: (projectId: string) => Promise<StagedFileRow[]>;
	readCachedProject: (projectId: string) => Promise<StagedProjectRow | null>;
	removeStagedDraft: (id: string) => Promise<void>;
	removeStagedFile: (id: string) => Promise<void>;
	stageFile: (
		projectId: string,
		input: { data: Blob; name: string },
		options?: { id?: string; now?: number }
	) => Promise<StageFileResult>;
	stageWorkingDraft: (draft: StageableDraft, now?: number) => Promise<void>;
}

async function hasPngSignature(data: Blob) {
	const header = new Uint8Array(await data.slice(0, 8).arrayBuffer());
	return pngSignature.every((byte, index) => header[index] === byte);
}

function newestFirst<Row extends { stagedAt: number }>(rows: Row[]) {
	return [...rows].sort((a, b) => b.stagedAt - a.stagedAt);
}

/**
 * Browser-only Offline Staged Work. Nothing here is authoritative: rows carry
 * no approval, Context activation or export state, only what the user staged.
 */
export function createOfflineStagingStore({
	projects,
	files,
	drafts,
}: {
	drafts: OfflineStagingTable<StagedDraftRow>;
	files: OfflineStagingTable<StagedFileRow>;
	projects: OfflineStagingTable<StagedProjectRow>;
}): OfflineStagingStore {
	return {
		async cacheProject(projectId, project, now = Date.now()) {
			await projects.put({ projectId, project, cachedAt: now });
		},
		async readCachedProject(projectId) {
			return (await projects.get(projectId)) ?? null;
		},
		async stageFile(projectId, input, options = {}) {
			if (input.data.size > maxStagedFileBytes) {
				return { ok: false, reason: "too-large" };
			}
			if (!(await hasPngSignature(input.data))) {
				return { ok: false, reason: "not-png" };
			}
			const file: StagedFileRow = {
				id: options.id ?? crypto.randomUUID(),
				projectId,
				name: input.name,
				type: "image/png",
				size: input.data.size,
				data: input.data,
				stagedAt: options.now ?? Date.now(),
			};
			await files.put(file);
			return { ok: true, file };
		},
		async listStagedFiles(projectId) {
			return newestFirst(await files.listByProject(projectId));
		},
		async removeStagedFile(id) {
			await files.delete(id);
		},
		async stageWorkingDraft(draft, now = Date.now()) {
			const existing = await drafts.get(draft.id);
			await drafts.put({
				id: draft.id,
				projectId: draft.projectId,
				// The base is pinned once: later saves update the draft, not its base.
				base: existing?.base ?? {
					revision: draft.revision,
					sourceAssetVersionId: draft.sourceAssetVersionId,
				},
				draft,
				stagedAt: existing?.stagedAt ?? now,
			});
		},
		async listStagedDrafts(projectId) {
			return newestFirst(await drafts.listByProject(projectId));
		},
		async removeStagedDraft(id) {
			await drafts.delete(id);
		},
	};
}

function dexieTable<Row extends { projectId: string }>(
	table: Table<Row, string>
): OfflineStagingTable<Row> {
	return {
		get: (key) => table.get(key),
		put: (row) => table.put(row),
		delete: (key) => table.delete(key),
		listByProject: (projectId) =>
			table.where("projectId").equals(projectId).toArray(),
	};
}

let defaultStore: OfflineStagingStore | undefined;

export function getDefaultOfflineStagingStore(): OfflineStagingStore {
	if (!defaultStore) {
		const database = new Dexie("sprite-anvil-offline-staging") as Dexie & {
			drafts: Table<StagedDraftRow, string>;
			files: Table<StagedFileRow, string>;
			projects: Table<StagedProjectRow, string>;
		};
		database.version(1).stores({
			projects: "projectId",
			files: "id, projectId",
			drafts: "id, projectId",
		});
		defaultStore = createOfflineStagingStore({
			projects: dexieTable(database.projects),
			files: dexieTable(database.files),
			drafts: dexieTable(database.drafts),
		});
	}
	return defaultStore;
}
