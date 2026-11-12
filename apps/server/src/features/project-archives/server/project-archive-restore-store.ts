import {
	type ProjectArchiveRestore,
	type ProjectArchiveRestorePlan,
	planProjectArchiveRestore,
	projectArchiveRestoreCatalogSchema,
	projectArchiveRestoreRequestDigest,
	projectArchiveRestoreSchema,
	projectArchiveRestoreSummarySchema,
	verifyRestoredRecords,
} from "@sprite-anvil/api/project-archive-restore";
import type {
	ProjectArchiveRestoreResult,
	ProjectArchiveRestoreStore,
} from "@sprite-anvil/api/project-archive-restore-store";
import {
	type ProjectArchive,
	projectArchiveSchemaVersion,
} from "@sprite-anvil/api/project-archives";
import {
	idempotentRecordId,
	RecordIntegrityError,
	RetryablePublicationError,
	replayPublishedRecord,
	verifyPublishedRecord,
} from "@sprite-anvil/api/record-publication";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type {
	ProjectArchiveRestoreStorage,
	StoredProjectArchiveRestore,
	StoredProjectArchiveRestoreRecord,
	StoredRestoredFile,
} from "./project-archive-restore-storage";
import type {
	ProjectArchiveStorage,
	StoredProjectArchiveRecord,
} from "./project-archive-storage";
import { toArchive } from "./project-archive-store";

/** What a restore needs from file storage: confirm a source file, then copy it to its new location. */
export interface ProjectArchiveRestoreFiles {
	/** Writes the file to its new location; it fails when the bytes no longer match `sha256` and `byteSize`. */
	copy: (file: {
		byteSize: number;
		contentType: string | null;
		from: string;
		sha256: string;
		to: string;
	}) => Promise<void>;
	/** Deletes a copied object; used best-effort to undo the copies of a restore that did not complete. */
	remove: (key: string) => Promise<void>;
	/** Confirms a stored file still has the archived digest and size. */
	verify: (file: {
		byteSize: number;
		objectKey: string;
		sha256: string;
	}) => Promise<boolean>;
}

export interface ProjectArchiveRestoreStoreOptions {
	archives: ProjectArchiveStorage;
	files: ProjectArchiveRestoreFiles;
	/** Resolves a project the user owns; defaults to the shared project access lookup. */
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	now?: () => Date;
	storage: ProjectArchiveRestoreStorage;
}

function toSummary(restore: StoredProjectArchiveRestore) {
	return projectArchiveRestoreSummarySchema.parse({
		archiveId: restore.archiveId,
		createdAt: restore.createdAt.toISOString(),
		id: restore.id,
		manifestDigest: restore.manifestDigest,
		restoredProjectId: restore.restoredProjectId,
		sourceProjectId: restore.sourceProjectId,
	});
}

const compare = (left: string, right: string) =>
	Number(left > right) - Number(left < right);

function toRestore(
	record: StoredProjectArchiveRestoreRecord
): ProjectArchiveRestore {
	return projectArchiveRestoreSchema.parse({
		...toSummary(record.restore),
		files: record.files
			.map((file) => ({
				byteSize: file.byteSize,
				exclusionReason: file.exclusionReason,
				kind: file.kind,
				presence: file.presence,
				restoredId: file.restoredId,
				sha256: file.sha256,
				sourceId: file.sourceId,
			}))
			.sort(
				(left, right) =>
					compare(left.kind, right.kind) ||
					compare(left.sourceId, right.sourceId)
			),
		ids: [...record.ids].sort(
			(left, right) =>
				compare(left.group, right.group) ||
				compare(left.name, right.name) ||
				compare(left.sourceId, right.sourceId)
		),
		sections: record.sections
			.map(({ digest, group, name, recordCount, sourceDigest }) => ({
				digest,
				group,
				name,
				recordCount,
				sourceDigest,
			}))
			.sort(
				(left, right) =>
					compare(left.group, right.group) || compare(left.name, right.name)
			),
	});
}

