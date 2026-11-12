import type {
	ProjectArchiveRestore,
	ProjectArchiveRestoreCatalog,
	ProjectArchiveRestoreInput,
	ProjectArchiveRestoreRejection,
} from "./project-archive-restore";

export type ProjectArchiveRestoreResult =
	| { restore: ProjectArchiveRestore; status: "created" | "replayed" }
	| ({ status: "rejected" } & ProjectArchiveRestoreRejection);

/** Authorized, project-scoped restore of Project Archives into independent projects. */
export interface ProjectArchiveRestoreStore {
	/** Null when the project or restore is not found. */
	get: (
		userId: string,
		projectId: string,
		restoreId: string
	) => Promise<ProjectArchiveRestore | null>;
	/** Null when the project is not found. */
	list: (
		userId: string,
		projectId: string
	) => Promise<ProjectArchiveRestoreCatalog | null>;
	/**
	 * Verifies the archive, then builds a new independent project in one atomic
	 * step; the same key never yields a second project and the source archive
	 * is never changed. Null when the project or archive is not found.
	 */
	restore: (
		userId: string,
		input: ProjectArchiveRestoreInput
	) => Promise<ProjectArchiveRestoreResult | null>;
}
