import type { FoundationRecords } from "@sprite-anvil/api/project-archives";
import type { Database } from "@sprite-anvil/db";
import { project } from "@sprite-anvil/db/schema/project";
import {
	projectArchiveRestoreFiles,
	projectArchiveRestoreIds,
	projectArchiveRestoreRequests,
	projectArchiveRestoreSections,
	projectArchiveRestores,
} from "@sprite-anvil/db/schema/project-archives";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { and, asc, eq } from "drizzle-orm";
import type {
	ProjectArchiveRestoreRequestStorage,
	ProjectArchiveRestoreStorage,
	StoredProjectArchiveRestore,
	StoredProjectArchiveRestoreRequest,
} from "./project-archive-restore-storage";

const uniqueViolationCode = "23505";
/** Rows per insert statement, well under the database's bound-parameter limit. */
const insertChunkSize = 500;

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

function chunks<T>(rows: T[]): T[][] {
	const parts: T[][] = [];
	for (let index = 0; index < rows.length; index += insertChunkSize) {
		parts.push(rows.slice(index, index + insertChunkSize));
	}
	return parts;
}

function toRestore(
	row: typeof projectArchiveRestores.$inferSelect
): StoredProjectArchiveRestore {
	return {
		archiveId: row.archiveId,
		createdAt: row.createdAt,
		createdByUserId: row.createdByUserId,
		id: row.id,
		manifestDigest: row.manifestDigest,
		requestDigest: row.requestDigest,
		restoredProjectId: row.restoredProjectId,
		sourceProjectId: row.sourceProjectId,
	};
}

function toRequest(
	row: typeof projectArchiveRestoreRequests.$inferSelect
): StoredProjectArchiveRestoreRequest {
	return {
		archiveId: row.archiveId,
		createdAt: row.createdAt,
		id: row.id,
		idempotencyKey: row.idempotencyKey,
		projectId: row.projectId,
		projectName: row.projectName,
		requestDigest: row.requestDigest,
		requestedByUserId: row.requestedByUserId,
	};
}

