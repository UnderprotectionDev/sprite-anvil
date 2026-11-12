import type {
	ProjectArchive,
	ProjectArchiveCatalog,
	ProjectArchiveCreateInput,
	ProjectArchiveRejection,
	ProjectArchiveSource,
} from "./project-archives";

export type ProjectArchiveCreateResult =
	| { archive: ProjectArchive; status: "created" | "replayed" }
	| ({ status: "rejected" } & ProjectArchiveRejection);

/** Reads the persisted records one user's project archive is built from. */
export interface ProjectArchiveSourceReader {
	/** Null when the project is not found. */
	read: (
		userId: string,
		projectId: string
	) => Promise<ProjectArchiveSource | null>;
}

/** Authorized, project-scoped access to immutable Project Archives. */
export interface ProjectArchiveStore {
	/** Atomic and idempotent: the same key never yields a second archive. Null when the project is not found. */
	create: (
		userId: string,
		input: ProjectArchiveCreateInput
	) => Promise<ProjectArchiveCreateResult | null>;
	/** Null when the project or archive is not found. */
	get: (
		userId: string,
		projectId: string,
		archiveId: string
	) => Promise<ProjectArchive | null>;
	/** Null when the project is not found. */
	list: (
		userId: string,
		projectId: string
	) => Promise<ProjectArchiveCatalog | null>;
}
