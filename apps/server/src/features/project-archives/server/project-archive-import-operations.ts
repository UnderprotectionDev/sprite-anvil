import { createHash } from "node:crypto";
import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import { IdempotencyConflictError } from "@sprite-anvil/api/idempotency-conflict-error";
import type { ProjectArchiveRestoreInput } from "@sprite-anvil/api/project-archive-restore";
import {
	projectArchiveFileStorageLimit,
	projectArchiveSchemaVersion,
} from "@sprite-anvil/api/project-archives";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import { idempotentRecordId } from "@sprite-anvil/api/record-publication";
import type { Database } from "@sprite-anvil/db";
import { getProjectForUser } from "@sprite-anvil/db";
import type {
	ManagedObjectErasureGate,
	ManagedObjectReservations,
} from "../../../managed-object-reservations";
import { verifyObject } from "./object-file-bytes";
import {
	PortableArchiveFormatError,
	readPortableArchive,
} from "./portable-archive-reader";
import type {
	ArchiveImportRequest,
	ArchiveImportRequestStorage,
} from "./project-archive-import-storage";
import type { createProjectArchiveRestoreStore } from "./project-archive-restore-store";

interface ArchiveObjects {
	delete: (key: string) => Promise<void>;
	get: (
		key: string,
		range?: { offset: number; length: number }
	) => Promise<{ body: ReadableStream<Uint8Array> | null } | null>;
	put: (
		key: string,
		body: ReadableStream<Uint8Array>,
		contentType: "application/octet-stream" | "image/png" | "image/webp",
		length?: number
	) => Promise<void>;
}
interface Enqueuer {
	enqueue: (request: {
		idempotencyKey: string;
		kind: "restore";
		projectId: string;
		scopeSummary: string;
		scopeTargetId: string;
		triggerSummary: string;
		userId: string;
	}) => Promise<BackgroundOperation>;
}
export interface ArchiveImportOptions {
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	maxManifestBytes?: number;
	objects: ArchiveObjects;
	operations: Enqueuer;
	permanentFailure: (message: string) => Error;
	requests: ArchiveImportRequestStorage;
	reservations: ManagedObjectReservations &
		Pick<ManagedObjectErasureGate, "listOwner">;
	store: Pick<
		ReturnType<typeof createProjectArchiveRestoreStore>,
		"restoreFromArchive"
	>;
}

function verifiedUpload(byteSize: number, sha256?: string) {
	let size = 0;
	let result: string | undefined;
	const hash = createHash("sha256");
	const stream = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			size += chunk.length;
			if (size > byteSize) {
				throw new Error("Invalid upload length");
			}
			hash.update(chunk);
			controller.enqueue(chunk);
		},
		flush() {
			const digest = hash.digest("hex");
			if (size !== byteSize || (sha256 && digest !== sha256)) {
				throw new Error("Invalid upload digest");
			}
			result = digest;
		},
	});
	return { stream, digest: () => result };
}

