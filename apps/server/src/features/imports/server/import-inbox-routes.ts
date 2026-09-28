import { assetSourceFileNameSchema } from "@sprite-anvil/api/asset-record-tracking";
import type { AssetVersionStore } from "@sprite-anvil/api/asset-versions";
import type {
	ImportInboxFileRecord,
	ImportInboxStore,
} from "@sprite-anvil/api/import-inbox";
import { importInboxSourceContentTypeSchema } from "@sprite-anvil/api/import-inbox";
import type {
	SourceMetadataFieldProposal,
	SourceMetadataMappingDiagnostic,
	SourceMetadataMappingProposalStore,
	SourceMetadataMappingSidecar,
} from "@sprite-anvil/api/source-metadata-mapping";
import {
	sourceMetadataMappingContractVersion,
	sourceMetadataMappingFinalizeInputSchema,
	sourceMetadataMappingProposalCreateInputSchema,
	sourceMetadataMappingProposalSchema,
	sourceMetadataMappingSidecarLimits,
} from "@sprite-anvil/api/source-metadata-mapping";
import type { Context, Hono } from "hono";
import z from "zod";
import type { createStorage } from "../../../cloudflare";
import {
	createProjectAssetVersionObjectKey,
	createProjectImportInboxObjectKey,
	importInboxObjectKeySchema,
} from "../../../cloudflare";
import { serializePublicApiError } from "../../../output-contracts";
import {
	AssetVersionContentLengthError,
	AssetVersionIntegrityError,
	createAssetVersionIntegrityTransform,
} from "../../asset-versions/server/asset-version-integrity";
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
import { resolveSourceMetadataMappingDecisions } from "./source-metadata-mapping-finalization";

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
	assetVersionStore?: Pick<
		AssetVersionStore,
		"createCandidateVersion" | "getAssetRecordForUpload"
	>;
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One request boundary validates access, immutable source, target, and idempotent persistence.
async function finalizeSourceMetadataMapping(
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
		return accessError(c, access);
	}
	const entryId = entryIdSchema.safeParse(c.req.param("entryId"));
	const proposalId = entryIdSchema.safeParse(c.req.param("proposalId"));
	if (!(entryId.success && proposalId.success)) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	const proposals =
		await dependencies.sourceMetadataMappingProposalStore.listProposals(
			access.userId,
			projectId,
			entryId.data
		);
	const proposal = proposals?.find(
		(candidate) => candidate.id === proposalId.data
	);
	if (!proposal) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	if (c.req.method === "GET") {
		const result =
			await dependencies.sourceMetadataMappingProposalStore.getFinalization(
				access.userId,
				projectId,
				proposal.id
			);
		return result
			? c.json(result)
			: c.json(serializePublicApiError("Not found"), 404);
	}
	const body = await readBoundedJsonRequest(c.req.raw);
	if (!body.ok && body.reason === "too_large") {
		return c.json(
			serializePublicApiError(
				"Source metadata proposal request exceeds the maximum size"
			),
			413
		);
	}
	const input = sourceMetadataMappingFinalizeInputSchema.safeParse(
		body.ok ? body.value : null
	);
	const resolvedDecisions = input.success
		? resolveSourceMetadataMappingDecisions(proposal, input.data.decisions)
		: null;
	if (!(input.success && resolvedDecisions)) {
		return c.json(
			serializePublicApiError("Invalid source metadata mapping decisions"),
			422
		);
	}
	const versionStore = dependencies.assetVersionStore;
	const mappingStore = dependencies.sourceMetadataMappingProposalStore;
	if (!versionStore) {
		throw new Error("Source metadata mapping finalization unavailable");
	}
	const target = await versionStore.getAssetRecordForUpload(
		access.userId,
		projectId,
		input.data.assetRecordId
	);
	const source = await dependencies.importInboxStore.getFileRecord(
		access.userId,
		projectId,
		entryId.data
	);
	if (!(target && source) || source.sha256 !== proposal.source.sha256) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	let contentType: "image/png" | "image/webp" | null = null;
	if (source.fileName.toLowerCase().endsWith(".png")) {
		contentType = "image/png";
	} else if (source.fileName.toLowerCase().endsWith(".webp")) {
		contentType = "image/webp";
	}
	if (!contentType || source.contentLength === 0) {
		return c.json(serializePublicApiError("Unsupported source image"), 422);
	}
	const reserved = await mappingStore.reserveFinalization(
		access.userId,
		projectId,
		proposal.id,
		{ ...input.data, decisions: resolvedDecisions }
	);
	if (reserved === "not_found") {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	if (reserved === "conflict") {
		return c.json(
			serializePublicApiError(
				"Source metadata mapping already finalized differently"
			),
			409
		);
	}
	const existing = await mappingStore.getFinalization(
		access.userId,
		projectId,
		proposal.id
	);
	if (existing) {
		return c.json(existing);
	}
	const sourceKey = importInboxObjectKeySchema.safeParse(source.objectKey);
	if (!sourceKey.success) {
		throw new Error("Import Inbox file unavailable");
	}
	const storage = dependencies.createStorage();
	const object = await storage.get(sourceKey.data);
	if (
		!object ||
		object.contentType !== opaqueStorageContentType ||
		(object.contentLength !== undefined &&
			object.contentLength !== source.contentLength)
	) {
		await object?.body.cancel();
		throw new Error("Import Inbox file unavailable");
	}
	const objectKey = createProjectAssetVersionObjectKey(
		projectId,
		target.assetRecordId,
		proposal.id
	);
	const integrity = createAssetVersionIntegrityTransform(
		contentType,
		source.contentLength
	);
	try {
		await storage.put(
			objectKey,
			verifyImportInboxStream(
				object.body,
				source.contentLength,
				source.sha256
			).pipeThrough(integrity.body),
			contentType,
			source.contentLength
		);
		const digest = integrity.getContentDigest();
		if (digest !== source.sha256) {
			throw new AssetVersionIntegrityError();
		}
		const version = await versionStore.createCandidateVersion(access.userId, {
			...target,
			id: proposal.id,
			objectKey,
			contentType,
			contentLength: source.contentLength,
			fileName: source.fileName,
			contentDigest: digest,
			idempotencyKey: proposal.id,
			integrityVerified: true,
		});
		if (!version) {
			return c.json(serializePublicApiError("Not found"), 404);
		}
		if (version.kind !== "created" && version.kind !== "existing") {
			return c.json(
				serializePublicApiError("Source metadata mapping conflict"),
				409
			);
		}
		const result = await mappingStore.completeFinalization(
			access.userId,
			projectId,
			proposal.id
		);
		if (!result) {
			throw new Error("Source metadata mapping finalization unavailable");
		}
		return c.json(result, 201);
	} catch (error) {
		if (
			error instanceof AssetVersionIntegrityError ||
			error instanceof AssetVersionContentLengthError ||
			error instanceof ImportInboxIntegrityError ||
			error instanceof ImportInboxContentLengthError
		) {
			return c.json(serializePublicApiError("Invalid source image"), 422);
		}
		throw error;
	}
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
		| "Unsupported source metadata format"
		| "Source metadata sidecars exceed the maximum size"
		| "Source metadata proposal request exceeds the maximum size",
	status: 400 | 413 | 422
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
			reason: "not_found" | "invalid_json" | "unsupported_format" | "too_large";
	  };

