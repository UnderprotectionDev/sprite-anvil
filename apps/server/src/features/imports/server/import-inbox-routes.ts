import { assetSourceFileNameSchema } from "@sprite-anvil/api/asset-record-tracking";
import type { ImportInboxStore } from "@sprite-anvil/api/import-inbox";
import { importInboxSourceContentTypeSchema } from "@sprite-anvil/api/import-inbox";
import type {
	SourceMetadataFieldProposal,
	SourceMetadataMappingDiagnostic,
	SourceMetadataMappingProposalStore,
	SourceMetadataMappingSidecar,
} from "@sprite-anvil/api/source-metadata-mapping";
import {
	sourceMetadataMappingContractVersion,
	sourceMetadataMappingProposalCreateInputSchema,
	sourceMetadataMappingProposalSchema,
} from "@sprite-anvil/api/source-metadata-mapping";
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
import {
	buildSourceMetadataConflicts,
	buildSourceMetadataMappingSuggestions,
	parseSourceMetadataSidecar,
} from "./source-metadata-mapping";

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
	sourceMetadataMappingProposalStore: SourceMetadataMappingProposalStore;
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
	throw error;
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
	let entryWritePending = false;
	let entryCreated = false;
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

		entryWritePending = true;
		const result = await dependencies.importInboxStore.createEntry(userId, {
			contentLength: uploadHeaders.contentLength,
			fileName: uploadHeaders.fileName,
			id: uploadHeaders.id,
			objectKey,
			projectId,
			sha256,
			sourceContentType: uploadHeaders.sourceContentType,
		});
		entryWritePending = false;
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
		entryCreated = result.kind === "created";
		if (result.kind === "existing") {
			await storage.delete(objectKey);
			objectStored = false;
		}
		c.header("Cache-Control", "private, no-store");
		return c.json(result.value, result.kind === "created" ? 201 : 200);
	} catch (error) {
		if (storage && objectStored && !entryWritePending && !entryCreated) {
			try {
				await storage.delete(objectKey);
			} catch {
				// A failed upload remains closed if object cleanup is unavailable.
			}
		}
		return uploadFailureResponse(c, error);
	}
}

async function readImportInboxTextFile(
	storage: Storage,
	file: {
		contentLength: number;
		fileName: string;
		objectKey: string;
		sha256: string;
	}
): Promise<{ ok: true; text: string } | { ok: false }> {
	const objectKey = importInboxObjectKeySchema.safeParse(file.objectKey);
	if (!objectKey.success) {
		throw new Error("Import Inbox file unavailable");
	}
	const object = await storage.get(objectKey.data);
	if (
		!object ||
		object.contentType !== opaqueStorageContentType ||
		(object.contentLength !== undefined &&
			object.contentLength !== file.contentLength)
	) {
		await object?.body.cancel();
		throw new Error("Import Inbox file unavailable");
	}
	const verifiedBytes = await new Response(
		verifyImportInboxStream(object.body, file.contentLength, file.sha256)
	).arrayBuffer();
	try {
		return {
			ok: true,
			text: new TextDecoder("utf-8", { fatal: true }).decode(verifiedBytes),
		};
	} catch {
		return { ok: false };
	}
}

function proposalErrorResponse(
	c: Context,
	error:
		| "Invalid source metadata proposal"
		| "Invalid source metadata JSON"
		| "Unsupported source metadata format",
	status: 400 | 422
) {
	c.header("Cache-Control", "private, no-store");
	return c.json(serializePublicApiError(error), status);
}

type ParsedSidecarsResult =
	| {
			ok: true;
			diagnostics: SourceMetadataMappingDiagnostic[];
			fields: SourceMetadataFieldProposal[];
			sidecars: SourceMetadataMappingSidecar[];
	  }
	| {
			ok: false;
			reason: "not_found" | "invalid_json" | "unsupported_format";
	  };

async function parseSidecarEntries(
	userId: string,
	projectId: string,
	sidecarEntryIds: string[],
	dependencies: ImportInboxRouteDependencies
): Promise<ParsedSidecarsResult> {
	const storage = dependencies.createStorage();
	const sidecars: SourceMetadataMappingSidecar[] = [];
	const fields: SourceMetadataFieldProposal[] = [];
	const diagnostics: SourceMetadataMappingDiagnostic[] = [];
	for (const sidecarEntryId of sidecarEntryIds) {
		// biome-ignore lint/performance/noAwaitInLoops: Sidecars are read sequentially to bound memory while validating each managed stream.
		const file = await dependencies.importInboxStore.getFileRecord(
			userId,
			projectId,
			sidecarEntryId
		);
		if (!file) {
			return { ok: false, reason: "not_found" };
		}

		const decoded = await readImportInboxTextFile(storage, file);
		if (!decoded.ok) {
			return { ok: false, reason: "invalid_json" };
		}
		const parsed = parseSourceMetadataSidecar({
			entryId: sidecarEntryId,
			fileName: file.fileName,
			sha256: file.sha256,
			text: decoded.text,
		});
		if (!parsed.ok) {
			return { ok: false, reason: parsed.reason };
		}
		sidecars.push(parsed.sidecar);
		fields.push(...parsed.fields);
		diagnostics.push(...parsed.diagnostics);
	}
	return { ok: true, diagnostics, fields, sidecars };
}

