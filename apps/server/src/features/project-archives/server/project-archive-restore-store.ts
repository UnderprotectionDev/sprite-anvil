import {
	type ProjectArchiveRestore,
	type ProjectArchiveRestoreInput,
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
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import {
	idempotentRecordId,
	RecordIntegrityError,
	RetryablePublicationError,
	replayPublishedRecord,
	verifyPublishedRecord,
} from "@sprite-anvil/api/record-publication";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	createProjectAssetVersionObjectKey,
	createProjectImportInboxObjectKey,
	createProjectManagedSnapshotObjectKey,
	createProjectReferenceBoardObjectKey,
} from "../../../cloudflare";
import type { ManagedObjectReservations } from "../../../managed-object-reservations";
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
	reservations: ManagedObjectReservations;
	storage: ProjectArchiveRestoreStorage;
	verifyCanonical?: (
		record: StoredProjectArchiveRestoreRecord
	) => Promise<string[]>;
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

/** Each attempt owns distinct object keys within the independent project's normal key shapes. */
function restoredObjectKey(
	restoredProjectId: string,
	attemptId: string,
	file: {
		kind: string;
		restoredId: string;
		assetRecordId: string | null;
		assetVersionId: string | null;
	}
) {
	if (
		file.kind === "asset_version_file" &&
		file.assetRecordId &&
		file.assetVersionId
	) {
		return createProjectAssetVersionObjectKey(
			restoredProjectId,
			file.assetRecordId,
			crypto.randomUUID()
		);
	}
	if (file.kind === "import_inbox_file") {
		return createProjectImportInboxObjectKey(
			restoredProjectId,
			file.restoredId,
			attemptId
		);
	}
	if (file.kind === "reference_board_file" && file.assetRecordId) {
		return createProjectReferenceBoardObjectKey(
			restoredProjectId,
			file.assetRecordId,
			file.restoredId,
			attemptId
		);
	}
	if (
		file.kind === "working_file" &&
		file.assetRecordId &&
		file.assetVersionId
	) {
		return createProjectManagedSnapshotObjectKey(
			restoredProjectId,
			file.assetRecordId,
			file.assetVersionId,
			crypto.randomUUID()
		);
	}
	return `projects/${restoredProjectId}/restores/${attemptId}/${file.kind}/${file.restoredId}`;
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
	newKey: (file: ProjectArchiveRestorePlan["files"][number]) => string,
	reserve: (key: string) => Promise<void>,
	markSettled: (key: string) => Promise<void>,
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
		// biome-ignore lint/performance/noAwaitInLoops: Reserve each object before writing it.
		await reserve(to);
		await files.copy({
			byteSize: file.byteSize,
			contentType: file.kind === "import_inbox_file" ? null : file.contentType,
			from,
			sha256: file.sha256,
			to,
		});
		await markSettled(to);
		copied.push(to);
		if (
			!(await files.verify({
				objectKey: to,
				byteSize: file.byteSize,
				sha256: file.sha256,
			}))
		) {
			throw new Error("Restored file failed verification.");
		}
		restored.push({ ...file, objectKey: to });
	}
	return restored;
}

async function removeCopies(
	copied: string[],
	files: ProjectArchiveRestoreFiles,
	reservations: ManagedObjectReservations
) {
	await Promise.all(
		copied.map(async (key) => {
			await files.remove(key);
			await reservations.release(key);
		})
	);
}

