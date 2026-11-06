import {
	type PixelDraft,
	type PixelOperation,
	pixelEditorMaxOperations,
	pixelOperationSchema,
} from "@sprite-anvil/api/pixel-editor";
import Dexie, { type Table } from "dexie";
import type { CachedProject } from "../schemas";

/** Largest PNG accepted into Offline Staged Work (browser storage is quota-bound). */
export const maxStagedFileBytes = 10 * 1024 * 1024;

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface StagedProjectRow {
	cachedAt: number;
	project: CachedProject;
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

/**
 * The part of a Working Draft that is kept offline: the operations over the
 * pinned source Asset Version. `revision` is the cloud revision it was staged at.
 */
export type StageableDraft = Pick<
	PixelDraft,
	| "appliedOperationCount"
	| "id"
	| "operations"
	| "projectId"
	| "revision"
	| "size"
	| "sourceAssetVersionId"
>;

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

/**
 * `kept-existing`: the staged copy differs in revision or holds local
 * operations, so its base and content stay together and nothing is lost.
 */
export type StageDraftResult = "kept-existing" | "staged";

export type AddStagedOperationResult =
	| "added"
	| "invalid"
	| "limit"
	| "missing";

export interface OfflineStagingStore {
	/** Adds a Working Draft operation, as a local operation over the pinned base. */
	addStagedOperation: (
		id: string,
		operation: PixelOperation
	) => Promise<AddStagedOperationResult>;
	cacheProject: (
		projectId: string,
		project: CachedProject,
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
	stageWorkingDraft: (
		draft: StageableDraft,
		now?: number
	) => Promise<StageDraftResult>;
}

async function hasPngSignature(data: Blob) {
	const header = new Uint8Array(await data.slice(0, 8).arrayBuffer());
	return pngSignature.every((byte, index) => header[index] === byte);
}

/** Only the operations over the base are kept, never the rendered view of the draft. */
function keptFields(draft: StageableDraft): StageableDraft {
	return {
		id: draft.id,
		projectId: draft.projectId,
		revision: draft.revision,
		sourceAssetVersionId: draft.sourceAssetVersionId,
		operations: draft.operations,
		appliedOperationCount: draft.appliedOperationCount,
		size: draft.size,
	};
}

function sameOperations(a: StageableDraft, b: StageableDraft) {
	return (
		a.appliedOperationCount === b.appliedOperationCount &&
		JSON.stringify(a.operations) === JSON.stringify(b.operations)
	);
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
		async addStagedOperation(id, operation) {
			const existing = await drafts.get(id);
			if (!existing) {
				return "missing";
			}
			const parsed = pixelOperationSchema.safeParse(operation);
			if (!parsed.success) {
				return "invalid";
			}
			const { draft } = existing;
			if (draft.appliedOperationCount >= pixelEditorMaxOperations) {
				return "limit";
			}
			// Like the cloud draft, a new operation replaces the undone tail.
			const operations = [
				...draft.operations.slice(0, draft.appliedOperationCount),
				parsed.data,
			];
			await drafts.put({
				...existing,
				draft: {
					...draft,
					operations,
					appliedOperationCount: operations.length,
				},
			});
			return "added";
		},
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
			// A staged draft and its pinned base must describe the same cloud record:
			// a newer cloud revision never overwrites it, or edits would look conflicting.
			// Operations added offline are never replaced by a refreshed copy either.
			if (
				existing &&
				(existing.draft.revision !== draft.revision ||
					!sameOperations(existing.draft, draft))
			) {
				return "kept-existing";
			}
			await drafts.put({
				id: draft.id,
				projectId: draft.projectId,
				base: existing?.base ?? {
					revision: draft.revision,
					sourceAssetVersionId: draft.sourceAssetVersionId,
				},
				draft: keptFields(draft),
				stagedAt: existing?.stagedAt ?? now,
			});
			return "staged";
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