/** Failure text when a stored restore no longer matches its own digests and relations, else null. */
async function integrityFailure(
	record: StoredProjectArchiveRestoreRecord
): Promise<string | null> {
	const failures = await verifyRestoredRecords(record);
	return failures.length > 0
		? `The restored project failed verification: ${failures.join(" ")}`
		: null;
}

/** The archive as the restore reads it, or the reasons it cannot be read. */
function readArchive(
	stored: StoredProjectArchiveRecord
): { archive: ProjectArchive } | { failures: string[] } {
	if (stored.archive.schemaVersion !== projectArchiveSchemaVersion) {
		return {
			failures: [
				"The Project Archive uses a schema version this build does not read.",
			],
		};
	}
	try {
		return { archive: toArchive(stored) };
	} catch {
		return { failures: ["A stored archive row breaks its schema."] };
	}
}

/** Where a restored file lives in the independent project; derived, so a retry writes the same place. */
function restoredObjectKey(
	restoredProjectId: string,
	restoreId: string,
	file: { kind: string; restoredId: string }
) {
	return `projects/${restoredProjectId}/restores/${restoreId}/${file.kind}/${file.restoredId}`;
}

/** Source ids of included files that no longer match their archived digest; none when every one verifies. */
async function unverifiableFiles(
	plan: ProjectArchiveRestorePlan,
	locations: Map<string, string>,
	files: ProjectArchiveRestoreFiles
): Promise<string[]> {
	const unverifiable: string[] = [];
	for (const file of plan.files) {
		if (file.presence !== "included") {
			continue;
		}
		const objectKey = locations.get(`${file.kind}:${file.sourceId}`);
		const verified =
			objectKey &&
			// biome-ignore lint/performance/noAwaitInLoops: Files are read one at a time to bound memory.
			(await files.verify({
				byteSize: file.byteSize,
				objectKey,
				sha256: file.sha256,
			}));
		if (!verified) {
			unverifiable.push(file.sourceId);
		}
	}
	return unverifiable;
}

/** Copies every included file to its new location, one at a time; an excluded file keeps no location. */
async function copyRestoredFiles(
	plan: ProjectArchiveRestorePlan,
	locations: Map<string, string>,
	files: ProjectArchiveRestoreFiles,
	newKey: (file: { kind: string; restoredId: string }) => string,
	copied: string[]
): Promise<StoredRestoredFile[]> {
	const restored: StoredRestoredFile[] = [];
	for (const file of plan.files) {
		const from = locations.get(`${file.kind}:${file.sourceId}`);
		if (file.presence === "excluded" || !from) {
			restored.push({ ...file, objectKey: null });
			continue;
		}
		const to = newKey(file);
		// biome-ignore lint/performance/noAwaitInLoops: Files are copied one at a time to bound memory.
		await files.copy({
			byteSize: file.byteSize,
			contentType: file.contentType,
			from,
			sha256: file.sha256,
			to,
		});
		copied.push(to);
		restored.push({ ...file, objectKey: to });
	}
	return restored;
}

/**
 * Best-effort cleanup of the objects one failed attempt copied. Nothing is
 * deleted when a restore record for the key exists, since the keys are the
 * same ones that record owns; a failed delete never hides the original error.
 */
async function removeUnownedCopies(
	copied: string[],
	files: ProjectArchiveRestoreFiles,
	find: () => Promise<unknown>
) {
	if (copied.length === 0) {
		return;
	}
	try {
		if (await find()) {
			return;
		}
	} catch {
		// Ownership is unknown; keeping a possible orphan is safer than deleting owned files.
		return;
	}
	await Promise.allSettled(copied.map((key) => files.remove(key)));
}

