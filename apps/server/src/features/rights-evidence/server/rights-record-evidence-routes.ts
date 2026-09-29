import { createHash } from "node:crypto";
import { assetSourceFileNameSchema } from "@sprite-anvil/api/asset-record-tracking";
import type { RightsRecordStore } from "@sprite-anvil/api/rights-records";
import {
	type RightsRecordEvidenceFile,
	type RightsRecordEvidenceFileCreateInput,
	rightsRecordEvidenceFileCreateInputSchema,
	rightsRecordEvidenceFileLimitBytes,
	rightsRecordEvidenceFileSchema,
	rightsRecordFieldsSchema,
	rightsRecordStoredEvidenceFileSchema,
} from "@sprite-anvil/api/rights-records";
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import z from "zod";
import type { createStorage } from "../../../cloudflare";
import {
	createProjectRightsRecordEvidenceObjectKey,
	rightsRecordEvidenceObjectKeySchema,
} from "../../../cloudflare";
import { serializePublicApiError } from "../../../output-contracts";

const idSchema = z.uuid();
const opaqueStorageContentType = "application/octet-stream";
const multipartOverheadBytes = 64 * 1024;
const rightsRecordEvidencePath =
	"/api/projects/:projectId/asset-records/:assetRecordId/rights-records/:rightsRecordId/evidence-file";

type Storage = Pick<ReturnType<typeof createStorage>, "delete" | "get" | "put">;

export interface RightsRecordEvidenceSession {
	user: { id: string };
}

export interface RightsRecordEvidenceRouteDependencies {
	createStorage: () => Storage;
	getSession: (headers: Headers) => Promise<RightsRecordEvidenceSession | null>;
	rightsRecordStore: Pick<
		RightsRecordStore,
		| "canAccessAssetRecord"
		| "createRevisionWithEvidenceFile"
		| "getEvidenceFile"
	>;
}

type RightsRecordEvidenceAccess =
	| { ok: true; assetRecordId: string; projectId: string; userId: string }
	| { ok: false; response: Response };

async function resolveEvidenceAccess(
	c: Context,
	dependencies: RightsRecordEvidenceRouteDependencies
): Promise<RightsRecordEvidenceAccess> {
	c.header("Cache-Control", "private, no-store");
	const session = await dependencies.getSession(c.req.raw.headers);
	if (!session) {
		return {
			ok: false,
			response: c.json(serializePublicApiError("Unauthorized"), 401),
		};
	}
	const projectId = idSchema.safeParse(c.req.param("projectId"));
	const assetRecordId = idSchema.safeParse(c.req.param("assetRecordId"));
	if (!(projectId.success && assetRecordId.success)) {
		return {
			ok: false,
			response: c.json(serializePublicApiError("Not found"), 404),
		};
	}
	const canAccess = await dependencies.rightsRecordStore.canAccessAssetRecord(
		session.user.id,
		projectId.data,
		assetRecordId.data
	);
	if (!canAccess) {
		return {
			ok: false,
			response: c.json(serializePublicApiError("Not found"), 404),
		};
	}
	return {
		assetRecordId: assetRecordId.data,
		ok: true,
		projectId: projectId.data,
		userId: session.user.id,
	};
}

function evidenceObjectFingerprint(file: {
	fileName: string;
	sha256: string;
	sourceContentType: string;
}) {
	return createHash("sha256")
		.update(file.fileName)
		.update("\0")
		.update(file.sourceContentType)
		.update("\0")
		.update(file.sha256)
		.digest("hex");
}

function encodeDownloadFileName(fileName: string) {
	return encodeURIComponent(fileName).replace(/[!'()*]/g, (character) => {
		const codePoint = character.codePointAt(0);
		return codePoint === undefined
			? character
			: `%${codePoint.toString(16).toUpperCase().padStart(2, "0")}`;
	});
}

