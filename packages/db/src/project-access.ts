import { and, eq, sql } from "drizzle-orm";

import type { Database } from "./index";
import { project } from "./schema/project";
import { projectArchiveRestores } from "./schema/project-archives";

/** A restored Project is published only after canonical readback succeeds. */
export function publishedProjectPredicate() {
	return sql`not exists (select 1 from ${projectArchiveRestores} where ${projectArchiveRestores.restoredProjectId} = ${project.id} and ${projectArchiveRestores.canonicalVerified} = false)`;
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