async function createSourceMetadataMappingProposal(
	c: Context,
	userId: string,
	projectId: string,
	sourceEntryId: string,
	dependencies: ImportInboxRouteDependencies
) {
	const rawInput: unknown = await c.req.json().catch(() => null);
	const input =
		sourceMetadataMappingProposalCreateInputSchema.safeParse(rawInput);
	if (!input.success) {
		return proposalErrorResponse(c, "Invalid source metadata proposal", 400);
	}

	const source = await dependencies.importInboxStore.getFileRecord(
		userId,
		projectId,
		sourceEntryId
	);
	if (!source) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	const parsedSidecars = await parseSidecarEntries(
		userId,
		projectId,
		input.data.sidecarEntryIds,
		dependencies
	);
	if (!parsedSidecars.ok) {
		if (parsedSidecars.reason === "not_found") {
			return c.json(serializePublicApiError("Not found"), 404);
		}
		return proposalErrorResponse(
			c,
			parsedSidecars.reason === "unsupported_format"
				? "Unsupported source metadata format"
				: "Invalid source metadata JSON",
			422
		);
	}

	const proposal = sourceMetadataMappingProposalSchema.parse({
		contractVersion: sourceMetadataMappingContractVersion,
		conflicts: buildSourceMetadataConflicts(parsedSidecars.fields),
		createdAt: new Date().toISOString(),
		diagnostics: parsedSidecars.diagnostics,
		fields: parsedSidecars.fields,
		id: dependencies.createId?.() ?? crypto.randomUUID(),
		projectId,
		sidecars: parsedSidecars.sidecars,
		source: {
			entryId: sourceEntryId,
			fileName: source.fileName,
			sha256: source.sha256,
		},
		suggestions: buildSourceMetadataMappingSuggestions(),
	});
	const created =
		await dependencies.sourceMetadataMappingProposalStore.createProposal(
			userId,
			projectId,
			sourceEntryId,
			proposal
		);
	if (!created) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	return c.json(created, 201);
}

async function prepareSourceMetadataProposalRequest(
	c: Context,
	dependencies: ImportInboxRouteDependencies
) {
	c.header("Cache-Control", "private, no-store");
	const projectId = c.req.param("projectId") ?? "";
	const access = await resolveProjectAccess(
		c.req.raw.headers,
		projectId,
		dependencies
	);
	if (!access.ok) {
		return { ok: false as const, response: accessError(c, access) };
	}
	const entryId = entryIdSchema.safeParse(c.req.param("entryId"));
	if (!entryId.success) {
		return {
			ok: false as const,
			response: c.json(serializePublicApiError("Not found"), 404),
		};
	}
	return {
		entryId: entryId.data,
		ok: true as const,
		projectId,
		userId: access.userId,
	};
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

	app.get(
		"/api/projects/:projectId/import-inbox/:entryId/source-metadata-mapping-proposals",
		async (c) => {
			const request = await prepareSourceMetadataProposalRequest(
				c,
				dependencies
			);
			if (!request.ok) {
				return request.response;
			}
			const source = await dependencies.importInboxStore.getFileRecord(
				request.userId,
				request.projectId,
				request.entryId
			);
			if (!source) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			const proposals =
				await dependencies.sourceMetadataMappingProposalStore.listProposals(
					request.userId,
					request.projectId,
					request.entryId
				);
			if (!proposals) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			return c.json(proposals);
		}
	);

	app.post(
		"/api/projects/:projectId/import-inbox/:entryId/source-metadata-mapping-proposals",
		async (c) => {
			const request = await prepareSourceMetadataProposalRequest(
				c,
				dependencies
			);
			if (!request.ok) {
				return request.response;
			}
			return createSourceMetadataMappingProposal(
				c,
				request.userId,
				request.projectId,
				request.entryId,
				dependencies
			);
		}
	);

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
			throw new Error("Import Inbox file unavailable");
		}
		const object = await dependencies.createStorage().get(objectKey.data);
		if (
			!object ||
			object.contentType !== opaqueStorageContentType ||
			(object.contentLength !== undefined &&
				object.contentLength !== file.contentLength)
		) {
			await object?.body.cancel();
			throw new Error("Import Inbox file unavailable");
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
