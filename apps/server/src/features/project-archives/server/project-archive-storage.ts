import type { ProjectArchiveFileEntry } from "@sprite-anvil/api/project-archives";

export interface StoredProjectArchive {
	createdAt: Date;
	createdByUserId: string;
	id: string;
	manifestDigest: string;
	projectId: string;
	/** Digest of the create request, so a repeated key with other content is a conflict. */
	requestDigest: string;
	schemaVersion: string;
}

export interface StoredProjectArchiveSection {
	digest: string;
	group: string;
	name: string;
	recordCount: number;
	records: unknown[];
}

export interface StoredProjectArchiveFile extends ProjectArchiveFileEntry {
	/** Where an included file is read from; null for an excluded file. */
	sourceObjectKey: string | null;
}

export interface StoredProjectArchiveRecord {
	archive: StoredProjectArchive;
	files: StoredProjectArchiveFile[];
	sections: StoredProjectArchiveSection[];
}

export type InsertProjectArchiveResult =
	| { status: "inserted" }
	/** The archive id already exists, or its rows could not be written together. */
	| { status: "conflict" };

/** The persistent side of Project Archives. Archives and their rows are only ever inserted. */
export interface ProjectArchiveStorage {
	find: (
		projectId: string,
		archiveId: string
	) => Promise<StoredProjectArchiveRecord | null>;
	/** Writes the archive, all of its sections and all of its files in one transaction, or none of them. */
	insert: (
		record: StoredProjectArchiveRecord
	) => Promise<InsertProjectArchiveResult>;
	/** Oldest first. */
	list: (projectId: string) => Promise<StoredProjectArchive[]>;
}

export interface StoredProjectArchiveRequest {
	createdAt: Date;
	id: string;
	idempotencyKey: string;
	projectId: string;
	requestDigest: string;
	requestedByUserId: string;
	workingFileIds: string[];
}

/** The persistent side of archive requests a Background Operation runs later. Requests are only ever inserted. */
export interface ProjectArchiveRequestStorage {
	find: (
		projectId: string,
		requestId: string
	) => Promise<StoredProjectArchiveRequest | null>;
	/** `existing` carries the row already stored under this id. */
	insert: (
		request: StoredProjectArchiveRequest
	) => Promise<
		| { status: "inserted" }
		| { existing: StoredProjectArchiveRequest; status: "existing" }
	>;
}
