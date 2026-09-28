import type {
	ImportInboxCreateResult,
	ImportInboxEntry,
	ImportInboxFileRecord,
	ImportInboxStore,
	ImportInboxUploadInput,
} from "@sprite-anvil/api/import-inbox";
import {
	importInboxEntrySchema,
	importInboxUploadInputSchema,
} from "@sprite-anvil/api/import-inbox";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import { project } from "@sprite-anvil/db/schema/project";
import { and, desc, eq } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toEntry(
	row: typeof importInboxEntries.$inferSelect
): ImportInboxEntry {
	return importInboxEntrySchema.parse({
		createdAt: toISOString(row.createdAt),
		contentLength: row.contentLength,
		fileName: row.fileName,
		id: row.id,
		projectId: row.projectId,
		sha256: row.sha256,
		sourceContentType: row.sourceContentType,
	});
}

function sameUpload(
	existing: typeof importInboxEntries.$inferSelect,
	userId: string,
	input: ImportInboxUploadInput
) {
	return (
		existing.projectId === input.projectId &&
		existing.fileName === input.fileName &&
		existing.sourceContentType === input.sourceContentType &&
		existing.contentLength === input.contentLength &&
		existing.sha256 === input.sha256 &&
		existing.createdByUserId === userId
	);
}

export function createImportInboxStore(db: Database): ImportInboxStore {
	return {
		async createEntry(userId, rawInput): Promise<ImportInboxCreateResult> {
			const input = importInboxUploadInputSchema.parse(rawInput);
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return { ok: false, reason: "not_found" };
			}

			const [created] = await db
				.insert(importInboxEntries)
				.values({
					contentLength: input.contentLength,
					createdByUserId: userId,
					fileName: input.fileName,
					id: input.id,
					objectKey: input.objectKey,
					projectId: input.projectId,
					sha256: input.sha256,
					sourceContentType: input.sourceContentType,
				})
				.onConflictDoNothing()
				.returning();
			if (created) {
				return { ok: true, kind: "created", value: toEntry(created) };
			}

			const [existing] = await db
				.select()
				.from(importInboxEntries)
				.where(eq(importInboxEntries.id, input.id))
				.limit(1);
			if (!existing) {
				return { ok: false, reason: "conflict" };
			}
			if (!sameUpload(existing, userId, input)) {
				return { ok: false, reason: "conflict" };
			}
			return { ok: true, kind: "existing", value: toEntry(existing) };
		},

		async listEntries(userId, projectIdInput) {
			const ownedProject = await getProjectForUser(db, userId, projectIdInput);
			if (!ownedProject) {
				return null;
			}
			const rows = await db
				.select()
				.from(importInboxEntries)
				.where(eq(importInboxEntries.projectId, projectIdInput))
				.orderBy(desc(importInboxEntries.createdAt));
			return rows.map(toEntry);
		},

		async getFileRecord(
			userId,
			projectIdInput,
			entryId
		): Promise<ImportInboxFileRecord | null> {
			const [record] = await db
				.select({
					contentLength: importInboxEntries.contentLength,
					fileName: importInboxEntries.fileName,
					objectKey: importInboxEntries.objectKey,
					sha256: importInboxEntries.sha256,
				})
				.from(importInboxEntries)
				.innerJoin(project, eq(project.id, importInboxEntries.projectId))
				.where(
					and(
						eq(importInboxEntries.id, entryId),
						eq(importInboxEntries.projectId, projectIdInput),
						eq(project.ownerUserId, userId)
					)
				)
				.limit(1);
			return record ?? null;
		},
	};
}