export function createProjectArchiveRestoreStore(
	db: Database,
	options: ProjectArchiveRestoreStoreOptions
): ProjectArchiveRestoreStore & {
	restoreFromArchive: (
		userId: string,
		input: ProjectArchiveRestoreInput,
		archive: StoredProjectArchiveRecord
	) => Promise<ProjectArchiveRestoreResult | null>;
} {
	const { archives, files, reservations, storage } = options;
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	const now = options.now ?? (() => new Date());

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Publication and cleanup stay together.
	async function restoreArchive(
		userId: string,
		input: ProjectArchiveRestoreInput,
		provided?: StoredProjectArchiveRecord
	): Promise<ProjectArchiveRestoreResult | null> {
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
		const requestDigest = provided
			? await recordContentDigest({
					input,
					manifestDigest: provided.archive.manifestDigest,
				})
			: await projectArchiveRestoreRequestDigest(input);
		const sourceProjectId = provided?.archive.projectId ?? input.projectId;
		const verifyRecord = async (record: StoredProjectArchiveRestoreRecord) => {
			const failure = await integrityFailure(record);
			if (failure || record.restore.canonicalVerified === true) {
				return failure;
			}
			if (storage.verifyAndMark) {
				try {
					await storage.verifyAndMark(input.projectId, restoreId, record);
					return null;
				} catch {
					return "Canonical readback is unavailable.";
				}
			}
			if (!options.verifyCanonical) {
				return "Canonical verification is unavailable.";
			}
			let canonicalFailures: string[];
			try {
				canonicalFailures = await options.verifyCanonical(record);
			} catch {
				return "Canonical readback is unavailable.";
			}
			if (canonicalFailures.length) {
				return `Restored project failed canonical readback: ${canonicalFailures.join(" ")}`;
			}
			await storage.markVerified(input.projectId, restoreId);
			return null;
		};
		const replay = () =>
			replayPublishedRecord({
				differs: (row) => row.restore.requestDigest !== requestDigest,
				integrityFailure: verifyRecord,
				label: "Project Archive restore",
				read: () => storage.find(input.projectId, restoreId),
				toResult: toRestore,
			});
		const replayed = await replay();
		if (replayed) {
			const published = await storage.find(input.projectId, restoreId);
			if (published) {
				await Promise.all(
					published.files.flatMap((file) =>
						file.objectKey ? [reservations.release(file.objectKey)] : []
					)
				);
			}
			return { restore: replayed, status: "replayed" };
		}

		const stored =
			provided ?? (await archives.find(input.projectId, input.archiveId));
		if (!stored) {
			return null;
		}
		if (stored.archive.id !== input.archiveId) {
			return {
				failures: ["Archive identity does not match the request."],
				reason: "archive_invalid",
				status: "rejected",
			};
		}
		if (stored.archive.schemaVersion !== projectArchiveSchemaVersion) {
			return { reason: "unsupported_version", status: "rejected" };
		}
		const read = readArchive(stored);
		if ("failures" in read) {
			return {
				failures: read.failures,
				reason: "archive_invalid",
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
		// Digests and relations are checked, and ids mapped, before anything is written.
		const planned = await planProjectArchiveRestore(read.archive, {
			restoredProjectId,
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
		if (storage.canMaterialize?.(plan) === false) {
			return { reason: "unsupported_content", status: "rejected" };
		}
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

		// The record identity is deterministic, while each attempt owns its own files.
		const attemptId = crypto.randomUUID();
		const copied: string[] = [];
		let insertionStarted = false;
		let inserted: Awaited<ReturnType<typeof storage.insert>>;
		try {
			const restoredFiles = await copyRestoredFiles(
				plan,
				locations,
				files,
				(file) => restoredObjectKey(restoredProjectId, attemptId, file),
				(objectKey) =>
					reservations.reserve({
						ownerUserId: userId,
						projectId: input.projectId,
						objectKey,
						operationId: attemptId,
						purpose: "archive_restore_copy",
					}),
				(objectKey) => reservations.markSettled(objectKey),
				copied
			);
			insertionStarted = true;
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
					sourceProjectId,
					operationProjectId: provided ? input.projectId : null,
					canonicalVerified: !options.verifyCanonical,
				},
				sections: plan.sections,
			});
		} catch (error) {
			if (!insertionStarted) {
				try {
					await removeCopies(copied, files, reservations);
				} catch {
					// Keep reservations for cleanup that could not be confirmed.
				}
			}
			throw error;
		}
		if (inserted.status === "conflict") {
			// A concurrent request with the same key won; its record is the answer.
			const winner = await replay();
			if (!winner) {
				throw new RetryablePublicationError("Project Archive restore");
			}
			const owned = await storage.find(input.projectId, restoreId);
			if (owned) {
				const winnerKeys = new Set(owned.files.map((file) => file.objectKey));
				await removeCopies(
					copied.filter((key) => !winnerKeys.has(key)),
					files,
					reservations
				);
			}
			return { restore: winner, status: "replayed" };
		}
		const verified = await verifyPublishedRecord({
			integrityFailure: verifyRecord,
			label: "Project Archive restore",
			read: () => storage.find(input.projectId, restoreId),
			toResult: toRestore,
			withdraw: () => storage.withdraw(restoreId),
		});
		await Promise.all(copied.map((key) => reservations.release(key)));
		return { restore: verified, status: "created" };
	}

	return {
		async get(userId, projectId, restoreId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const record = await storage.find(projectId, restoreId);
			if (record?.restore.canonicalVerified !== true) {
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

		restore: (userId, input) => restoreArchive(userId, input),
		restoreFromArchive: (userId, input, archive) =>
			restoreArchive(userId, input, archive),
	};
}
