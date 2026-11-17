import type { Database } from "@sprite-anvil/db";
import { backgroundOperations } from "@sprite-anvil/db/schema/background-operations";
import { managedObjectReservations } from "@sprite-anvil/db/schema/managed-object-reservations";
import { projectArchiveImportRequests } from "@sprite-anvil/db/schema/project-archives";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

/** Only an acknowledged write for an existing terminal import can be reclaimed. */
export function createDatabaseManagedObjectCleanupCandidates(db: Database) {
	return async () => {
		const rows = await db
			.select({ key: managedObjectReservations.objectKey })
			.from(managedObjectReservations)
			.innerJoin(
				projectArchiveImportRequests,
				and(
					eq(
						projectArchiveImportRequests.id,
						managedObjectReservations.operationId
					),
					eq(
						projectArchiveImportRequests.projectId,
						managedObjectReservations.projectId
					),
					eq(
						projectArchiveImportRequests.requestedByUserId,
						managedObjectReservations.ownerUserId
					)
				)
			)
			.innerJoin(
				backgroundOperations,
				and(
					eq(
						backgroundOperations.scopeTargetId,
						projectArchiveImportRequests.id
					),
					eq(
						backgroundOperations.projectId,
						projectArchiveImportRequests.projectId
					),
					eq(
						backgroundOperations.triggeredByUserId,
						projectArchiveImportRequests.requestedByUserId
					),
					eq(backgroundOperations.kind, "restore")
				)
			)
			.where(
				and(
					isNotNull(managedObjectReservations.writeSettledAt),
					inArray(managedObjectReservations.purpose, [
						"archive_import_zip",
						"archive_import_file",
					]),
					inArray(backgroundOperations.status, [
						"completed",
						"failed",
						"cancelled",
					])
				)
			);
		return rows.map((row) => row.key);
	};
}
