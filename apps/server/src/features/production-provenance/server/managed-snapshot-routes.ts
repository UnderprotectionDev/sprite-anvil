import { createHash } from "node:crypto";
import { assetVersionFileNameSchema } from "@sprite-anvil/api/asset-file-contracts";
import {
	type ManagedSnapshotStore,
	managedSnapshotSummarySchema,
} from "@sprite-anvil/api/production-provenance";
import type { Context, Hono } from "hono";
import z from "zod";
import type { createStorage } from "../../../cloudflare";
import {
	createProjectManagedSnapshotObjectKey,
	managedSnapshotObjectKeySchema,
} from "../../../cloudflare";
import { serializePublicApiError } from "../../../output-contracts";

const projectIdSchema = z.string().min(1).max(200);
const assetVersionIdSchema = z.string().uuid();
const managedSnapshotIdSchema = z.string().uuid();
const idempotencyKeySchema = z.string().trim().min(1).max(128);
const managedSnapshotSizeHeader = "x-managed-snapshot-size";
const managedSnapshotFileNameHeader = "x-managed-snapshot-file-name";
const uploadLengthPattern = /^[1-9]\d*$/;
const maxManagedSnapshotBytes = 100 * 1024 * 1024;

type SnapshotStorage = Pick<
	ReturnType<typeof createStorage>,
	"delete" | "get"
> & {
	put: (
		key: string,
		body: ReadableStream<Uint8Array>,
		contentType: "application/octet-stream",
		contentLength: number
	) => Promise<void>;
};

export interface ManagedSnapshotSession {
	user: { id: string };
}

export interface ManagedSnapshotRouteDependencies {
	createId?: () => string;
	createStorage: () => SnapshotStorage;
	getProjectForUser: (
		userId: string,
		projectId: string
	) => Promise<{ id: string } | null>;
	getSession: (headers: Headers) => Promise<ManagedSnapshotSession | null>;
	managedSnapshotStore: ManagedSnapshotStore;
}

type ProjectAccess =
	| { ok: true; userId: string }
	| { ok: false; error: "Unauthorized" | "Not found"; status: 401 | 404 };

class ManagedSnapshotLengthError extends Error {}

class ManagedSnapshotDigestError extends Error {}

function createSnapshotDigestTransform(
	expectedByteSize: number,
	expectedDigest?: string
) {
	const hash = createHash("sha256");
	let receivedBytes = 0;
	let digest: string | null = null;
	const body = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			receivedBytes += chunk.byteLength;
			if (receivedBytes > expectedByteSize) {
				throw new ManagedSnapshotLengthError();
			}
			hash.update(chunk);
			controller.enqueue(chunk);
		},
		flush() {
			if (receivedBytes !== expectedByteSize) {
				throw new ManagedSnapshotLengthError();
			}
			digest = hash.digest("hex");
			if (expectedDigest && digest !== expectedDigest) {
				throw new ManagedSnapshotDigestError();
			}
		},
	});
	return { body, getDigest: () => digest };
}

function parseUploadLength(value: string | undefined) {
	if (!(value && uploadLengthPattern.test(value))) {
		return null;
	}
	const contentLength = Number(value);
	return Number.isSafeInteger(contentLength) ? contentLength : null;
}

type ManagedSnapshotUploadMetadata =
	| {
			ok: true;
			byteSize: number;
			fileName: string;
			idempotencyKey: string;
	  }
	| {
			ok: false;
			error:
				| "Invalid Managed Snapshot content length"
				| "Managed Snapshot exceeds the 100 MB limit"
				| "Invalid Managed Snapshot file name"
				| "Missing Managed Snapshot idempotency key";
			status: 400 | 413;
	  };