export function createProjectArchiveImportOperations(
	db: Database,
	options: ArchiveImportOptions
) {
	async function deleteReserved(key: string) {
		await options.objects.delete(key);
		await options.reservations.release(key);
	}
	async function cleanupImport(request: ArchiveImportRequest) {
		const entries = await options.reservations.listOwner(
			request.requestedByUserId
		);
		for (const entry of entries) {
			if (
				entry.operationId === request.id &&
				entry.projectId === request.projectId &&
				entry.purpose === "archive_import_zip" &&
				entry.objectKey === request.stagedObjectKey
			) {
				if (!entry.writeSettled) {
					throw new Error(
						"The archive upload outcome is unknown; storage must be verified before cleanup."
					);
				}
				// biome-ignore lint/performance/noAwaitInLoops: Retryable deletion must finish before ownership is released.
				await deleteReserved(entry.objectKey);
			}
		}
	}
	async function rejectImport(
		request: ArchiveImportRequest,
		message: string
	): Promise<never> {
		await cleanupImport(request);
		throw options.permanentFailure(message);
	}
	const lookup =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	function enqueue(request: ArchiveImportRequest) {
		return options.operations.enqueue({
			idempotencyKey: `project-archive-import:${request.idempotencyKey}`,
			kind: "restore",
			projectId: request.projectId,
			scopeTargetId: request.id,
			scopeSummary: "Restore an uploaded Project Archive",
			triggerSummary: "Restore requested by the project owner",
			userId: request.requestedByUserId,
		});
	}
	return {
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Upload staging, idempotency and cleanup form one operation.
		async request(
			userId: string,
			input: {
				projectId: string;
				idempotencyKey: string;
				name: string;
				byteSize: number;
				sha256?: string;
				body: ReadableStream<Uint8Array>;
			}
		) {
			if (
				!(
					Number.isSafeInteger(options.maxManifestBytes) &&
					options.maxManifestBytes
				) ||
				options.maxManifestBytes <= 0
			) {
				throw new Error("Project Archive import is not configured.");
			}
			if (!(await lookup(userId, input.projectId))) {
				return null;
			}
			const id = await idempotentRecordId(
				{ kind: "project-archive-import", projectId: input.projectId, userId },
				input.idempotencyKey
			);
			const digestFor = (sha256: string) =>
				recordContentDigest({
					projectId: input.projectId,
					userId,
					name: input.name,
					byteSize: input.byteSize,
					sha256,
				});
			const existing = await options.requests.find(input.projectId, id);
			if (existing) {
				const checked = verifiedUpload(input.byteSize, input.sha256);
				await input.body.pipeThrough(checked.stream).pipeTo(
					new WritableStream({
						write() {
							/* discard bytes after hashing */
						},
					})
				);
				const sha256 = checked.digest();
				if (!sha256 || existing.requestDigest !== (await digestFor(sha256))) {
					throw new IdempotencyConflictError("Project Archive import");
				}
				return enqueue(existing);
			}
			const key = `projects/${encodeURIComponent(input.projectId)}/project-archive-imports/${id}/${crypto.randomUUID()}/archive.zip`;
			await options.reservations.reserve({
				ownerUserId: userId,
				projectId: input.projectId,
				objectKey: key,
				operationId: id,
				purpose: "archive_import_zip",
			});
			const verified = verifiedUpload(input.byteSize, input.sha256);
			let insertStarted = false;
			let writeSettled = false;
			try {
				await options.objects.put(
					key,
					input.body.pipeThrough(verified.stream),
					"application/octet-stream",
					input.byteSize
				);
				await options.reservations.markSettled(key);
				writeSettled = true;
				const sha256 = verified.digest();
				if (!sha256) {
					throw new Error("Upload did not finish verification");
				}
				const requestDigest = await digestFor(sha256);
				insertStarted = true;
				const saved = await options.requests.insert({
					id,
					projectId: input.projectId,
					requestedByUserId: userId,
					idempotencyKey: input.idempotencyKey,
					requestDigest,
					projectName: input.name,
					stagedObjectKey: key,
					zipByteSize: input.byteSize,
					zipSha256: sha256,
					createdAt: new Date(),
				});
				if (saved.status === "existing") {
					await deleteReserved(key);
					if (saved.existing.requestDigest !== requestDigest) {
						throw new IdempotencyConflictError("Project Archive import");
					}
					return enqueue(saved.existing);
				}
				return enqueue({
					id,
					projectId: input.projectId,
					requestedByUserId: userId,
					idempotencyKey: input.idempotencyKey,
					requestDigest,
					projectName: input.name,
					stagedObjectKey: key,
					zipByteSize: input.byteSize,
					zipSha256: sha256,
					createdAt: new Date(),
				});
			} catch (error) {
				if (!insertStarted && writeSettled) {
					await deleteReserved(key);
				}
				throw error;
			}
		},
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Validation, staged-file cleanup and publication form one operation.
		async execute(context: {
			operation: Pick<BackgroundOperation, "projectId" | "scopeTargetId">;
		}) {
			if (
				!(
					Number.isSafeInteger(options.maxManifestBytes) &&
					options.maxManifestBytes
				) ||
				options.maxManifestBytes <= 0
			) {
				throw new Error("Project Archive import is not configured.");
			}
			const { operation } = context;
			const request =
				operation.scopeTargetId &&
				(await options.requests.find(
					operation.projectId,
					operation.scopeTargetId
				));
			if (!request) {
				throw options.permanentFailure(
					"Project Archive import request not found."
				);
			}
			if (request.completedSummary) {
				await cleanupImport(request);
				return request.completedSummary.replace(
					" created from ",
					" replayed from "
				);
			}
			if (!(await lookup(request.requestedByUserId, request.projectId))) {
				return await rejectImport(
					request,
					"Project access is no longer available."
				);
			}
			if (
				!(await verifyObject(options.objects, request.stagedObjectKey, {
					byteSize: request.zipByteSize,
					sha256: request.zipSha256,
				}))
			) {
				return await rejectImport(
					request,
					"Uploaded Project Archive failed verification."
				);
			}
			let portable: Awaited<ReturnType<typeof readPortableArchive>>;
			try {
				portable = await readPortableArchive({
					maxManifestBytes: options.maxManifestBytes,
					byteSize: request.zipByteSize,
					range: async (offset, length) =>
						(
							await options.objects.get(request.stagedObjectKey, {
								offset,
								length,
							})
						)?.body ?? null,
				});
			} catch (error) {
				if (error instanceof PortableArchiveFormatError) {
					return await rejectImport(
						request,
						"Uploaded Project Archive is invalid."
					);
				}
				throw error;
			}
			if (portable.archive.schemaVersion !== projectArchiveSchemaVersion) {
				return await rejectImport(
					request,
					"Project Archive version lacks required restore data."
				);
			}
			if (
				portable.archive.projectId !==
				portable.archive.manifest.source.projectId
			) {
				return await rejectImport(
					request,
					"Project Archive source identity is inconsistent."
				);
			}
			if (
				portable.archive.manifest.files.some(
					(file) => file.byteSize > projectArchiveFileStorageLimit
				)
			) {
				return await rejectImport(
					request,
					"Project Archive file exceeds the storage limit."
				);
			}
			const attempt = crypto.randomUUID();
			const staged = new Map<string, string>();
			const cleanup: string[] = [];
			try {
				for (const entry of portable.files) {
					const key = `projects/${encodeURIComponent(request.projectId)}/project-archive-imports/${request.id}/${attempt}/files/${entry.file.kind}/${Buffer.from(entry.file.sourceId).toString("hex")}`;
					// biome-ignore lint/performance/noAwaitInLoops: Reserve each file before writing its bytes.
					await options.reservations.reserve({
						ownerUserId: request.requestedByUserId,
						projectId: request.projectId,
						objectKey: key,
						operationId: request.id,
						purpose: "archive_import_file",
					});
					await options.objects.put(
						key,
						await portable.openFile(entry),
						"application/octet-stream",
						entry.file.byteSize
					);
					await options.reservations.markSettled(key);
					cleanup.push(key);
					if (!(await verifyObject(options.objects, key, entry.file))) {
						return await rejectImport(
							request,
							"Project Archive file failed verification."
						);
					}
					staged.set(`${entry.file.kind}:${entry.file.sourceId}`, key);
				}
				const { archive } = portable;
				const input: ProjectArchiveRestoreInput = {
					projectId: request.projectId,
					archiveId: archive.id,
					idempotencyKey: request.idempotencyKey,
					name: request.projectName,
				};
				const result = await options.store.restoreFromArchive(
					request.requestedByUserId,
					input,
					{
						archive: {
							id: archive.id,
							projectId: archive.projectId,
							schemaVersion: archive.schemaVersion,
							manifestDigest: archive.manifestDigest,
							createdAt: new Date(archive.createdAt),
							createdByUserId: request.requestedByUserId,
							requestDigest: request.requestDigest,
						},
						files: archive.manifest.files.map((file) => ({
							...file,
							sourceObjectKey:
								staged.get(`${file.kind}:${file.sourceId}`) ?? null,
						})),
						sections: archive.sections.map((section) => {
							const content = archive.manifest.contents.find(
								(entry) =>
									entry.group === section.group && entry.name === section.name
							);
							if (!content) {
								throw new Error("Missing section digest");
							}
							return {
								...section,
								digest: content.digest,
								recordCount: content.recordCount,
							};
						}),
					}
				);
				if (!result || result.status === "rejected") {
					return await rejectImport(
						request,
						"Uploaded Project Archive could not be restored."
					);
				}
				const summary = `Project ${result.restore.restoredProjectId} ${result.status} from uploaded Project Archive ${archive.id}.`;
				await options.requests.complete(request.projectId, request.id, summary);
				return summary;
			} catch (error) {
				if (error instanceof PortableArchiveFormatError) {
					return await rejectImport(
						request,
						"Uploaded Project Archive file is invalid."
					);
				}
				throw error;
			} finally {
				for (const key of cleanup) {
					// biome-ignore lint/performance/noAwaitInLoops: Cleanup must complete before releasing durable ownership.
					await deleteReserved(key);
				}
				const latest = await options.requests.find(
					request.projectId,
					request.id
				);
				if (latest?.completedSummary) {
					await cleanupImport(request);
				}
			}
		},
	};
}
