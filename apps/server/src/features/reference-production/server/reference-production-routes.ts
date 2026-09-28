import { Buffer } from "node:buffer";
import {
	assetVersionContentTypeSchema,
	assetVersionFileNameSchema,
} from "@sprite-anvil/api/asset-record-tracking";
import type {
	ReferenceBoardUploadInput,
	ReferenceProductionStore,
} from "@sprite-anvil/api/reference-production";
import {
	referenceBoardMetadataSchema,
	referenceBoardUploadInputSchema,
} from "@sprite-anvil/api/reference-production";
import type { Context, Hono } from "hono";
import z from "zod";
import type { TwoDVisualAssetStorage } from "../../../cloudflare";
import { createProjectReferenceBoardObjectKey } from "../../../cloudflare";
import { serializePublicApiError } from "../../../output-contracts";
import {
	AssetVersionContentLengthError,
	AssetVersionIntegrityError,
	createAssetVersionIntegrityTransform,
} from "../../asset-versions/server/asset-version-integrity";

const projectIdSchema = z.uuid();
const assetRecordIdSchema = z.uuid();
const referenceIdSchema = z.uuid();
const uploadLengthHeader = "x-reference-board-size";
const fileNameHeader = "x-reference-board-file-name";
const metadataHeader = "x-reference-board-metadata";
const uploadLengthPattern = /^[1-9]\d*$/;
const metadataEncodingPattern = /^[A-Za-z0-9_-]+$/;
const maxUploadBytes = 5 * 1024 * 1024;

export interface ReferenceBoardSession {
	user: { id: string };
}

export interface ReferenceProductionRouteDependencies {
	createId?: () => string;
	createStorage: () => TwoDVisualAssetStorage;
	getProjectForUser: (
		userId: string,
		projectId: string
	) => Promise<{ id: string } | null>;
	getSession: (headers: Headers) => Promise<ReferenceBoardSession | null>;
	referenceProductionStore: ReferenceProductionStore;
}

type ProjectAccess =
	| { ok: true; userId: string }
	| { ok: false; error: "Unauthorized" | "Not found"; status: 401 | 404 };

async function resolveProjectAccess(
	headers: Headers,
	projectIdInput: string,
	dependencies: ReferenceProductionRouteDependencies
): Promise<ProjectAccess> {
	const session = await dependencies.getSession(headers);
	if (!session?.user) {
		return { ok: false, error: "Unauthorized", status: 401 };
	}
	const parsedProjectId = projectIdSchema.safeParse(projectIdInput);
	if (!parsedProjectId.success) {
		return { ok: false, error: "Not found", status: 404 };
	}
	const project = await dependencies.getProjectForUser(
		session.user.id,
		parsedProjectId.data
	);
	return project
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
	return Number.isSafeInteger(contentLength) && contentLength <= maxUploadBytes
		? contentLength
		: null;
}