function readManagedSnapshotUploadMetadata(
	headers: Headers
): ManagedSnapshotUploadMetadata {
	const byteSize = parseUploadLength(
		headers.get(managedSnapshotSizeHeader) ?? undefined
	);
	if (byteSize === null) {
		return {
			ok: false,
			error: "Invalid Managed Snapshot content length",
			status: 400,
		};
	}
	if (byteSize > maxManagedSnapshotBytes) {
		return {
			ok: false,
			error: "Managed Snapshot exceeds the 100 MB limit",
			status: 413,
		};
	}

	let decodedFileName: string | undefined;
	try {
		const encodedFileName = headers.get(managedSnapshotFileNameHeader);
		decodedFileName = encodedFileName
			? decodeURIComponent(encodedFileName)
			: undefined;
	} catch {
		return {
			ok: false,
			error: "Invalid Managed Snapshot file name",
			status: 400,
		};
	}
	const fileName = assetVersionFileNameSchema.safeParse(decodedFileName);
	if (!fileName.success) {
		return {
			ok: false,
			error: "Invalid Managed Snapshot file name",
			status: 400,
		};
	}
	const idempotencyKey = idempotencyKeySchema.safeParse(
		headers.get("idempotency-key")
	);
	if (!idempotencyKey.success) {
		return {
			ok: false,
			error: "Missing Managed Snapshot idempotency key",
			status: 400,
		};
	}
	return {
		ok: true,
		byteSize,
		fileName: fileName.data,
		idempotencyKey: idempotencyKey.data,
	};
}

function managedSnapshotUploadErrorResponse(c: Context, error: unknown) {
	if (error instanceof ManagedSnapshotLengthError) {
		return c.json(
			serializePublicApiError("Invalid Managed Snapshot content length"),
			400
		);
	}
	if (error instanceof ManagedSnapshotDigestError) {
		return c.json(
			serializePublicApiError("Managed Snapshot digest could not be verified"),
			422
		);
	}
	return c.json(serializePublicApiError("Managed Snapshot upload failed"), 503);
}

