import type { Database } from "@sprite-anvil/db";
import { hasErrorCode } from "@sprite-anvil/db/error-codes";
import type { InteractiveDatabase } from "@sprite-anvil/db/interactive-database";
import {
	exportProfileRevisions,
	exportProfiles,
} from "@sprite-anvil/db/schema/export-profiles";
import { and, asc, eq, sql } from "drizzle-orm";
import type {
	ExportProfileStorage,
	StoredExportProfile,
	StoredExportProfileRevision,
} from "./export-profile-storage";

const uniqueViolationCode = "23505";

function toRevision(
	row: typeof exportProfileRevisions.$inferSelect
): StoredExportProfileRevision {
	return {
		contentDigest: row.contentDigest,
		contractVersion: row.contractVersion,
		createdAt: row.createdAt,
		createdByUserId: row.createdByUserId,
		definition: row.definition,
		id: row.id,
		profileId: row.profileId,
		projectId: row.projectId,
		revisionNumber: row.revisionNumber,
	};
}

export function createDatabaseExportProfileStorage(
	db: Pick<Database, "select">,
	interactiveDb: InteractiveDatabase
): ExportProfileStorage {
	return {
		async findProfile(projectId, profileId) {
			const [row] = await db
				.select({
					createdByUserId: exportProfiles.createdByUserId,
					id: exportProfiles.id,
					name: exportProfiles.name,
					projectId: exportProfiles.projectId,
				})
				.from(exportProfiles)
				.where(
					and(
						eq(exportProfiles.projectId, projectId),
						eq(exportProfiles.id, profileId)
					)
				);
			return row ?? null;
		},
		async findRevision(projectId, revisionId) {
			const [row] = await db
				.select()
				.from(exportProfileRevisions)
				.where(
					and(
						eq(exportProfileRevisions.projectId, projectId),
						eq(exportProfileRevisions.id, revisionId)
					)
				);
			return row ? toRevision(row) : null;
		},
		async insertRevision(profile, revision) {
			try {
				return await interactiveDb.transaction(async (tx) => {
					const inserted = await tx
						.insert(exportProfiles)
						.values(profile)
						.onConflictDoNothing()
						.returning({ id: exportProfiles.id });
					if (inserted.length === 0) {
						const [owner] = await tx
							.select({ projectId: exportProfiles.projectId })
							.from(exportProfiles)
							.where(eq(exportProfiles.id, profile.id));
						if (owner?.projectId !== profile.projectId) {
							return { status: "profile_in_other_project" } as const;
						}
					}
					const [stored] = await tx
						.insert(exportProfileRevisions)
						.values({
							...revision,
							revisionNumber: sql`(select coalesce(max(${exportProfileRevisions.revisionNumber}), 0) + 1 from ${exportProfileRevisions} where ${exportProfileRevisions.profileId} = ${revision.profileId})`,
						})
						.returning();
					if (!stored) {
						throw new Error("The Export Profile revision was not stored.");
					}
					return { revision: toRevision(stored), status: "inserted" } as const;
				});
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		async listProfiles(projectId): Promise<StoredExportProfile[]> {
			return await db
				.select({
					createdByUserId: exportProfiles.createdByUserId,
					id: exportProfiles.id,
					name: exportProfiles.name,
					projectId: exportProfiles.projectId,
				})
				.from(exportProfiles)
				.where(eq(exportProfiles.projectId, projectId))
				.orderBy(asc(exportProfiles.createdAt), asc(exportProfiles.id));
		},
		async listRevisions(projectId) {
			const rows = await db
				.select()
				.from(exportProfileRevisions)
				.where(eq(exportProfileRevisions.projectId, projectId))
				.orderBy(
					asc(exportProfileRevisions.profileId),
					asc(exportProfileRevisions.revisionNumber)
				);
			return rows.map(toRevision);
		},
	};
}
