import { type Database, getProjectForUser } from "@sprite-anvil/db";

type ProjectLookup = (userId: string, projectId: string) => Promise<unknown>;

/**
 * How a permanent-erasure store finds the project a user owns: either the
 * shared project access lookup on a database, or an injected lookup. Exactly
 * one of the two is given.
 */
export type ProjectLookupOptions =
	| { db: Database; getProjectForUser?: undefined }
	| { db?: undefined; getProjectForUser: ProjectLookup };

/** The project lookup of a permanent-erasure store. */
export function resolveProjectLookup(
	options: ProjectLookupOptions
): ProjectLookup {
	if (options.db) {
		const { db } = options;
		return (userId, projectId) => getProjectForUser(db, userId, projectId);
	}
	return options.getProjectForUser;
}