function parseMetadata(value: string | undefined) {
	if (
		!(value && value.length <= 12_000 && metadataEncodingPattern.test(value))
	) {
		return null;
	}
	try {
		const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
		const result = referenceBoardMetadataSchema.safeParse(parsed);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

type UploadHeadersResult =
	| {
			contentLength: number;
			contentType: (typeof assetVersionContentTypeSchema)["_output"];
			fileName: string;
			id: string;
			metadata: ReturnType<typeof referenceBoardMetadataSchema.parse>;
			ok: true;
	  }
	| {
			message:
				| "Unsupported Reference image type"
				| "Invalid Reference image content length"
				| "Invalid Reference image file name"
				| "Missing Reference upload idempotency key"
				| "Invalid Reference purpose or transfer rules";
			ok: false;
			status: 400 | 415;
	  };

function parseUploadHeaders(headers: Headers): UploadHeadersResult {
	const contentType = assetVersionContentTypeSchema.safeParse(
		headers.get("content-type")?.split(";")[0]?.trim()
	);
	if (!contentType.success) {
		return {
			message: "Unsupported Reference image type",
			ok: false,
			status: 415,
		};
	}
	const contentLength = parseUploadLength(
		headers.get(uploadLengthHeader) ?? undefined
	);
	if (contentLength === null) {
		return {
			message: "Invalid Reference image content length",
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
			message: "Invalid Reference image file name",
			ok: false,
			status: 400,
		};
	}
	const fileName = assetVersionFileNameSchema.safeParse(decodedFileName);
	if (!fileName.success) {
		return {
			message: "Invalid Reference image file name",
			ok: false,
			status: 400,
		};
	}
	const id = z.uuid().safeParse(headers.get("idempotency-key"));
	if (!id.success) {
		return {
			message: "Missing Reference upload idempotency key",
			ok: false,
			status: 400,
		};
	}
	const metadata = parseMetadata(headers.get(metadataHeader) ?? undefined);
	if (!metadata) {
		return {
			message: "Invalid Reference purpose or transfer rules",
			ok: false,
			status: 400,
		};
	}
	return {
		contentLength,
		contentType: contentType.data,
		fileName: fileName.data,
		id: id.data,
		metadata,
		ok: true,
	};
}

function uploadFailureResponse(c: Context, error: unknown) {
	if (error instanceof AssetVersionContentLengthError) {
		return c.json(
			serializePublicApiError("Invalid Reference image content length"),
			400
		);
	}
	if (error instanceof AssetVersionIntegrityError) {
		return c.json(
			serializePublicApiError("Invalid Reference image content"),
			400
		);
	}
	return c.json(serializePublicApiError("Reference image upload failed"), 503);
}

function errorStatus(
	reason: "conflict" | "context_override_required" | "not_found"
) {
	if (reason === "not_found") {
		return 404;
	}
	return reason === "conflict" ? 409 : 412;
}

function errorMessage(
	reason: "conflict" | "context_override_required" | "not_found"
) {
	if (reason === "not_found") {
		return "Not found";
	}
	return reason === "conflict"
		? "Reference idempotency conflict"
		: "A Context Override rationale is required";
}

async function uploadReferenceImage(
	c: Context,
	projectId: string,
	assetRecordId: string,
	userId: string,
	dependencies: ReferenceProductionRouteDependencies
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
			serializePublicApiError("Missing Reference image content"),
			400
		);
	}

	const uploadAttemptId = dependencies.createId?.() ?? crypto.randomUUID();
	const objectKey = createProjectReferenceBoardObjectKey(
		projectId,
		assetRecordId,
		uploadHeaders.id,
		uploadAttemptId
	);
	const integrity = createAssetVersionIntegrityTransform(
		uploadHeaders.contentType,
		uploadHeaders.contentLength
	);
	let storage: TwoDVisualAssetStorage | undefined;
	let objectStored = false;
	try {
		storage = dependencies.createStorage();
		await storage.put(
			objectKey,
			body.pipeThrough(integrity.body),
			uploadHeaders.contentType,
			uploadHeaders.contentLength
		);
		objectStored = true;
		const contentDigest = integrity.getContentDigest();
		if (!contentDigest) {
			throw new AssetVersionIntegrityError();
		}

		const input: ReferenceBoardUploadInput =
			referenceBoardUploadInputSchema.parse({
				assetRecordId,
				contentLength: uploadHeaders.contentLength,
				contentType: uploadHeaders.contentType,
				contentDigest,
				fileName: uploadHeaders.fileName,
				id: uploadHeaders.id,
				objectKey,
				projectId,
				...uploadHeaders.metadata,
			});
		const result = await dependencies.referenceProductionStore.createImage(
			userId,
			input
		);
		if (!result.ok) {
			await storage.delete(objectKey);
			objectStored = false;
			return c.json(
				serializePublicApiError(errorMessage(result.reason)),
				errorStatus(result.reason)
			);
		}
		if (result.kind === "existing") {
			await storage.delete(objectKey);
			objectStored = false;
		}
		c.header("Cache-Control", "private, no-store");
		return c.json(result.value, result.kind === "created" ? 201 : 200);
	} catch (error) {
		if (objectStored && storage) {
			try {
				await storage.delete(objectKey);
			} catch {
				// The upload remains failed closed when cleanup is unavailable.
			}
		}
		return uploadFailureResponse(c, error);
	}
}

export function mountReferenceProductionRoutes(
	app: Hono,
	dependencies: ReferenceProductionRouteDependencies
) {
	app.post(
		"/api/projects/:projectId/assets/:assetRecordId/references",
		async (c) => {
			const access = await resolveProjectAccess(
				c.req.raw.headers,
				c.req.param("projectId"),
				dependencies
			);
			if (!access.ok) {
				return accessError(c, access);
			}
			const assetRecordId = assetRecordIdSchema.safeParse(
				c.req.param("assetRecordId")
			);
			if (!assetRecordId.success) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			return uploadReferenceImage(
				c,
				c.req.param("projectId"),
				assetRecordId.data,
				access.userId,
				dependencies
			);
		}
	);

	app.get(
		"/api/projects/:projectId/assets/:assetRecordId/references/:referenceId/image",
		async (c) => {
			const access = await resolveProjectAccess(
				c.req.raw.headers,
				c.req.param("projectId"),
				dependencies
			);
			if (!access.ok) {
				return accessError(c, access);
			}
			const assetRecordId = assetRecordIdSchema.safeParse(
				c.req.param("assetRecordId")
			);
			const referenceId = referenceIdSchema.safeParse(
				c.req.param("referenceId")
			);
			if (!(assetRecordId.success && referenceId.success)) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			const file = await dependencies.referenceProductionStore.getImageFile(
				access.userId,
				c.req.param("projectId"),
				assetRecordId.data,
				referenceId.data
			);
			if (!file) {
				return c.json(serializePublicApiError("Not found"), 404);
			}

			const image = await dependencies.createStorage().get(file.objectKey);
			if (
				!image ||
				image.contentType !== file.contentType ||
				(image.contentLength !== undefined &&
					image.contentLength !== file.contentLength)
			) {
				await image?.body.cancel();
				return c.json(
					serializePublicApiError("Reference image unavailable"),
					503
				);
			}
			c.header("Cache-Control", "private, no-store");
			c.header("Content-Type", file.contentType);
			c.header("Content-Length", String(file.contentLength));
			c.header("X-Content-Type-Options", "nosniff");
			return c.body(image.body, 200);
		}
	);
}