export function createDatabaseProjectArchiveRestoreStorage(
	db: Database
): ProjectArchiveRestoreStorage {
	return {
		async find(sourceProjectId, restoreId) {
			const [row] = await db
				.select()
				.from(projectArchiveRestores)
				.where(
					and(
						eq(projectArchiveRestores.sourceProjectId, sourceProjectId),
						eq(projectArchiveRestores.id, restoreId)
					)
				);
			if (!row) {
				return null;
			}
			const [[restoredProject], ids, sections, files] = await Promise.all([
				db
					.select({ name: project.name })
					.from(project)
					.where(eq(project.id, row.restoredProjectId)),
				db
					.select()
					.from(projectArchiveRestoreIds)
					.where(eq(projectArchiveRestoreIds.restoreId, restoreId))
					.orderBy(
						asc(projectArchiveRestoreIds.recordGroup),
						asc(projectArchiveRestoreIds.name),
						asc(projectArchiveRestoreIds.sourceId)
					),
				db
					.select()
					.from(projectArchiveRestoreSections)
					.where(eq(projectArchiveRestoreSections.restoreId, restoreId))
					.orderBy(
						asc(projectArchiveRestoreSections.recordGroup),
						asc(projectArchiveRestoreSections.name)
					),
				db
					.select()
					.from(projectArchiveRestoreFiles)
					.where(eq(projectArchiveRestoreFiles.restoreId, restoreId))
					.orderBy(
						asc(projectArchiveRestoreFiles.kind),
						asc(projectArchiveRestoreFiles.sourceId)
					),
			]);
			return {
				files: files.map((file) => ({
					assetRecordId: file.assetRecordId,
					assetVersionId: file.assetVersionId,
					byteSize: file.byteSize,
					contentType: file.contentType,
					exclusionReason: file.exclusionReason as
						| "evidence_not_archived"
						| "not_selected"
						| null,
					fileName: file.fileName,
					kind: file.kind as never,
					objectKey: file.objectKey,
					presence: file.presence,
					restoredId: file.restoredId,
					sha256: file.sha256,
					sourceId: file.sourceId,
				})),
				ids: ids.map((entry) => ({
					group: entry.recordGroup,
					name: entry.name,
					restoredId: entry.restoredId,
					sourceId: entry.sourceId,
				})),
				projectName: restoredProject?.name ?? "",
				restore: toRestore(row),
				sections: sections.map((section) => ({
					digest: section.digest,
					group: section.recordGroup,
					name: section.name,
					recordCount: section.recordCount,
					records: section.records,
					sourceDigest: section.sourceDigest,
				})),
			};
		},

		async insert(record) {
			const { restore } = record;
			const revisions = (record.sections.find(
				(section) =>
					section.group === "foundation" && section.name === "contextRevisions"
			)?.records ?? []) as FoundationRecords["contextRevisions"];
			try {
				await db.transaction(async (tx) => {
					await tx.insert(project).values({
						id: restore.restoredProjectId,
						name: record.projectName,
						ownerUserId: restore.createdByUserId,
					});
					await tx.insert(projectArchiveRestores).values({
						archiveId: restore.archiveId,
						createdAt: restore.createdAt,
						createdByUserId: restore.createdByUserId,
						id: restore.id,
						manifestDigest: restore.manifestDigest,
						requestDigest: restore.requestDigest,
						restoredProjectId: restore.restoredProjectId,
						sourceProjectId: restore.sourceProjectId,
					});
					// The Project Context travels as live revisions, so the new project opens with its own context.
					for (const rows of chunks(revisions)) {
						// biome-ignore lint/performance/noAwaitInLoops: Statements of one transaction run one after another.
						await tx.insert(contextRevisions).values(
							rows.map((revision) => ({
								contractVersion: revision.contractVersion,
								createdAt: new Date(revision.createdAt),
								createdByUserId: restore.createdByUserId,
								id: revision.id,
								projectId: restore.restoredProjectId,
								revisionNumber: revision.revisionNumber,
								rules: revision.rules,
								sourceProposalId: revision.sourceProposalId,
								state: revision.state,
							}))
						);
					}
					for (const rows of chunks(record.ids)) {
						// biome-ignore lint/performance/noAwaitInLoops: Statements of one transaction run one after another.
						await tx.insert(projectArchiveRestoreIds).values(
							rows.map((entry) => ({
								name: entry.name,
								recordGroup: entry.group,
								restoredId: entry.restoredId,
								restoreId: restore.id,
								sourceId: entry.sourceId,
							}))
						);
					}
					if (record.sections.length > 0) {
						await tx.insert(projectArchiveRestoreSections).values(
							record.sections.map((section) => ({
								digest: section.digest,
								name: section.name,
								recordCount: section.recordCount,
								recordGroup: section.group,
								records: section.records,
								restoreId: restore.id,
								sourceDigest: section.sourceDigest,
							}))
						);
					}
					for (const rows of chunks(record.files)) {
						// biome-ignore lint/performance/noAwaitInLoops: Statements of one transaction run one after another.
						await tx.insert(projectArchiveRestoreFiles).values(
							rows.map((file) => ({
								assetRecordId: file.assetRecordId,
								assetVersionId: file.assetVersionId,
								byteSize: file.byteSize,
								contentType: file.contentType,
								exclusionReason: file.exclusionReason,
								fileName: file.fileName,
								kind: file.kind,
								objectKey: file.objectKey,
								presence: file.presence,
								restoredId: file.restoredId,
								restoreId: restore.id,
								sha256: file.sha256,
								sourceId: file.sourceId,
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

		async list(sourceProjectId) {
			const rows = await db
				.select()
				.from(projectArchiveRestores)
				.where(eq(projectArchiveRestores.sourceProjectId, sourceProjectId))
				.orderBy(
					asc(projectArchiveRestores.createdAt),
					asc(projectArchiveRestores.id)
				);
			return rows.map(toRestore);
		},

		async withdraw(restoreId) {
			const [row] = await db
				.select({ restoredProjectId: projectArchiveRestores.restoredProjectId })
				.from(projectArchiveRestores)
				.where(eq(projectArchiveRestores.id, restoreId));
			if (row) {
				// The restore's rows follow the project they created.
				await db.delete(project).where(eq(project.id, row.restoredProjectId));
			}
		},
	};
}

export function createDatabaseProjectArchiveRestoreRequestStorage(
	db: Database
): ProjectArchiveRestoreRequestStorage {
	return {
		async find(projectId, requestId) {
			const [row] = await db
				.select()
				.from(projectArchiveRestoreRequests)
				.where(
					and(
						eq(projectArchiveRestoreRequests.projectId, projectId),
						eq(projectArchiveRestoreRequests.id, requestId)
					)
				);
			return row ? toRequest(row) : null;
		},
		async insert(request) {
			const [created] = await db
				.insert(projectArchiveRestoreRequests)
				.values(request)
				.onConflictDoNothing()
				.returning({ id: projectArchiveRestoreRequests.id });
			if (created) {
				return { status: "inserted" };
			}
			const [existing] = await db
				.select()
				.from(projectArchiveRestoreRequests)
				.where(eq(projectArchiveRestoreRequests.id, request.id));
			if (!existing) {
				throw new Error("The restore request could not be re-read.");
			}
			return { existing: toRequest(existing), status: "existing" };
		},
	};
}
