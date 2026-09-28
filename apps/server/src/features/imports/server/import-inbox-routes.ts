import { assetSourceFileNameSchema } from "@sprite-anvil/api/asset-record-tracking";
import type { ImportInboxStore } from "@sprite-anvil/api/import-inbox";
import { importInboxSourceContentTypeSchema } from "@sprite-anvil/api/import-inbox";
import type { Context, Hono } from "hono";
import z from "zod";
import type { createStorage } from "../../../cloudflare";
import {
	createProjectImportInboxObjectKey,
	importInboxObjectKeySchema,
} from "../../../cloudflare";
import { serializePublicApiError } from "../../../output-contracts";
import {
	createImportInboxIntegrityTransform,
	ImportInboxContentLengthError,
	ImportInboxIntegrityError,
	verifyImportInboxStream,
} from "./import-inbox-integrity";

const projectIdSchema = z.uuid();
const entryIdSchema = z.uuid();
const idempotencyKeySchema = z.uuid();
const uploadLengthPattern = /^(0|[1-9]\d*)$/;
const uploadLengthHeader = "x-import-inbox-size";
const fileNameHeader = "x-import-inbox-file-name";
const sourceContentTypeHeader = "x-import-inbox-source-type";
const opaqueStorageContentType = "application/octet-stream";

type Storage = Pick<ReturnType<typeof createStorage>, "delete" | "get" | "put">;

export interface ImportInboxSession {
	user: { id: string };
}

export interface ImportInboxRouteDependencies {
	createId?: () => string;
	createStorage: () => Storage;
	getProjectForUser: (
		userId: string,
		projectId: string
	) => Promise<{ id: string } | null>;
	getSession: (headers: Headers) => Promise<ImportInboxSession | null>;
	importInboxStore: ImportInboxStore;
}

type ProjectAccess =
	| { ok: true; userId: string }
	| { ok: false; error: "Unauthorized" | "Not found"; status: 401 | 404 };

async function resolveProjectAccess(
	headers: Headers,
	projectIdInput: string,
	dependencies: ImportInboxRouteDependencies
): Promise<ProjectAccess> {
	const session = await dependencies.getSession(headers);
	if (!session?.user) {
		return { ok: false, error: "Unauthorized", status: 401 };
	}
	const projectId = projectIdSchema.safeParse(projectIdInput);
	if (!projectId.success) {
		return { ok: false, error: "Not found", status: 404 };
	}
	const projectRecord = await dependencies.getProjectForUser(
		session.user.id,
		projectId.data
	);
	return projectRecord
		? { ok: true, userId: session.user.id }
		: { ok: false, error: "Not found", status: 404 };
}

function accessError(c: Context, access: Exclude<ProjectAccess, { ok: true }>) {
	c.header("Cache-Control", "private, no-store");
	return c.json(serializePublicApiError(access.error), access.status);
}

function parseUploadLength(value: string | undefined) {
	if (!(value && uploadLengthPattern.test(value))) {
		return null;
	}
	const contentLength = Number(value);
	return Number.isSafeInteger(contentLength) ? contentLength : null;
}

type ImportInboxUploadError =
	| "Unsupported Import Inbox upload content type"
	| "Invalid Import Inbox file content length"
	| "Invalid Import Inbox file name"
	| "Invalid Import Inbox source content type"
	| "Missing Import Inbox idempotency key";

type UploadHeadersResult =
	| {
			contentLength: number;
			fileName: string;
			id: string;
			ok: true;
			sourceContentType: string;
	  }
	| {
			message: ImportInboxUploadError;
			ok: false;
			status: 400 | 415;
	  };