type BoundedJsonRequestResult =
	| { ok: true; value: unknown }
	| { ok: false; reason: "invalid_json" | "too_large" };

async function readBoundedJsonRequest(
	request: Request
): Promise<BoundedJsonRequestResult> {
	const contentLengthHeader = request.headers.get("content-length");
	if (contentLengthHeader !== null) {
		if (!uploadLengthPattern.test(contentLengthHeader)) {
			return { ok: false, reason: "invalid_json" };
		}
		const contentLength = Number(contentLengthHeader);
		if (!Number.isSafeInteger(contentLength)) {
			return { ok: false, reason: "invalid_json" };
		}
		if (contentLength > sourceMetadataMappingSidecarLimits.requestBytes) {
			await request.body?.cancel().catch(() => undefined);
			return { ok: false, reason: "too_large" };
		}
	}

	if (!request.body) {
		return { ok: false, reason: "invalid_json" };
	}
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	try {
		while (true) {
			// biome-ignore lint/performance/noAwaitInLoops: Streaming reads stay sequential to enforce the byte cap before retaining more chunks.
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			byteLength += value.byteLength;
			if (byteLength > sourceMetadataMappingSidecarLimits.requestBytes) {
				await reader.cancel().catch(() => undefined);
				return { ok: false, reason: "too_large" };
			}
			chunks.push(value);
		}
	} catch {
		return { ok: false, reason: "invalid_json" };
	} finally {
		reader.releaseLock();
	}

	const bytes = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return {
			ok: true,
			value: JSON.parse(
				new TextDecoder("utf-8", { fatal: true }).decode(bytes)
			),
		};
	} catch {
		return { ok: false, reason: "invalid_json" };
	}
}

async function parseSidecarEntries(
	userId: string,
	projectId: string,
	sidecarEntryIds: string[],
	dependencies: ImportInboxRouteDependencies
): Promise<ParsedSidecarsResult> {
	const files: Array<{ entryId: string; file: ImportInboxFileRecord }> = [];
	let totalBytes = 0;
	for (const sidecarEntryId of sidecarEntryIds) {
		// biome-ignore lint/performance/noAwaitInLoops: File records are preflighted sequentially before any sidecar bytes are read.
		const file = await dependencies.importInboxStore.getFileRecord(
			userId,
			projectId,
			sidecarEntryId
		);
		if (!file) {
			return { ok: false, reason: "not_found" };
		}
		if (
			!Number.isSafeInteger(file.contentLength) ||
			file.contentLength < 0 ||
			file.contentLength > sourceMetadataMappingSidecarLimits.fileBytes ||
			totalBytes + file.contentLength >
				sourceMetadataMappingSidecarLimits.totalBytes
		) {
			return { ok: false, reason: "too_large" };
		}
		totalBytes += file.contentLength;
		files.push({ entryId: sidecarEntryId, file });
	}

	const storage = dependencies.createStorage();
	const sidecars: SourceMetadataMappingSidecar[] = [];
	const fields: SourceMetadataFieldProposal[] = [];
	const diagnostics: SourceMetadataMappingDiagnostic[] = [];
	for (const { entryId: sidecarEntryId, file } of files) {
		// biome-ignore lint/performance/noAwaitInLoops: Sidecars are read sequentially to bound memory while validating each managed stream.
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
	const requestBody = await readBoundedJsonRequest(c.req.raw);
	if (!requestBody.ok && requestBody.reason === "too_large") {
		return proposalErrorResponse(
			c,
			"Source metadata proposal request exceeds the maximum size",
			413
		);
	}
	const rawInput: unknown = requestBody.ok ? requestBody.value : null;
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
		if (parsedSidecars.reason === "too_large") {
			return proposalErrorResponse(
				c,
				"Source metadata sidecars exceed the maximum size",
				413
			);
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
	const finalizationPath =
		"/api/projects/:projectId/import-inbox/:entryId/source-metadata-mapping-proposals/:proposalId/finalization";
	app.get(finalizationPath, (c) =>
		finalizeSourceMetadataMapping(c, dependencies)
	);
	app.post(finalizationPath, (c) =>
		finalizeSourceMetadataMapping(c, dependencies)
	);
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
