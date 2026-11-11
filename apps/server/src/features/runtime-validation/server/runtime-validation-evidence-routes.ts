import { createHash } from "node:crypto";
import { assetSourceFileNameSchema } from "@sprite-anvil/api/asset-file-contracts";
import {
	IdempotencyConflictError,
	idempotencyKeySchema,
	RetryablePublicationError,
} from "@sprite-anvil/api/record-publication";
import {
	type RuntimeValidationFileEvidenceInput,
	runtimeValidationEvidenceFileLimitBytes,
	runtimeValidationEvidenceSourceSchema,
	runtimeValidationFileEvidenceKindSchema,
} from "@sprite-anvil/api/runtime-validation";
import type { RuntimeValidationStore } from "@sprite-anvil/api/runtime-validation-store";
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import z from "zod";
import type { createStorage } from "../../../cloudflare";
import {
	createProjectRuntimeValidationEvidenceObjectKey,
	runtimeValidationEvidenceObjectKeySchema,
} from "../../../cloudflare";
import {
	type PublicApiError,
	serializePublicApiError,
} from "../../../output-contracts";

const idSchema = z.uuid();
const opaqueStorageContentType = "application/octet-stream";
const multipartFramingLimitBytes = 64 * 1024;
const integrityError =
	"Runtime validation evidence integrity check failed" as const;
const uploadPath =
	"/api/projects/:projectId/runtime-validation-records/:recordId/evidence-file";
const downloadPath =
	"/api/projects/:projectId/runtime-validation-records/:recordId/evidence/:evidenceId/file";

type Storage = Pick<ReturnType<typeof createStorage>, "delete" | "get" | "put">;

export interface RuntimeValidationEvidenceRouteDependencies {
	createStorage: () => Storage;
	getSession: (headers: Headers) => Promise<{ user: { id: string } } | null>;
	runtimeValidationStore: Pick<
		RuntimeValidationStore,
		"addFileEvidence" | "get" | "getEvidenceFile"
	>;
}

async function resolveAccess(
	c: Context,
	dependencies: RuntimeValidationEvidenceRouteDependencies
) {
	c.header("Cache-Control", "private, no-store");
	const session = await dependencies.getSession(c.req.raw.headers);
	if (!session) {
		return {
			ok: false as const,
			response: c.json(serializePublicApiError("Unauthorized"), 401),
		};
	}
	const projectId = idSchema.safeParse(c.req.param("projectId"));
	const recordId = idSchema.safeParse(c.req.param("recordId"));
	if (!(projectId.success && recordId.success)) {
		return {
			ok: false as const,
			response: c.json(serializePublicApiError("Not found"), 404),
		};
	}
	return {
		ok: true as const,
		projectId: projectId.data,
		recordId: recordId.data,
		userId: session.user.id,
	};
}

const uploadFieldsSchema = z.object({
	idempotencyKey: idempotencyKeySchema,
	kind: runtimeValidationFileEvidenceKindSchema,
	source: runtimeValidationEvidenceSourceSchema,
});

type ParsedUpload =
	| {
			bytes: ArrayBuffer;
			fields: z.infer<typeof uploadFieldsSchema>;
			fileName: string;
			ok: true;
			sha256: string;
	  }
	| { error: PublicApiError; ok: false; status: 400 | 413 };

async function parseUpload(c: Context): Promise<ParsedUpload> {
	const invalid = (error: PublicApiError, status: 400 | 413 = 400) => ({
		error,
		ok: false as const,
		status,
	});
	const formData = await c.req.raw.formData().catch(() => null);
	if (!formData) {
		return invalid("Invalid runtime validation evidence upload");
	}
	const fields = uploadFieldsSchema.safeParse({
		idempotencyKey: formData.get("idempotencyKey"),
		kind: formData.get("kind"),
		source: formData.get("source"),
	});
	const upload = formData.get("file");
	if (!(fields.success && upload instanceof File)) {
		return invalid("Invalid runtime validation evidence upload");
	}
	const fileName = assetSourceFileNameSchema.safeParse(upload.name);
	if (!fileName.success) {
		return invalid("Invalid runtime validation evidence upload");
	}
	if (upload.size > runtimeValidationEvidenceFileLimitBytes) {
		return invalid(
			"Runtime validation evidence file exceeds the 5 MiB limit",
			413
		);
	}
	if (upload.size === 0) {
		return invalid("Invalid runtime validation evidence upload");
	}
	const bytes = await upload.arrayBuffer();
	return {
		bytes,
		fields: fields.data,
		fileName: fileName.data,
		ok: true,
		// The server computes the digest; the client never supplies one.
		sha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"),
	};
}