function parseUploadHeaders(headers: Headers): UploadHeadersResult {
	const requestContentType = headers
		.get("content-type")
		?.split(";")[0]
		?.trim()
		.toLowerCase();
	if (requestContentType !== opaqueStorageContentType) {
		return {
			message: "Unsupported Import Inbox upload content type",
			ok: false,
			status: 415,
		};
	}

	const contentLength = parseUploadLength(
		headers.get(uploadLengthHeader) ?? undefined
	);
	if (contentLength === null) {
		return {
			message: "Invalid Import Inbox file content length",
			ok: false,
			status: 400,
		};
	}

	let decodedFileName: string | undefined;
	try {
		const encodedFileName = headers.get(fileNameHeader) ?? undefined;
		decodedFileName = encodedFileName
			? decodeURIComponent(encodedFileName)
			: undefined;
	} catch {
		return {
			message: "Invalid Import Inbox file name",
			ok: false,
			status: 400,
		};
	}
	const fileName = assetSourceFileNameSchema.safeParse(decodedFileName);
	if (!fileName.success) {
		return {
			message: "Invalid Import Inbox file name",
			ok: false,
			status: 400,
		};
	}

	const rawSourceContentType =
		headers.get(sourceContentTypeHeader)?.trim().toLowerCase() ??
		opaqueStorageContentType;
	const sourceContentType = importInboxSourceContentTypeSchema.safeParse(
		rawSourceContentType || opaqueStorageContentType
	);
	if (!sourceContentType.success) {
		return {
			message: "Invalid Import Inbox source content type",
			ok: false,
			status: 400,
		};
	}

	const id = idempotencyKeySchema.safeParse(headers.get("idempotency-key"));
	if (!id.success) {
		return {
			message: "Missing Import Inbox idempotency key",
			ok: false,
			status: 400,
		};
	}
	return {
		contentLength,
		fileName: fileName.data,
		id: id.data,
		ok: true,
		sourceContentType: sourceContentType.data,
	};
}

function uploadFailureResponse(c: Context, error: unknown) {
	if (
		error instanceof ImportInboxContentLengthError ||
		error instanceof ImportInboxIntegrityError
	) {
		return c.json(
			serializePublicApiError("Invalid Import Inbox file content"),
			400
		);
	}
	return c.json(
		serializePublicApiError("Import Inbox file upload failed"),
		503
	);
}

function encodeDownloadFileName(fileName: string) {
	return encodeURIComponent(fileName).replace(/[!'()*]/g, (character) => {
		const codePoint = character.codePointAt(0);
		return codePoint === undefined
			? character
			: `%${codePoint.toString(16).toUpperCase().padStart(2, "0")}`;
	});
}

async function uploadImportInboxEntry(
	c: Context,
	projectId: string,
	userId: string,
	dependencies: ImportInboxRouteDependencies
) {
	const uploadHeaders = parseUploadHeaders(c.req.raw.headers);
	if (!uploadHeaders.ok) {
		return c.json(
			serializePublicApiError(uploadHeaders.message),
			uploadHeaders.status
		);
	}
	const { body } = c.req.raw;
	if (!body) {
		return c.json(
			serializePublicApiError("Missing Import Inbox file content"),
			400
		);
	}

	const uploadAttemptId = dependencies.createId?.() ?? crypto.randomUUID();
	const objectKey = createProjectImportInboxObjectKey(
		projectId,
		uploadHeaders.id,
		uploadAttemptId
	);
	const integrity = createImportInboxIntegrityTransform(
		uploadHeaders.contentLength
	);
	let storage: Storage | undefined;
	let objectStored = false;
	try {
		storage = dependencies.createStorage();
		await storage.put(
			objectKey,
			body.pipeThrough(integrity.body),
			opaqueStorageContentType,
			uploadHeaders.contentLength
		);
		objectStored = true;
		const sha256 = integrity.getSha256();
		if (!sha256) {
			throw new ImportInboxIntegrityError();
		}

		const result = await dependencies.importInboxStore.createEntry(userId, {
			contentLength: uploadHeaders.contentLength,
			fileName: uploadHeaders.fileName,
			id: uploadHeaders.id,
			objectKey,
			projectId,
			sha256,
			sourceContentType: uploadHeaders.sourceContentType,
		});
		if (!result.ok) {
			await storage.delete(objectKey);
			objectStored = false;
			return c.json(
				serializePublicApiError(
					result.reason === "not_found"
						? "Not found"
						: "Import Inbox idempotency conflict"
				),
				result.reason === "not_found" ? 404 : 409
			);
		}
		if (result.kind === "existing") {
			await storage.delete(objectKey);
			objectStored = false;
		}
		c.header("Cache-Control", "private, no-store");
		return c.json(result.value, result.kind === "created" ? 201 : 200);
	} catch (error) {
		if (storage && objectStored) {
			try {
				await storage.delete(objectKey);
			} catch {
				// A failed upload remains closed if object cleanup is unavailable.
			}
		}
		return uploadFailureResponse(c, error);
	}
}