export function createProjectArchiveRestoreStore(
	db: Database,
	options: ProjectArchiveRestoreStoreOptions
): ProjectArchiveRestoreStore {
	const { archives, files, storage } = options;
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	const now = options.now ?? (() => new Date());

	return {
		async get(userId, projectId, restoreId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const record = await storage.find(projectId, restoreId);
			if (!record) {
				return null;
			}
			const failure = await integrityFailure(record);
			if (failure) {
				throw new RecordIntegrityError(failure);
			}
			return toRestore(record);
		},

		async list(userId, projectId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			return projectArchiveRestoreCatalogSchema.parse({
				restores: (await storage.list(projectId)).map(toSummary),
			});
		},

		async restore(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const restoreId = await idempotentRecordId(
				{
					kind: "project-archive-restore",
					projectId: input.projectId,
					targetId: input.archiveId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await projectArchiveRestoreRequestDigest(input);
			const replay = () =>
				replayPublishedRecord({
					differs: (row) => row.restore.requestDigest !== requestDigest,
					integrityFailure,
					label: "Project Archive restore",
					read: () => storage.find(input.projectId, restoreId),
					toResult: toRestore,
				});
			const replayed = await replay();
			if (replayed) {
				return { restore: replayed, status: "replayed" };
			}

			const stored = await archives.find(input.projectId, input.archiveId);
			if (!stored) {
				return null;
			}
			const read = readArchive(stored);
			if ("failures" in read) {
				return {
					failures: read.failures,
					reason: "archive_invalid",
					status: "rejected",
				};
			}
			// Digests and relations are checked, and ids mapped, before anything is written.
			const planned = await planProjectArchiveRestore(read.archive, {
				restoreId,
			});
			if (!planned.ok) {
				const { ok: _ok, ...rejection } = planned;
				return {
					...rejection,
					status: "rejected",
				} as ProjectArchiveRestoreResult;
			}
			const { plan } = planned;
			const locations = new Map(
				stored.files.flatMap((file) =>
					file.sourceObjectKey
						? [[`${file.kind}:${file.sourceId}`, file.sourceObjectKey] as const]
						: []
				)
			);
			const unverifiable = await unverifiableFiles(plan, locations, files);
			if (unverifiable.length > 0) {
				return {
					reason: "file_unverifiable",
					sourceIds: unverifiable,
					status: "rejected",
				};
			}

			const restoredProjectId = await idempotentRecordId(
				{
					kind: "project-archive-restored-project",
					projectId: input.projectId,
					targetId: input.archiveId,
					userId,
				},
				input.idempotencyKey
			);
			// Object keys are derived, so a concurrent or earlier attempt for the same
			// key owns these exact keys; only a restore that left no record may undo them.
			const copied: string[] = [];
			let inserted: Awaited<ReturnType<typeof storage.insert>>;
			try {
				const restoredFiles = await copyRestoredFiles(
					plan,
					locations,
					files,
					(file) => restoredObjectKey(restoredProjectId, restoreId, file),
					copied
				);
				inserted = await storage.insert({
					files: restoredFiles,
					ids: plan.ids,
					projectName: input.name,
					restore: {
						archiveId: input.archiveId,
						createdAt: now(),
						createdByUserId: userId,
						id: restoreId,
						manifestDigest: plan.sourceManifestDigest,
						requestDigest,
						restoredProjectId,
						sourceProjectId: input.projectId,
					},
					sections: plan.sections,
				});
			} catch (error) {
				await removeUnownedCopies(copied, files, () =>
					storage.find(input.projectId, restoreId)
				);
				throw error;
			}
			if (inserted.status === "conflict") {
				// A concurrent request with the same key won; its record is the answer.
				const winner = await replay();
				if (!winner) {
					throw new RetryablePublicationError("Project Archive restore");
				}
				return { restore: winner, status: "replayed" };
			}
			const verified = await verifyPublishedRecord({
				integrityFailure,
				label: "Project Archive restore",
				read: () => storage.find(input.projectId, restoreId),
				toResult: toRestore,
				withdraw: () => storage.withdraw(restoreId),
			});
			return { restore: verified, status: "created" };
		},
	};
}
