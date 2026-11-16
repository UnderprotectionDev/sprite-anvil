import type { Database } from "@sprite-anvil/db";
import { projectArchiveImportRequests } from "@sprite-anvil/db/schema/project-archives";
import { and, eq } from "drizzle-orm";

export type ArchiveImportRequest =
	typeof projectArchiveImportRequests.$inferSelect;
export interface ArchiveImportRequestStorage {
	find: (projectId: string, id: string) => Promise<ArchiveImportRequest | null>;
	insert: (
		request: ArchiveImportRequest
	) => Promise<
		| { status: "inserted" }
		| { status: "existing"; existing: ArchiveImportRequest }
	>;
}
export function createDatabaseArchiveImportRequestStorage(
	db: Database
): ArchiveImportRequestStorage {
	return {
		async find(projectId, id) {
			const [row] = await db
				.select()
				.from(projectArchiveImportRequests)
				.where(
					and(
						eq(projectArchiveImportRequests.projectId, projectId),
						eq(projectArchiveImportRequests.id, id)
					)
				);
			return row ?? null;
		},
		async insert(request) {
			const [inserted] = await db
				.insert(projectArchiveImportRequests)
				.values(request)
				.onConflictDoNothing()
				.returning({ id: projectArchiveImportRequests.id });
			if (inserted) {
				return { status: "inserted" };
			}
			const [existing] = await db
				.select()
				.from(projectArchiveImportRequests)
				.where(eq(projectArchiveImportRequests.id, request.id));
			if (!existing) {
				throw new Error("Project Archive import request could not be read.");
			}
			return { status: "existing", existing };
		},
	};
}
