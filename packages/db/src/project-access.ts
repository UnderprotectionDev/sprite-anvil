import { and, eq } from "drizzle-orm";

import type { Database } from "./index";
import { project } from "./schema/project";

export async function getProjectForUser(
	database: Database,
	userId: string,
	projectId: string
) {
	const [record] = await database
		.select({ id: project.id, name: project.name })
		.from(project)
		.where(and(eq(project.id, projectId), eq(project.ownerId, userId)))
		.limit(1);

	return record ?? null;
}
