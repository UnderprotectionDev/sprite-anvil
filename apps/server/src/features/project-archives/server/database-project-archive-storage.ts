import type { Database } from "@sprite-anvil/db";
import {
	projectArchiveFiles,
	projectArchiveRequests,
	projectArchiveSections,
	projectArchives,
} from "@sprite-anvil/db/schema/project-archives";
import { and, asc, eq } from "drizzle-orm";
import type {
	ProjectArchiveRequestStorage,
	ProjectArchiveStorage,
	StoredProjectArchive,
	StoredProjectArchiveRequest,
} from "./project-archive-storage";

const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

function toArchive(
	row: typeof projectArchives.$inferSelect
): StoredProjectArchive {
	return {
		createdAt: row.createdAt,
		createdByUserId: row.createdByUserId,
		id: row.id,
		manifestDigest: row.manifestDigest,
		projectId: row.projectId,
		requestDigest: row.requestDigest,
		schemaVersion: row.schemaVersion,
	};
}

function toRequest(
	row: typeof projectArchiveRequests.$inferSelect
): StoredProjectArchiveRequest {
	return {
		createdAt: row.createdAt,
		id: row.id,
		idempotencyKey: row.idempotencyKey,
		projectId: row.projectId,
		requestDigest: row.requestDigest,
		requestedByUserId: row.requestedByUserId,
		workingFileIds: row.workingFileIds,
	};
}

export function createDatabaseProjectArchiveStorage(
	db: Database
): ProjectArchiveStorage {
	return {
		async find(projectId, archiveId) {
			const [row] = await db
				.select()
				.from(projectArchives)
				.where(
					and(
						eq(projectArchives.projectId, projectId),
						eq(projectArchives.id, archiveId)
					)
				);
			if (!row) {
				return null;
			}
			const [sections, files] = await Promise.all([
				db
					.select()
					.from(projectArchiveSections)
					.where(eq(projectArchiveSections.archiveId, archiveId))
					.orderBy(
						asc(projectArchiveSections.recordGroup),
						asc(projectArchiveSections.name)
					),
				db
					.select()
					.from(projectArchiveFiles)
					.where(eq(projectArchiveFiles.archiveId, archiveId))
					.orderBy(
						asc(projectArchiveFiles.kind),
						asc(projectArchiveFiles.sourceId)
					),
			]);
			return {
				archive: toArchive(row),
				files: files.map((file) => ({
					assetRecordId: file.assetRecordId,
					assetVersionId: file.assetVersionId,
					byteSize: file.byteSize,
					contentType: file.contentType,
					exclusionReason: file.exclusionReason as "not_selected" | null,
					fileName: file.fileName,
					kind: file.kind as "asset_version_file" | "working_file",
					presence: file.presence,
					sha256: file.sha256,
					sourceId: file.sourceId,
					sourceObjectKey: file.sourceObjectKey,
				})),
				sections: sections.map((section) => ({
					digest: section.digest,
					group: section.recordGroup,
					name: section.name,
					recordCount: section.recordCount,
					records: section.records,
				})),
			};
		},
		async insert(record) {
			try {
				await db.transaction(async (tx) => {
					await tx.insert(projectArchives).values(record.archive);
					if (record.sections.length > 0) {
						await tx.insert(projectArchiveSections).values(
							record.sections.map((section) => ({
								archiveId: record.archive.id,
								digest: section.digest,
								name: section.name,
								recordCount: section.recordCount,
								recordGroup: section.group,
								records: section.records,
							}))
						);
					}
					if (record.files.length > 0) {
						await tx.insert(projectArchiveFiles).values(
							record.files.map((file) => ({
								...file,
								archiveId: record.archive.id,
							}))
						);
					}
				});
				return { status: "inserted" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		async list(projectId) {
			const rows = await db
				.select()
				.from(projectArchives)
				.where(eq(projectArchives.projectId, projectId))
				.orderBy(asc(projectArchives.createdAt), asc(projectArchives.id));
			return rows.map(toArchive);
		},
	};
}

export function createDatabaseProjectArchiveRequestStorage(
	db: Database
): ProjectArchiveRequestStorage {
	return {
		async find(projectId, requestId) {
			const [row] = await db
				.select()
				.from(projectArchiveRequests)
				.where(
					and(
						eq(projectArchiveRequests.projectId, projectId),
						eq(projectArchiveRequests.id, requestId)
					)
				);
			return row ? toRequest(row) : null;
		},
		async insert(request) {
			const [created] = await db
				.insert(projectArchiveRequests)
				.values(request)
				.onConflictDoNothing()
				.returning({ id: projectArchiveRequests.id });
			if (created) {
				return { status: "inserted" };
			}
			const [existing] = await db
				.select()
				.from(projectArchiveRequests)
				.where(eq(projectArchiveRequests.id, request.id));
			if (!existing) {
				throw new Error("The archive request could not be re-read.");
			}
			return { existing: toRequest(existing), status: "existing" };
		},
	};
}