export function mountImportInboxRoutes(
	app: Hono,
	dependencies: ImportInboxRouteDependencies
) {
	app.get("/api/projects/:projectId/import-inbox", async (c) => {
		c.header("Cache-Control", "private, no-store");
		const access = await resolveProjectAccess(
			c.req.raw.headers,
			c.req.param("projectId"),
			dependencies
		);
		if (!access.ok) {
			return accessError(c, access);
		}
		const entries = await dependencies.importInboxStore.listEntries(
			access.userId,
			c.req.param("projectId")
		);
		if (!entries) {
			return c.json(serializePublicApiError("Not found"), 404);
		}
		return c.json(entries);
	});

	app.post("/api/projects/:projectId/import-inbox", async (c) => {
		c.header("Cache-Control", "private, no-store");
		const access = await resolveProjectAccess(
			c.req.raw.headers,
			c.req.param("projectId"),
			dependencies
		);
		if (!access.ok) {
			return accessError(c, access);
		}
		return uploadImportInboxEntry(
			c,
			c.req.param("projectId"),
			access.userId,
			dependencies
		);
	});

	app.get("/api/projects/:projectId/import-inbox/:entryId/file", async (c) => {
		c.header("Cache-Control", "private, no-store");
		const access = await resolveProjectAccess(
			c.req.raw.headers,
			c.req.param("projectId"),
			dependencies
		);
		if (!access.ok) {
			return accessError(c, access);
		}
		const entryId = entryIdSchema.safeParse(c.req.param("entryId"));
		if (!entryId.success) {
			return c.json(serializePublicApiError("Not found"), 404);
		}
		const file = await dependencies.importInboxStore.getFileRecord(
			access.userId,
			c.req.param("projectId"),
			entryId.data
		);
		if (!file) {
			return c.json(serializePublicApiError("Not found"), 404);
		}
		const objectKey = importInboxObjectKeySchema.safeParse(file.objectKey);
		if (!objectKey.success) {
			return c.json(
				serializePublicApiError("Import Inbox file unavailable"),
				503
			);
		}
		let object: Awaited<ReturnType<Storage["get"]>>;
		try {
			object = await dependencies.createStorage().get(objectKey.data);
		} catch {
			return c.json(
				serializePublicApiError("Import Inbox file unavailable"),
				503
			);
		}
		if (
			!object ||
			object.contentType !== opaqueStorageContentType ||
			(object.contentLength !== undefined &&
				object.contentLength !== file.contentLength)
		) {
			await object?.body.cancel();
			return c.json(
				serializePublicApiError("Import Inbox file unavailable"),
				503
			);
		}
		c.header(
			"Content-Disposition",
			`attachment; filename*=UTF-8''${encodeDownloadFileName(file.fileName)}`
		);
		c.header("Content-Length", String(file.contentLength));
		c.header("Content-Type", opaqueStorageContentType);
		c.header("X-Content-Type-Options", "nosniff");
		return c.body(
			verifyImportInboxStream(object.body, file.contentLength, file.sha256),
			200
		);
	});
}