function verifyEvidenceFileStream(
	body: ReadableStream<Uint8Array>,
	contentLength: number,
	expectedSha256: string
) {
	const hash = createHash("sha256");
	let actualLength = 0;
	return body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				actualLength += chunk.byteLength;
				if (actualLength > contentLength) {
					throw new Error("Rights Record evidence file integrity check failed");
				}
				hash.update(chunk);
				controller.enqueue(chunk);
			},
			flush() {
				if (
					actualLength !== contentLength ||
					hash.digest("hex") !== expectedSha256
				) {
					throw new Error("Rights Record evidence file integrity check failed");
				}
			},
		})
	);
}

interface EvidenceUploadParseFailure {
	error:
		| "Invalid Rights Record evidence file"
		| "Rights Record evidence file exceeds the 5 MiB limit";
	ok: false;
	status: 400 | 413;
}
interface EvidenceUploadFormData {
	get: (name: string) => unknown;
}
type EvidenceUploadParseResult =
	| {
			bytes: ArrayBuffer;
			evidenceFile: RightsRecordEvidenceFile;
			ok: true;
			revisionInput: RightsRecordEvidenceFileCreateInput;
	  }
	| EvidenceUploadParseFailure;

function uploadParseError(
	status: 400 | 413,
	error: EvidenceUploadParseFailure["error"]
): EvidenceUploadParseFailure {
	return { error, ok: false, status };
}

async function parseEvidenceUpload(
	formData: EvidenceUploadFormData,
	access: Extract<RightsRecordEvidenceAccess, { ok: true }>,
	rightsRecordId: string
): Promise<EvidenceUploadParseResult> {
	const recordValue = formData.get("rightsRecord");
	const upload = formData.get("evidenceFile");
	if (typeof recordValue !== "string" || !(upload instanceof File)) {
		return uploadParseError(400, "Invalid Rights Record evidence file");
	}

	let rawRecord: unknown;
	try {
		rawRecord = JSON.parse(recordValue);
	} catch {
		return uploadParseError(400, "Invalid Rights Record evidence file");
	}
	const fields = rightsRecordFieldsSchema.safeParse(rawRecord);
	if (
		!fields.success ||
		fields.data.id !== rightsRecordId ||
		fields.data.projectId !== access.projectId ||
		fields.data.assetRecordId !== access.assetRecordId
	) {
		return uploadParseError(400, "Invalid Rights Record evidence file");
	}
	if (upload.size === 0 || upload.size > rightsRecordEvidenceFileLimitBytes) {
		return uploadParseError(
			413,
			"Rights Record evidence file exceeds the 5 MiB limit"
		);
	}

	const fileName = assetSourceFileNameSchema.safeParse(upload.name);
	const sourceContentType =
		upload.type.trim().toLowerCase() || opaqueStorageContentType;
	const bytes = await upload.arrayBuffer();
	const evidenceFile = rightsRecordEvidenceFileSchema.safeParse({
		contentLength: bytes.byteLength,
		fileName: fileName.success ? fileName.data : upload.name,
		sha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"),
		sourceContentType,
	});
	if (!evidenceFile.success) {
		return uploadParseError(400, "Invalid Rights Record evidence file");
	}
	const revisionInput = rightsRecordEvidenceFileCreateInputSchema.safeParse({
		...fields.data,
		evidenceFile: evidenceFile.data,
	});
	if (!revisionInput.success) {
		return uploadParseError(400, "Invalid Rights Record evidence file");
	}
	return {
		bytes,
		evidenceFile: evidenceFile.data,
		ok: true,
		revisionInput: revisionInput.data,
	};
}

