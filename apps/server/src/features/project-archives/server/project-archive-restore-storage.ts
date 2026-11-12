import type {
	RestoredFile,
	RestoredSection,
	RestoreIdEntry,
} from "@sprite-anvil/api/project-archive-restore";

export interface StoredProjectArchiveRestore {
	archiveId: string;
	createdAt: Date;
	createdByUserId: string;
	id: string;
	manifestDigest: string;
	/** Digest of the restore request, so a repeated key with other content is a conflict. */
	requestDigest: string;
	restoredProjectId: string;
	sourceProjectId: string;
}

/** A restored file; `objectKey` is where the restored project keeps an included file. */
export interface StoredRestoredFile extends RestoredFile {
	objectKey: string | null;
}

export interface StoredProjectArchiveRestoreRecord {
	files: StoredRestoredFile[];
	ids: RestoreIdEntry[];
	/** The name the independent project was created with. */
	projectName: string;
	restore: StoredProjectArchiveRestore;
	sections: RestoredSection[];
}

export type InsertProjectArchiveRestoreResult =
	| { status: "inserted" }
	/** The restore id or the new project already exists, or its rows could not be written together. */
	| { status: "conflict" };

/** The persistent side of Project Archive restores. Restores and their rows are only ever inserted. */
export interface ProjectArchiveRestoreStorage {
	find: (
		sourceProjectId: string,
		restoreId: string
	) => Promise<StoredProjectArchiveRestoreRecord | null>;
	/**
	 * Creates the independent project (with its restored Project Context
	 * revisions), the id mapping, the restored records and the files in one
	 * transaction, or none of them.
	 */
	insert: (
		record: StoredProjectArchiveRestoreRecord
	) => Promise<InsertProjectArchiveRestoreResult>;
	/** Oldest first. */
	list: (sourceProjectId: string) => Promise<StoredProjectArchiveRestore[]>;
	/** Removes a restore and its new project; only for a restore that failed its own verification. */
	withdraw: (restoreId: string) => Promise<void>;
}

export interface StoredProjectArchiveRestoreRequest {
	archiveId: string;
	createdAt: Date;
	id: string;
	idempotencyKey: string;
	projectId: string;
	projectName: string;
	requestDigest: string;
	requestedByUserId: string;
}

/** The persistent side of restore requests a Background Operation runs later. Requests are only ever inserted. */
export interface ProjectArchiveRestoreRequestStorage {
	find: (
		projectId: string,
		requestId: string
	) => Promise<StoredProjectArchiveRestoreRequest | null>;
	/** `existing` carries the row already stored under this id. */
	insert: (
		request: StoredProjectArchiveRestoreRequest
	) => Promise<
		| { status: "inserted" }
		| { existing: StoredProjectArchiveRestoreRequest; status: "existing" }
	>;
}
