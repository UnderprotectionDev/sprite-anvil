import { type Database, getProjectForUser } from "@sprite-anvil/db";

export interface ProjectLookupOptions {
	/** Resolves a project the user owns; defaults to the shared project access lookup. */
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
}

/** The project lookup of a permanent-erasure store: the injected one, or the shared lookup on the given database. */
export function resolveProjectLookup(
	options: ProjectLookupOptions & { db?: Database }
) {
	if (options.getProjectForUser) {
		return options.getProjectForUser;
	}
	const { db } = options;
	if (!db) {
		throw new Error("A database or a project lookup is required.");
	}
	return (userId: string, projectId: string) =>
		getProjectForUser(db, userId, projectId);
}