async function uploadEvidenceFile(
	c: Context,
	dependencies: RightsRecordEvidenceRouteDependencies
) {
	const access = await resolveEvidenceAccess(c, dependencies);
	if (!access.ok) {
		return access.response;
	}
	const rightsRecordId = idSchema.safeParse(c.req.param("rightsRecordId"));
	if (!rightsRecordId.success) {
		return c.json(serializePublicApiError("Not found"), 404);
	}

	const formData = await c.req.raw.formData().catch(() => null);
	if (!formData) {
		return c.json(
			serializePublicApiError("Invalid Rights Record evidence file"),
			400
		);
	}
	const parsedUpload = await parseEvidenceUpload(
		formData,
		access,
		rightsRecordId.data
	);
	if (!parsedUpload.ok) {
		return c.json(
			serializePublicApiError(parsedUpload.error),
			parsedUpload.status
		);
	}

	const objectKey = createProjectRightsRecordEvidenceObjectKey(
		access.projectId,
		access.assetRecordId,
		rightsRecordId.data,
		evidenceObjectFingerprint(parsedUpload.evidenceFile)
	);
	const storedEvidenceFile = rightsRecordStoredEvidenceFileSchema.parse({
		...parsedUpload.evidenceFile,
		objectKey,
	});
	const storage = dependencies.createStorage();
	await storage.put(
		objectKey,
		new Blob([parsedUpload.bytes]).stream(),
		opaqueStorageContentType,
		parsedUpload.bytes.byteLength
	);

	const result =
		await dependencies.rightsRecordStore.createRevisionWithEvidenceFile(
			access.userId,
			{ ...parsedUpload.revisionInput, evidenceFile: storedEvidenceFile }
		);
	if (!result.ok) {
		const existingFile = await dependencies.rightsRecordStore.getEvidenceFile(
			access.userId,
			access.projectId,
			access.assetRecordId,
			rightsRecordId.data
		);
		if (existingFile?.objectKey !== objectKey) {
			await storage.delete(objectKey);
		}
		return c.json(
			serializePublicApiError(
				result.reason === "not_found"
					? "Not found"
					: "Rights Record evidence idempotency conflict"
			),
			result.reason === "not_found" ? 404 : 409
		);
	}
	return c.json(result.record, 201);
}

export function mountRightsRecordEvidenceRoutes(
	app: Hono,
	dependencies: RightsRecordEvidenceRouteDependencies
) {
	app.post(
		rightsRecordEvidencePath,
		bodyLimit({
			maxSize: rightsRecordEvidenceFileLimitBytes + multipartOverheadBytes,
			onError: (c) =>
				c.json(
					serializePublicApiError(
						"Rights Record evidence file exceeds the 5 MiB limit"
					),
					413
				),
		}),
		(c) => uploadEvidenceFile(c, dependencies)
	);

	app.get(rightsRecordEvidencePath, async (c) => {
		const access = await resolveEvidenceAccess(c, dependencies);
		if (!access.ok) {
			return access.response;
		}
		const rightsRecordId = idSchema.safeParse(c.req.param("rightsRecordId"));
		if (!rightsRecordId.success) {
			return c.json(serializePublicApiError("Not found"), 404);
		}
		const file = await dependencies.rightsRecordStore.getEvidenceFile(
			access.userId,
			access.projectId,
			access.assetRecordId,
			rightsRecordId.data
		);
		if (!file) {
			return c.json(serializePublicApiError("Not found"), 404);
		}
		const objectKey = rightsRecordEvidenceObjectKeySchema.safeParse(
			file.objectKey
		);
		if (!objectKey.success) {
			throw new Error("Rights Record evidence file unavailable");
		}
		const object = await dependencies.createStorage().get(objectKey.data);
		if (
			!object ||
			object.contentType !== opaqueStorageContentType ||
			(object.contentLength !== undefined &&
				object.contentLength !== file.contentLength)
		) {
			await object?.body.cancel();
			throw new Error("Rights Record evidence file unavailable");
		}
		c.header(
			"Content-Disposition",
			`attachment; filename*=UTF-8''${encodeDownloadFileName(file.fileName)}`
		);
		c.header("Content-Length", String(file.contentLength));
		c.header("Content-Type", opaqueStorageContentType);
		c.header("X-Content-Type-Options", "nosniff");
		return c.body(
			verifyEvidenceFileStream(object.body, file.contentLength, file.sha256),
			200
		);
	});
}