function safeDownloadFileName(fileName: string) {
	return encodeURIComponent(fileName).replace(
		/['()*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
	);
}

async function resolveProjectAccess(
	headers: Headers,
	projectIdInput: string,
	dependencies: ManagedSnapshotRouteDependencies
): Promise<ProjectAccess> {
	const session = await dependencies.getSession(headers);
	if (!session?.user) {
		return { ok: false, error: "Unauthorized", status: 401 };
	}
	const projectId = projectIdSchema.safeParse(projectIdInput);
	if (!projectId.success) {
		return { ok: false, error: "Not found", status: 404 };
	}
	const project = await dependencies.getProjectForUser(
		session.user.id,
		projectId.data
	);
	return project
		? { ok: true, userId: session.user.id }
		: { ok: false, error: "Not found", status: 404 };
}

function accessError(
	c: Context,
	access: Extract<ProjectAccess, { ok: false }>
) {
	c.header("Cache-Control", "private, no-store");
	return c.json(serializePublicApiError(access.error), access.status);
}

async function deleteObjectSafely(storage: SnapshotStorage, objectKey: string) {
	try {
		await storage.delete(objectKey);
	} catch {
		// The original request result stays authoritative when cleanup also fails.
	}
}

async function uploadManagedSnapshot(
	c: Context,
	projectId: string,
	assetVersionId: string,
	userId: string,
	dependencies: ManagedSnapshotRouteDependencies
) {
	const target = await dependencies.managedSnapshotStore.getAssetVersionForUser(
		userId,
		projectId,
		assetVersionId
	);
	if (!target) {
		return c.json(serializePublicApiError("Not found"), 404);
	}

	const metadata = readManagedSnapshotUploadMetadata(c.req.raw.headers);
	if (!metadata.ok) {
		return c.json(serializePublicApiError(metadata.error), metadata.status);
	}
	const { body } = c.req.raw;
	if (!body) {
		return c.json(
			serializePublicApiError("Missing Managed Snapshot content"),
			400
		);
	}

	const id = dependencies.createId?.() ?? crypto.randomUUID();
	const objectKey = createProjectManagedSnapshotObjectKey(
		projectId,
		target.assetRecordId,
		assetVersionId,
		id
	);
	const integrity = createSnapshotDigestTransform(metadata.byteSize);
	let storage: SnapshotStorage | undefined;
	let persistenceAttempted = false;
	try {
		storage = dependencies.createStorage();
		await storage.put(
			objectKey,
			body.pipeThrough(integrity.body),
			"application/octet-stream",
			metadata.byteSize
		);
		const sha256 = integrity.getDigest();
		if (!sha256) {
			throw new ManagedSnapshotDigestError();
		}

		persistenceAttempted = true;
		const result = await dependencies.managedSnapshotStore.create(userId, {
			assetRecordId: target.assetRecordId,
			assetVersionId,
			byteSize: metadata.byteSize,
			fileName: metadata.fileName,
			id,
			idempotencyKey: metadata.idempotencyKey,
			objectKey,
			projectId,
			sha256,
		});
		if (!result) {
			await deleteObjectSafely(storage, objectKey);
			return c.json(serializePublicApiError("Not found"), 404);
		}
		if (result.kind === "idempotency-conflict") {
			await deleteObjectSafely(storage, objectKey);
			return c.json(
				serializePublicApiError("Managed Snapshot idempotency conflict"),
				409
			);
		}
		if (result.kind === "existing") {
			await deleteObjectSafely(storage, objectKey);
		}
		return c.json(managedSnapshotSummarySchema.parse(result.snapshot), {
			status: result.kind === "created" ? 201 : 200,
		});
	} catch (error) {
		if (!persistenceAttempted && storage) {
			await deleteObjectSafely(storage, objectKey);
		}
		return managedSnapshotUploadErrorResponse(c, error);
	}
}

async function downloadManagedSnapshot(
	c: Context,
	projectId: string,
	snapshotId: string,
	userId: string,
	dependencies: ManagedSnapshotRouteDependencies
) {
	const id = managedSnapshotIdSchema.safeParse(snapshotId);
	if (!id.success) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	const fileRecord = await dependencies.managedSnapshotStore.getFileRecord(
		userId,
		projectId,
		id.data
	);
	if (!fileRecord) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	const objectKey = managedSnapshotObjectKeySchema.safeParse(
		fileRecord.objectKey
	);
	if (!objectKey.success) {
		return c.json(
			serializePublicApiError("Managed Snapshot integrity check failed"),
			502
		);
	}
	const object = await dependencies.createStorage().get(objectKey.data);
	if (!object) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	if (
		object.contentType !== "application/octet-stream" ||
		object.contentLength !== fileRecord.byteSize
	) {
		await object.body.cancel();
		return c.json(
			serializePublicApiError("Managed Snapshot integrity check failed"),
			502
		);
	}
	const verifier = createSnapshotDigestTransform(
		fileRecord.byteSize,
		fileRecord.sha256
	);
	c.header("Cache-Control", "private, no-store");
	c.header("Content-Type", "application/octet-stream");
	c.header("Content-Length", fileRecord.byteSize.toString());
	c.header(
		"Content-Disposition",
		`attachment; filename*=UTF-8''${safeDownloadFileName(fileRecord.fileName)}`
	);
	c.header("X-Content-Type-Options", "nosniff");
	return c.body(object.body.pipeThrough(verifier.body));
}

export function mountManagedSnapshotRoutes(
	app: Hono,
	dependencies: ManagedSnapshotRouteDependencies
) {
	app.post(
		"/api/projects/:projectId/asset-versions/:assetVersionId/managed-snapshots",
		async (c) => {
			c.header("Cache-Control", "private, no-store");
			const projectId = c.req.param("projectId");
			const access = await resolveProjectAccess(
				c.req.raw.headers,
				projectId,
				dependencies
			);
			if (!access.ok) {
				return accessError(c, access);
			}
			const assetVersionId = assetVersionIdSchema.safeParse(
				c.req.param("assetVersionId")
			);
			if (!assetVersionId.success) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			return uploadManagedSnapshot(
				c,
				projectId,
				assetVersionId.data,
				access.userId,
				dependencies
			);
		}
	);

	app.get(
		"/api/projects/:projectId/asset-versions/:assetVersionId/managed-snapshots",
		async (c) => {
			c.header("Cache-Control", "private, no-store");
			const access = await resolveProjectAccess(
				c.req.raw.headers,
				c.req.param("projectId"),
				dependencies
			);
			if (!access.ok) {
				return accessError(c, access);
			}
			const assetVersionId = assetVersionIdSchema.safeParse(
				c.req.param("assetVersionId")
			);
			if (!assetVersionId.success) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			const snapshots = await dependencies.managedSnapshotStore.list(
				access.userId,
				c.req.param("projectId"),
				assetVersionId.data
			);
			if (!snapshots) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			return c.json(
				snapshots.map((snapshot) =>
					managedSnapshotSummarySchema.parse(snapshot)
				)
			);
		}
	);

	app.get(
		"/api/projects/:projectId/managed-snapshots/:snapshotId/content",
		async (c) => {
			c.header("Cache-Control", "private, no-store");
			const access = await resolveProjectAccess(
				c.req.raw.headers,
				c.req.param("projectId"),
				dependencies
			);
			if (!access.ok) {
				return accessError(c, access);
			}
			return downloadManagedSnapshot(
				c,
				c.req.param("projectId"),
				c.req.param("snapshotId"),
				access.userId,
				dependencies
			);
		}
	);
}
