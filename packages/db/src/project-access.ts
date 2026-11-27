import { and, eq, sql } from "drizzle-orm";

import type { Database } from "./index";
import { backgroundOperations } from "./schema/background-operations";
import { project } from "./schema/project";
import { projectArchiveRestores } from "./schema/project-archives";

export const projectDeletionScopeSummary = "Permanent deletion of Project";
export const projectDeletionRemovingStep = "Removing project content";

/** A restored Project is published only after canonical readback succeeds. */
export function publishedProjectPredicate() {
	return sql`not exists (select 1 from ${projectArchiveRestores} where ${projectArchiveRestores.restoredProjectId} = ${project.id} and ${projectArchiveRestores.canonicalVerified} = false)
		and not exists (select 1 from ${backgroundOperations} where ${backgroundOperations.projectId} = ${project.id} and ${backgroundOperations.kind} = 'deletion' and ${backgroundOperations.scopeSummary} = ${projectDeletionScopeSummary} and (
			${backgroundOperations.status} in ('pending','running','cancel_requested') or (${backgroundOperations.status} = 'failed' and ${backgroundOperations.progressStep} = ${projectDeletionRemovingStep})
		))`;
}

export async function getProjectForUser(
	database: Database,
	userId: string,
	projectId: string
) {
	const [record] = await database
		.select({
			id: project.id,
			name: project.name,
			generalArtDirection: project.generalArtDirection,
			ownerUserId: project.ownerUserId,
			previewKey: project.previewKey,
			createdAt: project.createdAt,
		})
		.from(project)
		.where(
			and(
				eq(project.id, projectId),
				eq(project.ownerUserId, userId),
				publishedProjectPredicate()
			)
		)
		.limit(1);

	return record ?? null;
}
