import type { Database } from "@sprite-anvil/db";
import { project } from "@sprite-anvil/db/schema/project";
import { and, eq } from "drizzle-orm";
import type { ProjectRecord } from "./project-routes";

export async function findOwnedProject(
	database: Database,
	projectId: string,
	ownerUserId: string
): Promise<ProjectRecord | null> {
	const [record] = await database
		.select({
			id: project.id,
			ownerUserId: project.ownerUserId,
			name: project.name,
			previewKey: project.previewKey,
		})
		.from(project)
		.where(and(eq(project.id, projectId), eq(project.ownerUserId, ownerUserId)))
		.limit(1);
	return record ?? null;
}
