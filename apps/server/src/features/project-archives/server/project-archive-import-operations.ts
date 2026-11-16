import { createHash } from "node:crypto";
import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import type { ProjectArchiveRestoreInput } from "@sprite-anvil/api/project-archive-restore";
import {
	projectArchiveFileStorageLimit,
	projectArchiveSchemaVersion,
} from "@sprite-anvil/api/project-archives";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import {
	IdempotencyConflictError,
	idempotentRecordId,
} from "@sprite-anvil/api/record-publication";
import type { Database } from "@sprite-anvil/db";
import { getProjectForUser } from "@sprite-anvil/db";
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
			const verified = verifiedUpload(input.byteSize, input.sha256);
			let insertStarted = false;
			try {
				await options.objects.put(
					key,
					input.body.pipeThrough(verified.stream),
					"application/octet-stream",
					input.byteSize
				);
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
					await options.objects.delete(key).catch(() => undefined);
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
				if (!insertStarted) {
					await options.objects.delete(key).catch(() => undefined);
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
			if (!(await lookup(request.requestedByUserId, request.projectId))) {
				throw options.permanentFailure(
					"Project access is no longer available."
				);
			}
			if (
				!(await verifyObject(options.objects, request.stagedObjectKey, {
					byteSize: request.zipByteSize,
					sha256: request.zipSha256,
				}))
			) {
				throw options.permanentFailure(
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
					throw options.permanentFailure(
						"Uploaded Project Archive is invalid."
					);
				}
				throw error;
			}
			if (portable.archive.schemaVersion !== projectArchiveSchemaVersion) {
				throw options.permanentFailure(
					"Project Archive version lacks required restore data."
				);
			}
			if (
				portable.archive.projectId !==
				portable.archive.manifest.source.projectId
			) {
				throw options.permanentFailure(
					"Project Archive source identity is inconsistent."
				);
			}
			if (
				portable.archive.manifest.files.some(
					(file) => file.byteSize > projectArchiveFileStorageLimit
				)
			) {
				throw options.permanentFailure(
					"Project Archive file exceeds the storage limit."
				);
			}
			const attempt = crypto.randomUUID();
			const staged = new Map<string, string>();
			const cleanup: string[] = [];
			try {
				for (const entry of portable.files) {
					const key = `projects/${encodeURIComponent(request.projectId)}/project-archive-imports/${request.id}/${attempt}/files/${entry.file.kind}/${Buffer.from(entry.file.sourceId).toString("hex")}`;
					cleanup.push(key);
					// biome-ignore lint/performance/noAwaitInLoops: Each file is streamed and verified before starting the next.
					await options.objects.put(
						key,
						await portable.openFile(entry),
						"application/octet-stream",
						entry.file.byteSize
					);
					if (!(await verifyObject(options.objects, key, entry.file))) {
						throw options.permanentFailure(
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
					throw options.permanentFailure(
						"Uploaded Project Archive could not be restored."
					);
				}
				return `Project ${result.restore.restoredProjectId} ${result.status} from uploaded Project Archive ${archive.id}.`;
			} catch (error) {
				if (error instanceof PortableArchiveFormatError) {
					throw options.permanentFailure(
						"Uploaded Project Archive file is invalid."
					);
				}
				throw error;
			} finally {
				await Promise.allSettled(
					cleanup.map((key) => options.objects.delete(key))
				);
			}
		},
	};
}