async function uploadEvidenceFile(
	c: Context,
	dependencies: RuntimeValidationEvidenceRouteDependencies
) {
	const access = await resolveAccess(c, dependencies);
	if (!access.ok) {
		return access.response;
	}
	// Refuse an unknown record or project before any object is written.
	const record = await dependencies.runtimeValidationStore.get(
		access.userId,
		access.projectId,
		access.recordId
	);
	if (!record) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	const upload = await parseUpload(c);
	if (!upload.ok) {
		return c.json(serializePublicApiError(upload.error), upload.status);
	}

	const objectKey = createProjectRuntimeValidationEvidenceObjectKey(
		access.projectId,
		access.recordId,
		crypto.randomUUID()
	);
	const storage = dependencies.createStorage();
	await storage.put(
		objectKey,
		new Blob([upload.bytes]).stream(),
		opaqueStorageContentType,
		upload.bytes.byteLength
	);

	const input: RuntimeValidationFileEvidenceInput = {
		file: {
			byteSize: upload.bytes.byteLength,
			fileName: upload.fileName,
			objectKey,
			sha256: upload.sha256,
		},
		idempotencyKey: upload.fields.idempotencyKey,
		kind: upload.fields.kind,
		projectId: access.projectId,
		recordId: access.recordId,
		source: upload.fields.source,
	};
	let result: Awaited<ReturnType<RuntimeValidationStore["addFileEvidence"]>> =
		null;
	try {
		result = await dependencies.runtimeValidationStore.addFileEvidence(
			access.userId,
			input
		);
	} catch (error) {
		// An outcome we can name leaves nothing behind; an unknown failure may have committed, so keep the object.
		if (
			error instanceof IdempotencyConflictError ||
			error instanceof RetryablePublicationError
		) {
			await storage.delete(objectKey);
			return c.json(
				serializePublicApiError(
					error instanceof IdempotencyConflictError
						? "Runtime validation evidence idempotency conflict"
						: "Runtime validation evidence was not saved; retry with the same key"
				),
				409
			);
		}
		throw error;
	}
	if (!result) {
		await storage.delete(objectKey);
		return c.json(serializePublicApiError("Not found"), 404);
	}
	if (result.status === "replayed") {
		// The first upload's object is the evidence; this attempt's copy is a duplicate.
		await storage.delete(objectKey);
	}
	return c.json(result, 201);
}

function verifiedStream(
	body: ReadableStream<Uint8Array>,
	byteSize: number,
	expectedSha256: string
) {
	const hash = createHash("sha256");
	let length = 0;
	return body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			flush() {
				if (length !== byteSize || hash.digest("hex") !== expectedSha256) {
					throw new Error(integrityError);
				}
			},
			transform(chunk, controller) {
				length += chunk.byteLength;
				if (length > byteSize) {
					throw new Error(integrityError);
				}
				hash.update(chunk);
				controller.enqueue(chunk);
			},
		})
	);
}

async function downloadEvidenceFile(
	c: Context,
	dependencies: RuntimeValidationEvidenceRouteDependencies
) {
	const access = await resolveAccess(c, dependencies);
	if (!access.ok) {
		return access.response;
	}
	const evidenceId = idSchema.safeParse(c.req.param("evidenceId"));
	if (!evidenceId.success) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	const file = await dependencies.runtimeValidationStore.getEvidenceFile(
		access.userId,
		access.projectId,
		access.recordId,
		evidenceId.data
	);
	if (!file) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	const objectKey = runtimeValidationEvidenceObjectKeySchema.safeParse(
		file.objectKey
	);
	const object = objectKey.success
		? await dependencies.createStorage().get(objectKey.data)
		: null;
	if (
		!object ||
		object.contentType !== opaqueStorageContentType ||
		(object.contentLength !== undefined &&
			object.contentLength !== file.byteSize)
	) {
		await object?.body.cancel();
		return c.json(serializePublicApiError(integrityError), 502);
	}
	// Buffer first so a corrupted object fails before any response bytes are sent.
	let bytes: ArrayBuffer;
	try {
		bytes = await new Response(
			verifiedStream(object.body, file.byteSize, file.sha256)
		).arrayBuffer();
	} catch {
		return c.json(serializePublicApiError(integrityError), 502);
	}
	c.header(
		"Content-Disposition",
		`attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
	);
	c.header("Content-Length", String(file.byteSize));
	c.header("Content-Type", opaqueStorageContentType);
	c.header("X-Content-Type-Options", "nosniff");
	return c.body(bytes, 200);
}

export function mountRuntimeValidationEvidenceRoutes(
	app: Hono,
	dependencies: RuntimeValidationEvidenceRouteDependencies
) {
	app.post(
		uploadPath,
		bodyLimit({
			maxSize:
				runtimeValidationEvidenceFileLimitBytes + multipartFramingLimitBytes,
			onError: (c) =>
				c.json(
					serializePublicApiError(
						"Runtime validation evidence file exceeds the 5 MiB limit"
					),
					413
				),
		}),
		(c) => uploadEvidenceFile(c, dependencies)
	);
	app.get(downloadPath, (c) => downloadEvidenceFile(c, dependencies));
}
