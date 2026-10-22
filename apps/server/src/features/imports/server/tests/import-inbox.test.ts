import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type {
	ImportInboxEntry,
	ImportInboxFileRecord,
	ImportInboxStore,
	ImportInboxUploadInput,
} from "@sprite-anvil/api/import-inbox";
import { importInboxEntrySchema } from "@sprite-anvil/api/import-inbox";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type {
	SourceMetadataMappingFinalization,
	SourceMetadataMappingFinalizeInput,
	SourceMetadataMappingProposal,
	SourceMetadataMappingProposalStore,
} from "@sprite-anvil/api/source-metadata-mapping";
import {
	sourceMetadataMappingLegacyContractVersion,
	sourceMetadataMappingProposalSchema,
} from "@sprite-anvil/api/source-metadata-mapping";
import { Hono } from "hono";
import sharp from "sharp";
import { serializePublicApiError } from "../../../../output-contracts";
import { mountImportInboxRoutes } from "../import-inbox-routes";
import { mountImportInboxRpcGuards } from "../import-inbox-rpc-guards";
import {
	createSourceMetadataMappingFinalizer,
	createSourceMetadataMappingProposalCreator,
} from "../source-metadata-mapping-procedures";

const supportReferencePattern = /^SUP-/;

const userId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const otherProjectId = crypto.randomUUID();
const opaqueAsepriteFile = Uint8Array.from([
	65, 83, 69, 80, 82, 73, 84, 69, 0, 255, 32, 0, 128,
]);

function digest(bytes: Uint8Array) {
	return createHash("sha256").update(bytes).digest("hex");
}

class MemoryImportInboxStore implements ImportInboxStore {
	readonly records = new Map<
		string,
		{
			entry: ImportInboxEntry;
			file: ImportInboxFileRecord;
			ownerUserId: string;
		}
	>();
	failAfterPersistOnce = false;

	// biome-ignore lint/suspicious/useAwait: The test store mirrors the asynchronous production contract.
	async createEntry(requestedUserId: string, input: ImportInboxUploadInput) {
		if (input.projectId !== projectId) {
			return { ok: false as const, reason: "not_found" as const };
		}

		const existing = this.records.get(input.id);
		if (existing) {
			const sameUpload =
				existing.ownerUserId === requestedUserId &&
				existing.entry.projectId === input.projectId &&
				existing.entry.fileName === input.fileName &&
				existing.entry.sourceContentType === input.sourceContentType &&
				existing.entry.contentLength === input.contentLength &&
				existing.entry.sha256 === input.sha256;
			return sameUpload
				? {
						ok: true as const,
						kind: "existing" as const,
						value: existing.entry,
					}
				: { ok: false as const, reason: "conflict" as const };
		}

		const entry = importInboxEntrySchema.parse({
			createdAt: new Date().toISOString(),
			contentLength: input.contentLength,
			fileName: input.fileName,
			id: input.id,
			projectId: input.projectId,
			sha256: input.sha256,
			sourceContentType: input.sourceContentType,
		});
		const file = {
			contentLength: input.contentLength,
			fileName: input.fileName,
			objectKey: input.objectKey,
			sha256: input.sha256,
		};
		this.records.set(input.id, { entry, file, ownerUserId: requestedUserId });
		if (this.failAfterPersistOnce) {
			this.failAfterPersistOnce = false;
			throw new Error("Database acknowledgement was lost after commit");
		}
		return { ok: true as const, kind: "created" as const, value: entry };
	}

	// biome-ignore lint/suspicious/useAwait: The test store mirrors the asynchronous production contract.
	async listEntries(requestedUserId: string, requestedProjectId: string) {
		if (requestedUserId !== userId || requestedProjectId !== projectId) {
			return null;
		}
		return [...this.records.values()]
			.filter((record) => record.ownerUserId === requestedUserId)
			.map((record) => record.entry);
	}

	// biome-ignore lint/suspicious/useAwait: The test store mirrors the asynchronous production contract.
	async getFileRecord(
		requestedUserId: string,
		requestedProjectId: string,
		entryId: string
	) {
		const record = this.records.get(entryId);
		if (
			!record ||
			record.ownerUserId !== requestedUserId ||
			record.entry.projectId !== requestedProjectId
		) {
			return null;
		}
		return record.file;
	}
}

class MemorySourceMetadataMappingProposalStore
	implements SourceMetadataMappingProposalStore
{
	readonly proposals = new Map<string, SourceMetadataMappingProposal[]>();
	readonly finalizations = new Map<string, SourceMetadataMappingFinalization>();
	readonly reservations = new Map<string, SourceMetadataMappingFinalizeInput>();
	// biome-ignore lint/suspicious/useAwait: The test store mirrors the asynchronous production contract.
	async getFinalization(
		_userId: string,
		_projectId: string,
		proposalId: string
	) {
		return this.finalizations.get(proposalId) ?? null;
	}
	// biome-ignore lint/suspicious/useAwait: The test store mirrors the asynchronous production contract.
	async reserveFinalization(
		_userId: string,
		_projectId: string,
		proposalId: string,
		input: SourceMetadataMappingFinalizeInput
	) {
		const previous = this.reservations.get(proposalId);
		if (previous && JSON.stringify(previous) !== JSON.stringify(input)) {
			return "conflict" as const;
		}
		this.reservations.set(proposalId, input);
		return "reserved" as const;
	}
	// biome-ignore lint/suspicious/useAwait: The test store mirrors the asynchronous production contract.
	async completeFinalization(
		_userId: string,
		_projectId: string,
		proposalId: string
	) {
		const reservation = this.reservations.get(proposalId);
		if (!reservation) {
			return null;
		}
		const result = {
			proposalId,
			assetRecordId: reservation.assetRecordId,
			assetVersionId: proposalId,
			decisions: reservation.decisions,
			createdAt: new Date().toISOString(),
		};
		this.finalizations.set(proposalId, result);
		return result;
	}

	// biome-ignore lint/suspicious/useAwait: The test store mirrors the asynchronous production contract.
	async createProposal(
		requestedUserId: string,
		requestedProjectId: string,
		sourceEntryId: string,
		proposal: SourceMetadataMappingProposal
	) {
		if (
			requestedUserId !== userId ||
			requestedProjectId !== projectId ||
			proposal.projectId !== requestedProjectId ||
			proposal.source.entryId !== sourceEntryId
		) {
			return null;
		}
		const proposals = this.proposals.get(sourceEntryId) ?? [];
		proposals.unshift(proposal);
		this.proposals.set(sourceEntryId, proposals);
		return proposal;
	}

	// biome-ignore lint/suspicious/useAwait: The test store mirrors the asynchronous production contract.
	async listProposals(
		requestedUserId: string,
		requestedProjectId: string,
		sourceEntryId: string
	) {
		if (requestedUserId !== userId || requestedProjectId !== projectId) {
			return null;
		}
		return this.proposals.get(sourceEntryId) ?? [];
	}
}

function mountTestApp() {
	const store = new MemoryImportInboxStore();
	const sourceMetadataMappingProposalStore =
		new MemorySourceMetadataMappingProposalStore();
	const objects = new Map<string, Uint8Array>();
	const deletedKeys: string[] = [];
	const storageState = { failGet: false };
	let uploadAttempt = 0;
	const targetAssetRecordId = crypto.randomUUID();
	const createdVersions: string[] = [];
	const app = new Hono();
	app.onError((_error, c) =>
		c.json(
			serializePublicApiError(
				"Internal Server Error",
				"SUP-00000000-0000-4000-8000-000000000000"
			),
			500
		)
	);
	const assetVersionStore = {
		getAssetRecordForUpload: async (
			_userId: string,
			requestedProjectId: string,
			assetRecordId: string
		) =>
			requestedProjectId === projectId && assetRecordId === targetAssetRecordId
				? { projectId, assetRecordId, assetFamilyId: crypto.randomUUID() }
				: null,
		// biome-ignore lint/suspicious/useAwait: The test store mirrors the asynchronous production contract.
		createCandidateVersion: async (_userId: string, input: { id: string }) => {
			const existed = createdVersions.includes(input.id);
			if (!existed) {
				createdVersions.push(input.id);
			}
			return {
				kind: existed ? ("existing" as const) : ("created" as const),
				version: {} as never,
			};
		},
	};
	const createId = () => {
		uploadAttempt += 1;
		return (
			"924eac6d-9fbb-44ce-b215-38f3774d95" +
			String(uploadAttempt).padStart(2, "0")
		);
	};
	const createStorage = () => ({
		// biome-ignore lint/suspicious/useAwait: Storage methods mirror asynchronous network calls.
		delete: async (key: string) => {
			deletedKeys.push(key);
			objects.delete(key);
		},
		// biome-ignore lint/suspicious/useAwait: Storage methods mirror asynchronous network calls.
		get: async (key: string) => {
			if (storageState.failGet) {
				throw new Error("R2 read failed");
			}
			const bytes = objects.get(key);
			return bytes
				? {
						body: new ReadableStream<Uint8Array>({
							start(controller) {
								controller.enqueue(bytes.slice());
								controller.close();
							},
						}),
						contentLength: bytes.byteLength,
						contentType: "application/octet-stream",
					}
				: null;
		},
		put: async (key: string, body: ReadableStream<Uint8Array>) => {
			objects.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
		},
	});
	mountImportInboxRoutes(app, {
		importInboxStore: store,
		createId,
		createStorage: createStorage as never,
		getProjectForUser: async (requestedUserId, requestedProjectId) =>
			requestedUserId === userId && requestedProjectId === projectId
				? { id: projectId }
				: null,
		getSession: async (headers) =>
			headers.get("authorization") === `Bearer ${userId}`
				? { user: { id: userId } }
				: null,
	});
	const mappingDependencies = {
		assetVersionStore,
		createId,
		createStorage: createStorage as never,
		importInboxStore: store,
		sourceMetadataMappingProposalStore,
	};
	function createContext(session: { user: { id: string } } | null) {
		return {
			createSourceMetadataMappingProposal:
				createSourceMetadataMappingProposalCreator(mappingDependencies),
			finalizeSourceMetadataMapping:
				createSourceMetadataMappingFinalizer(mappingDependencies),
			importInboxStore: store,
			projectAccess: {
				getProject: async (
					requestedUserId: string,
					requestedProjectId: string
				) =>
					requestedUserId === userId && requestedProjectId === projectId
						? { id: projectId }
						: null,
			},
			session,
			sourceMetadataMappingProposalStore,
		} as never;
	}
	const client = createRouterClient(appRouter, {
		context: createContext({ user: { id: userId } }),
	});
	const anonymousClient = createRouterClient(appRouter, {
		context: createContext(null),
	});
	// The wire harness runs the production request guards in front of the real
	// RPC handler, so byte caps, status codes and cache headers are asserted as
	// a browser would see them.
	const rpcApp = new Hono();
	mountImportInboxRpcGuards(rpcApp);
	const rpcHandler = new RPCHandler(appRouter);
	rpcApp.use("/*", async (c, next) => {
		const result = await rpcHandler.handle(c.req.raw, {
			context: createContext({ user: { id: userId } }),
			prefix: "/rpc",
		});
		if (result.matched) {
			return c.newResponse(result.response.body, result.response);
		}
		await next();
	});

	return {
		anonymousClient,
		app,
		client,
		rpcApp,
		targetAssetRecordId,
		createdVersions,
		deletedKeys,
		objects,
		sourceMetadataMappingProposalStore,
		storageState,
		store,
	};
}

async function expectProcedureError(
	call: Promise<unknown>,
	expected: { code: string; message?: string; status: number }
) {
	await expect(call).rejects.toMatchObject(expected);
}

function uploadRequest(
	fileName: string,
	bytes: Uint8Array,
	idempotencyKey = crypto.randomUUID()
) {
	return {
		method: "POST",
		headers: {
			authorization: `Bearer ${userId}`,
			"content-type": "application/octet-stream",
			"x-import-inbox-size": String(bytes.byteLength),
			"x-import-inbox-file-name": encodeURIComponent(fileName),
			"x-import-inbox-source-type": "application/octet-stream",
			"idempotency-key": idempotencyKey,
		},
		body: bytes,
	};
}

test("stores an opaque .aseprite file as an Import Inbox Entry and rereads the managed bytes", async () => {
	const { app, client, objects } = mountTestApp();
	const response = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("hero source.aseprite", opaqueAsepriteFile)
	);

	expect(response.status).toBe(201);
	const created = importInboxEntrySchema.parse(await response.json());
	expect(created.fileName).toBe("hero source.aseprite");
	expect(created.sourceContentType).toBe("application/octet-stream");
	expect(created.contentLength).toBe(opaqueAsepriteFile.byteLength);
	expect(created.sha256).toBe(digest(opaqueAsepriteFile));
	expect(created).not.toHaveProperty("assetRecordId");
	expect(created).not.toHaveProperty("candidateVersionId");

	expect(await client.imports.listEntries({ projectId })).toEqual([created]);

	const downloadResponse = await app.request(
		`/api/projects/${projectId}/import-inbox/${created.id}/file`,
		{ headers: { authorization: `Bearer ${userId}` } }
	);
	expect(downloadResponse.status).toBe(200);
	expect(downloadResponse.headers.get("content-type")).toBe(
		"application/octet-stream"
	);
	expect(downloadResponse.headers.get("content-disposition")).toContain(
		"attachment"
	);
	expect(
		Array.from(new Uint8Array(await downloadResponse.arrayBuffer()))
	).toEqual(Array.from(opaqueAsepriteFile));
	expect(objects.size).toBe(1);
});

test("preserves the source file name exactly across upload, listing, and download", async () => {
	const { app, client } = mountTestApp();
	const sourceFileName = " hero source.aseprite ";
	const response = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest(sourceFileName, opaqueAsepriteFile)
	);

	expect(response.status).toBe(201);
	const created = importInboxEntrySchema.parse(await response.json());
	expect(created.fileName).toBe(sourceFileName);

	expect(await client.imports.listEntries({ projectId })).toEqual([created]);

	const downloadResponse = await app.request(
		`/api/projects/${projectId}/import-inbox/${created.id}/file`,
		{ headers: { authorization: `Bearer ${userId}` } }
	);
	expect(downloadResponse.headers.get("content-disposition")).toContain(
		"filename*=UTF-8''%20hero%20source.aseprite%20"
	);
});

test("stores and rereads a zero-byte source file without inventing content", async () => {
	const { app, objects } = mountTestApp();
	const emptyFile = new Uint8Array();
	const response = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("empty source.aseprite", emptyFile)
	);

	expect(response.status).toBe(201);
	const created = importInboxEntrySchema.parse(await response.json());
	expect(created.contentLength).toBe(0);
	expect(created.sha256).toBe(digest(emptyFile));

	const downloadResponse = await app.request(
		`/api/projects/${projectId}/import-inbox/${created.id}/file`,
		{ headers: { authorization: `Bearer ${userId}` } }
	);
	expect(downloadResponse.status).toBe(200);
	expect(await downloadResponse.arrayBuffer()).toHaveLength(0);
	expect(objects.size).toBe(1);
});

test("rejects unauthenticated, cross-project, and incomplete uploads before storage", async () => {
	const { app, objects, store } = mountTestApp();
	const unauthenticated = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		{
			...uploadRequest("hero.png", opaqueAsepriteFile),
			headers: {
				...uploadRequest("hero.png", opaqueAsepriteFile).headers,
				authorization: "",
			},
		}
	);
	expect(unauthenticated.status).toBe(401);

	const crossProject = await app.request(
		`/api/projects/${otherProjectId}/import-inbox`,
		uploadRequest("hero.png", opaqueAsepriteFile)
	);
	expect(crossProject.status).toBe(404);

	const incomplete = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		{
			...uploadRequest("hero.png", opaqueAsepriteFile),
			headers: {
				...uploadRequest("hero.png", opaqueAsepriteFile).headers,
				"x-import-inbox-size": "invalid",
			},
		}
	);
	expect(incomplete.status).toBe(400);
	expect(objects.size).toBe(0);
	expect(store.records.size).toBe(0);
});

test("reuses an idempotent upload and rejects changed bytes for the same key", async () => {
	const { app, deletedKeys, objects, store } = mountTestApp();
	const idempotencyKey = crypto.randomUUID();
	const first = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("hero source.aseprite", opaqueAsepriteFile, idempotencyKey)
	);
	const retry = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("hero source.aseprite", opaqueAsepriteFile, idempotencyKey)
	);
	expect(first.status).toBe(201);
	expect(retry.status).toBe(200);
	expect(await retry.json()).toEqual(await first.clone().json());

	const changedBytes = Uint8Array.from([1, 2, 3, 4]);
	const conflict = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("hero source.aseprite", changedBytes, idempotencyKey)
	);
	expect(conflict.status).toBe(409);
	expect(store.records.size).toBe(1);
	expect(objects.size).toBe(1);
	expect(deletedKeys).toHaveLength(2);
});

test("preserves retrievable file bytes when the persistent write acknowledgement is lost", async () => {
	const { app, objects, store } = mountTestApp();
	const idempotencyKey = crypto.randomUUID();
	store.failAfterPersistOnce = true;

	const first = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("hero source.aseprite", opaqueAsepriteFile, idempotencyKey)
	);
	expect(first.status).toBe(500);
	expect(await first.json()).toEqual({
		error: "Internal Server Error",
		supportReference: "SUP-00000000-0000-4000-8000-000000000000",
	});

	const retry = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("hero source.aseprite", opaqueAsepriteFile, idempotencyKey)
	);
	expect(retry.status).toBe(200);
	const entry = importInboxEntrySchema.parse(await retry.json());
	expect(objects.size).toBe(1);

	const download = await app.request(
		`/api/projects/${projectId}/import-inbox/${entry.id}/file`,
		{ headers: { authorization: `Bearer ${userId}` } }
	);
	expect(download.status).toBe(200);
	expect(Array.from(new Uint8Array(await download.arrayBuffer()))).toEqual(
		Array.from(opaqueAsepriteFile)
	);
});

test("reports managed-file storage failures with a support reference", async () => {
	const { app, storageState } = mountTestApp();
	const upload = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("hero source.aseprite", opaqueAsepriteFile)
	);
	expect(upload.status).toBe(201);
	const entry = importInboxEntrySchema.parse(await upload.json());
	storageState.failGet = true;

	const download = await app.request(
		`/api/projects/${projectId}/import-inbox/${entry.id}/file`,
		{ headers: { authorization: `Bearer ${userId}` } }
	);
	expect(download.status).toBe(500);
	expect(await download.json()).toEqual({
		error: "Internal Server Error",
		supportReference: "SUP-00000000-0000-4000-8000-000000000000",
	});
});

test("creates and rereads a source metadata proposal from Aseprite and TexturePacker sidecars", async () => {
	const { app, client } = mountTestApp();
	const sourceBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const asepriteBytes = new TextEncoder().encode(
		JSON.stringify({
			frames: {
				button: {
					duration: 100,
					frame: { h: 20, w: 30, x: 0, y: 0 },
				},
			},
			meta: {
				app: "http://www.aseprite.org/",
				frameTags: [{ direction: "forward", from: 0, name: "idle", to: 0 }],
				image: "hero.png",
				size: { h: 32, w: 32 },
				slices: [
					{
						keys: [
							{
								bounds: { h: 20, w: 30, x: 0, y: 0 },
								center: { h: 10, w: 12, x: 8, y: 5 },
								frame: 0,
								pivot: { x: 4, y: 5 },
							},
						],
						name: "button",
					},
				],
				version: "1.3.10",
			},
		})
	);
	const texturePackerBytes = new TextEncoder().encode(
		JSON.stringify({
			frames: [
				{
					filename: "button",
					frame: { h: 20, w: 30, x: 0, y: 0 },
					pivot: { x: 0.5, y: 0.5 },
				},
			],
			meta: {
				app: "http://www.codeandweb.com/texturepacker",
				image: "hero.png",
				size: { h: 32, w: 32 },
				version: "1.0",
			},
		})
	);
	const sourceId = crypto.randomUUID();
	const asepriteId = crypto.randomUUID();
	const texturePackerId = crypto.randomUUID();
	const uploadedEntries = await Promise.all([
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("hero.png", sourceBytes, sourceId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("sidecar-one.bin", asepriteBytes, asepriteId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("sidecar-two.bin", texturePackerBytes, texturePackerId)
		),
	]);
	expect(uploadedEntries.map((response) => response.status)).toEqual([
		201, 201, 201,
	]);

	const created = (await client.imports.createSourceMetadataMappingProposal({
		entryId: sourceId,
		input: { sidecarEntryIds: [asepriteId, texturePackerId] },
		projectId,
	})) as {
		contractVersion: string;
		conflicts: Array<{ field: string; key: string }>;
		fields: Array<{ field: string; key: string; value: unknown }>;
		suggestions: {
			assetFamilyLinks: { reason: string; status: string };
			requiredSetLinks: { reason: string; status: string };
			gameplayMetadata: { reason: string; status: "unknown" };
		};
		sidecars: Array<{
			entryId: string;
			format: string;
			jsonLayout: string;
			sha256: string;
			version: string;
		}>;
		source: { entryId: string; fileName: string; sha256: string };
	};

	expect(created.contractVersion).toBe("source-metadata-mapping/1.1.0");
	expect(created.suggestions.assetFamilyLinks).toEqual({
		reason: "no-source-evidence",
		status: "unknown",
	});
	expect(created.suggestions.requiredSetLinks).toEqual({
		reason: "no-source-evidence",
		status: "unknown",
	});
	expect(created.suggestions.gameplayMetadata).toEqual({
		reason: "project-context-required",
		status: "unknown",
	});
	expect(created.source).toEqual({
		entryId: sourceId,
		fileName: "hero.png",
		sha256: digest(sourceBytes),
	});
	expect(
		created.sidecars.map(({ entryId, format, jsonLayout }) => [
			entryId,
			format,
			jsonLayout,
		])
	).toEqual([
		[asepriteId, "aseprite", "hash"],
		[texturePackerId, "texture-packer", "array"],
	]);
	expect(created.sidecars.map(({ sha256 }) => sha256)).toEqual([
		digest(asepriteBytes),
		digest(texturePackerBytes),
	]);
	expect(created.fields).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ field: "frame", key: "button" }),
			expect.objectContaining({ field: "tag", key: "idle" }),
			expect.objectContaining({ field: "nine-slice", key: "button" }),
		])
	);
	const frameField = created.fields.find(
		(field) => field.field === "frame" && field.key === "button"
	);
	expect(frameField?.value).toEqual({
		frame: { h: 20, w: 30, x: 0, y: 0 },
	});
	expect(created.fields).toContainEqual(
		expect.objectContaining({
			field: "duration",
			key: "button",
			sourcePath: "frames.button.duration",
			value: 100,
		})
	);
	expect(created.conflicts.map(({ field, key }) => [field, key])).toEqual([
		["pivot", "button"],
	]);

	expect(
		(await client.imports.listSourceMetadataMappingProposals({
			entryId: sourceId,
			projectId,
		})) as unknown
	).toEqual([created]);
});

test("rejects malformed and unsupported sidecars without saving proposals", async () => {
	const { app, client } = mountTestApp();
	const sourceId = crypto.randomUUID();
	const invalidJsonId = crypto.randomUUID();
	const unsupportedId = crypto.randomUUID();
	const sourceBytes = Uint8Array.from([137, 80, 78, 71]);
	const invalidJsonBytes = new TextEncoder().encode("{not json");
	const unsupportedBytes = new TextEncoder().encode(
		JSON.stringify({
			frames: {
				button: { frame: { h: 20, w: 30, x: 0, y: 0 } },
			},
			meta: {
				app: "https://example.com/sprite-editor",
				version: "1.0",
			},
		})
	);
	const uploads = await Promise.all([
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("source.png", sourceBytes, sourceId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("bad-sidecar.json", invalidJsonBytes, invalidJsonId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("unknown-format.json", unsupportedBytes, unsupportedId)
		),
	]);
	expect(uploads.map((uploaded) => uploaded.status)).toEqual([201, 201, 201]);
	await expectProcedureError(
		client.imports.createSourceMetadataMappingProposal({
			entryId: sourceId,
			input: { sidecarEntryIds: [invalidJsonId] },
			projectId,
		}),
		{
			code: "UNPROCESSABLE_CONTENT",
			message: "Invalid source metadata JSON",
			status: 422,
		}
	);
	await expectProcedureError(
		client.imports.createSourceMetadataMappingProposal({
			entryId: sourceId,
			input: { sidecarEntryIds: [unsupportedId] },
			projectId,
		}),
		{
			code: "UNPROCESSABLE_CONTENT",
			message: "Unsupported source metadata format",
			status: 422,
		}
	);

	expect(
		await client.imports.listSourceMetadataMappingProposals({
			entryId: sourceId,
			projectId,
		})
	).toEqual([]);
});

test("reads Aseprite array and TexturePacker hash layouts from JSON structure", async () => {
	const { app, client } = mountTestApp();
	const sourceId = crypto.randomUUID();
	const asepriteId = crypto.randomUUID();
	const texturePackerId = crypto.randomUUID();
	const sourceBytes = Uint8Array.from([137, 80, 78, 71]);
	const asepriteBytes = new TextEncoder().encode(
		JSON.stringify({
			frames: [
				{
					duration: 80,
					filename: "walk-0",
					frame: { h: 16, w: 16, x: 0, y: 0 },
				},
			],
			meta: {
				app: "https://aseprite.org/",
				image: "walk.png",
				palette: [{ a: 255, b: 0, g: 0, r: 0 }],
				version: "1.3.10",
			},
		})
	);
	const texturePackerBytes = new TextEncoder().encode(
		JSON.stringify({
			frames: {
				"walk-0": {
					frame: { h: 16, w: 16, x: 0, y: 0 },
					pivot: { x: 0.5, y: 1 },
				},
			},
			meta: {
				app: "https://www.codeandweb.com/texturepacker",
				image: "walk.png",
				version: "1.0",
			},
		})
	);
	const uploads = await Promise.all([
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("walk.png", sourceBytes, sourceId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("opaque-a", asepriteBytes, asepriteId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("opaque-b", texturePackerBytes, texturePackerId)
		),
	]);
	expect(uploads.map((uploaded) => uploaded.status)).toEqual([201, 201, 201]);

	const proposal = (await client.imports.createSourceMetadataMappingProposal({
		entryId: sourceId,
		input: { sidecarEntryIds: [asepriteId, texturePackerId] },
		projectId,
	})) as {
		fields: Array<{ field: string; key: string }>;
		sidecars: Array<{ format: string; jsonLayout: string }>;
	};
	expect(
		proposal.sidecars.map(({ format, jsonLayout }) => [format, jsonLayout])
	).toEqual([
		["aseprite", "array"],
		["texture-packer", "hash"],
	]);
	expect(proposal.fields).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ field: "frame", key: "walk-0" }),
			expect.objectContaining({ field: "pivot", key: "walk-0" }),
			expect.objectContaining({ field: "palette", key: "palette" }),
		])
	);
});

test("marks gameplay metadata unknown when the sidecar has no direct pivot source", async () => {
	const { app, client } = mountTestApp();
	const sourceId = crypto.randomUUID();
	const sidecarId = crypto.randomUUID();
	const sourceBytes = Uint8Array.from([137, 80, 78, 71]);
	const sidecarBytes = new TextEncoder().encode(
		JSON.stringify({
			frames: [
				{
					filename: "walk-0",
					frame: { h: 16, w: 16, x: 0, y: 0 },
				},
			],
			meta: {
				app: "https://aseprite.org/",
				version: "1.3.10",
			},
		})
	);
	const uploads = await Promise.all([
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("walk.png", sourceBytes, sourceId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("metadata.json", sidecarBytes, sidecarId)
		),
	]);
	expect(uploads.map((upload) => upload.status)).toEqual([201, 201]);

	const proposal = (await client.imports.createSourceMetadataMappingProposal({
		entryId: sourceId,
		input: { sidecarEntryIds: [sidecarId] },
		projectId,
	})) as {
		suggestions: { gameplayMetadata: { reason: string; status: string } };
	};
	expect(proposal.suggestions.gameplayMetadata).toEqual({
		reason: "project-context-required",
		status: "unknown",
	});
});

test("protects source metadata proposals with project access and inbox membership", async () => {
	const { anonymousClient, app, client } = mountTestApp();
	const sourceId = crypto.randomUUID();
	const sourceUpload = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("source.png", Uint8Array.from([137, 80, 78, 71]), sourceId)
	);
	expect(sourceUpload.status).toBe(201);
	const request = {
		entryId: sourceId,
		input: { sidecarEntryIds: [crypto.randomUUID()] },
		projectId,
	};
	await expectProcedureError(
		anonymousClient.imports.createSourceMetadataMappingProposal(request),
		{ code: "UNAUTHORIZED", status: 401 }
	);
	await expectProcedureError(
		anonymousClient.imports.listSourceMetadataMappingProposals({
			entryId: sourceId,
			projectId,
		}),
		{ code: "UNAUTHORIZED", status: 401 }
	);

	await expectProcedureError(
		client.imports.createSourceMetadataMappingProposal(request),
		{ code: "NOT_FOUND", status: 404 }
	);

	await expectProcedureError(
		client.imports.createSourceMetadataMappingProposal({
			...request,
			projectId: otherProjectId,
		}),
		{ code: "NOT_FOUND", status: 404 }
	);
	await expectProcedureError(
		client.imports.listSourceMetadataMappingProposals({
			entryId: sourceId,
			projectId: otherProjectId,
		}),
		{ code: "NOT_FOUND", status: 404 }
	);
	await expectProcedureError(
		client.imports.listSourceMetadataMappingProposals({
			entryId: crypto.randomUUID(),
			projectId,
		}),
		{ code: "NOT_FOUND", status: 404 }
	);
	await expectProcedureError(
		client.imports.listSourceMetadataMappingProposals({
			entryId: "not-an-identifier",
			projectId,
		}),
		{ code: "NOT_FOUND", status: 404 }
	);
});

test("lists Import Inbox Entries only for an authenticated user with project access", async () => {
	const { anonymousClient, client } = mountTestApp();
	await expectProcedureError(
		anonymousClient.imports.listEntries({ projectId }),
		{
			code: "UNAUTHORIZED",
			status: 401,
		}
	);
	await expectProcedureError(
		client.imports.listEntries({ projectId: otherProjectId }),
		{ code: "NOT_FOUND", status: 404 }
	);
	await expectProcedureError(
		client.imports.listEntries({ projectId: "not-an-identifier" }),
		{ code: "NOT_FOUND", status: 404 }
	);
	expect(await client.imports.listEntries({ projectId })).toEqual([]);
});

test("allows an optional nine-slice conflict to remain unknown when the frame is unchanged", async () => {
	const { app, client, targetAssetRecordId, createdVersions } = mountTestApp();
	const imageBytes = await sharp({
		create: { width: 1, height: 1, channels: 4, background: "white" },
	})
		.png()
		.toBuffer();
	const sourceId = crypto.randomUUID();
	const firstSidecarId = crypto.randomUUID();
	const secondSidecarId = crypto.randomUUID();
	const sidecar = (insets: number) =>
		new TextEncoder().encode(
			JSON.stringify({
				frames: [
					{
						filename: "walk-0",
						frame: {
							h: 1,
							w: 1,
							x: 0,
							y: 0,
						},
						nineSlice: {
							bottom: insets,
							left: insets,
							right: insets,
							top: insets,
						},
					},
				],
				meta: {
					app: "https://aseprite.org/",
					image: "source.png",
					version: "1.3.10",
				},
			})
		);
	const uploads = await Promise.all([
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("source.png", imageBytes, sourceId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("first.json", sidecar(1), firstSidecarId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("second.json", sidecar(2), secondSidecarId)
		),
	]);
	expect(uploads.map((response) => response.status)).toEqual([201, 201, 201]);

	const proposal = sourceMetadataMappingProposalSchema.parse(
		await client.imports.createSourceMetadataMappingProposal({
			entryId: sourceId,
			input: { sidecarEntryIds: [firstSidecarId, secondSidecarId] },
			projectId,
		})
	);
	expect(proposal.conflicts.map(({ field, key }) => [field, key])).toEqual([
		["nine-slice", "walk-0"],
	]);

	expect(
		await client.imports.finalizeSourceMetadataMapping({
			entryId: sourceId,
			input: {
				assetRecordId: targetAssetRecordId,
				decisions: [
					{
						field: "nine-slice",
						key: "walk-0",
						sourceEntryId: null,
						sourcePath: null,
					},
				],
			},
			projectId,
			proposalId: proposal.id,
		})
	).toMatchObject({
		assetRecordId: targetAssetRecordId,
		decisions: [
			{
				field: "nine-slice",
				key: "walk-0",
				sourceEntryId: null,
				sourcePath: null,
			},
		],
	});
	expect(createdVersions).toHaveLength(1);
});

test("finalizes a source metadata mapping into one rereadable Candidate Version", async () => {
	const {
		anonymousClient,
		app,
		client,
		rpcApp,
		sourceMetadataMappingProposalStore,
		targetAssetRecordId,
		createdVersions,
	} = mountTestApp();
	const bytes = await sharp({
		create: { width: 1, height: 1, channels: 4, background: "white" },
	})
		.png()
		.toBuffer();
	const sourceId = crypto.randomUUID();
	const sourceUpload = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("hero.png", bytes, sourceId)
	);
	expect(sourceUpload.status).toBe(201);
	const sidecarId = crypto.randomUUID();
	const otherSidecarId = crypto.randomUUID();
	const frame = (sourceEntryId: string, x: number) => ({
		field: "frame" as const,
		key: "walk",
		sourceEntryId,
		sourceFileName: `${x}.json`,
		sourceFormat: "aseprite" as const,
		sourcePath: "frames.walk",
		value: { frame: { x, y: 0, w: 1, h: 1 } },
	});
	const pivot = (sourceEntryId: string, x: number) => ({
		field: "pivot" as const,
		key: "walk",
		sourceEntryId,
		sourceFileName: `${x}.json`,
		sourceFormat: "aseprite" as const,
		sourcePath: "frames.walk.pivot",
		value: { x, y: 0 },
	});
	const proposal: SourceMetadataMappingProposal = {
		id: crypto.randomUUID(),
		projectId,
		createdAt: new Date().toISOString(),
		contractVersion: "source-metadata-mapping/1.1.0",
		diagnostics: [],
		source: { entryId: sourceId, fileName: "hero.png", sha256: digest(bytes) },
		sidecars: [
			{
				entryId: sidecarId,
				fileName: "one.json",
				format: "aseprite",
				jsonLayout: "hash",
				sha256: "b".repeat(64),
				version: "1",
			},
		],
		suggestions: {
			assetFamilyLinks: { status: "unknown", reason: "no-source-evidence" },
			requiredSetLinks: { status: "unknown", reason: "no-source-evidence" },
			gameplayMetadata: {
				status: "unknown",
				reason: "project-context-required",
			},
		},
		fields: [
			frame(sidecarId, 0),
			frame(otherSidecarId, 1),
			pivot(sidecarId, 0),
			pivot(otherSidecarId, 1),
		],
		conflicts: [
			{
				field: "frame",
				key: "walk",
				candidates: [frame(sidecarId, 0), frame(otherSidecarId, 1)],
			},
			{
				field: "pivot",
				key: "walk",
				candidates: [pivot(sidecarId, 0), pivot(otherSidecarId, 1)],
			},
		],
	};
	sourceMetadataMappingProposalStore.proposals.set(sourceId, [proposal]);
	const location = { entryId: sourceId, projectId, proposalId: proposal.id };
	const input = {
		assetRecordId: targetAssetRecordId,
		decisions: [
			{
				field: "frame" as const,
				key: "walk",
				sourceEntryId: sidecarId,
				sourcePath: "frames.walk",
			},
		],
	};
	expect(
		await client.imports.getSourceMetadataMappingFinalization(location)
	).toBeNull();
	await expectProcedureError(
		client.imports.finalizeSourceMetadataMapping({
			...location,
			input: { assetRecordId: targetAssetRecordId, decisions: [] },
		}),
		{
			code: "UNPROCESSABLE_CONTENT",
			message: "Invalid source metadata mapping decisions",
			status: 422,
		}
	);
	expect(createdVersions).toHaveLength(0);
	const oversized = await rpcApp.request(
		"/rpc/imports/finalizeSourceMetadataMapping",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "x".repeat(1024 * 1024 + 1),
		}
	);
	expect(oversized.status).toBe(413);
	expect(await oversized.json()).toMatchObject({
		json: {
			code: "PAYLOAD_TOO_LARGE",
			message: "Source metadata finalization request exceeds the maximum size",
			status: 413,
		},
	});
	const result = await client.imports.finalizeSourceMetadataMapping({
		...location,
		input,
	});
	expect(result).toMatchObject({
		proposalId: proposal.id,
		assetRecordId: targetAssetRecordId,
		assetVersionId: proposal.id,
		decisions: [
			{
				field: "frame",
				key: "walk",
				sourceEntryId: sidecarId,
				sourcePath: "frames.walk",
			},
			{ field: "pivot", key: "walk", sourceEntryId: null, sourcePath: null },
		],
	});
	expect(createdVersions).toEqual([proposal.id]);
	expect(
		await client.imports.finalizeSourceMetadataMapping({ ...location, input })
	).toEqual(result);
	expect(createdVersions).toEqual([proposal.id]);
	expect(
		await client.imports.getSourceMetadataMappingFinalization(location)
	).toEqual(result);
	await expectProcedureError(
		client.imports.finalizeSourceMetadataMapping({
			...location,
			input: { ...input, assetRecordId: crypto.randomUUID() },
		}),
		{ code: "NOT_FOUND", status: 404 }
	);
	await expectProcedureError(
		client.imports.finalizeSourceMetadataMapping({
			...location,
			input: {
				...input,
				decisions: [
					{
						field: "frame",
						key: "walk",
						sourceEntryId: otherSidecarId,
						sourcePath: "frames.walk",
					},
				],
			},
		}),
		{
			code: "CONFLICT",
			message: "Source metadata mapping already finalized differently",
			status: 409,
		}
	);
	await expectProcedureError(
		client.imports.finalizeSourceMetadataMapping({
			...location,
			input: { assetRecordId: targetAssetRecordId, decisions: "none" as never },
		}),
		{ code: "BAD_REQUEST", status: 400 }
	);
	await expectProcedureError(
		client.imports.getSourceMetadataMappingFinalization({
			...location,
			proposalId: crypto.randomUUID(),
		}),
		{ code: "NOT_FOUND", status: 404 }
	);
	await expectProcedureError(
		anonymousClient.imports.getSourceMetadataMappingFinalization(location),
		{ code: "UNAUTHORIZED", status: 401 }
	);
	await expectProcedureError(
		anonymousClient.imports.finalizeSourceMetadataMapping({
			...location,
			input,
		}),
		{ code: "UNAUTHORIZED", status: 401 }
	);
});

test("continues to parse persisted source metadata mapping contract version 1.0", () => {
	const legacyProposal: SourceMetadataMappingProposal = {
		contractVersion: sourceMetadataMappingLegacyContractVersion,
		conflicts: [],
		createdAt: new Date().toISOString(),
		diagnostics: [],
		fields: [
			{
				field: "frame",
				key: "button",
				sourceEntryId: crypto.randomUUID(),
				sourceFileName: "metadata.json",
				sourceFormat: "aseprite",
				sourcePath: "frames.button",
				value: {
					duration: 100,
					frame: { h: 20, w: 30, x: 0, y: 0 },
					pivot: { x: 0.5, y: 0.5 },
				},
			},
		],
		id: crypto.randomUUID(),
		projectId,
		sidecars: [
			{
				entryId: crypto.randomUUID(),
				fileName: "metadata.json",
				format: "aseprite",
				jsonLayout: "hash",
				sha256: "a".repeat(64),
				version: "1.3.10",
			},
		],
		source: {
			entryId: crypto.randomUUID(),
			fileName: "source.png",
			sha256: "b".repeat(64),
		},
		suggestions: {
			assetFamilyLinks: {
				reason: "no-source-evidence",
				status: "unknown",
			},
			gameplayMetadata: {
				reason: "project-context-required",
				status: "unknown",
			},
			requiredSetLinks: {
				reason: "no-source-evidence",
				status: "unknown",
			},
		},
	};

	expect(sourceMetadataMappingProposalSchema.parse(legacyProposal)).toEqual(
		legacyProposal
	);
});

test("rejects source metadata sidecars that exceed the parsing size limit", async () => {
	const { app, client } = mountTestApp();
	const sourceId = crypto.randomUUID();
	const sidecarId = crypto.randomUUID();
	const sourceBytes = Uint8Array.from([137, 80, 78, 71]);
	const oversizedBytes = new Uint8Array(5 * 1024 * 1024 + 1).fill(32);
	const uploads = await Promise.all([
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("source.png", sourceBytes, sourceId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("sidecar.json", oversizedBytes, sidecarId)
		),
	]);
	expect(uploads.map((upload) => upload.status)).toEqual([201, 201]);

	await expectProcedureError(
		client.imports.createSourceMetadataMappingProposal({
			entryId: sourceId,
			input: { sidecarEntryIds: [sidecarId] },
			projectId,
		}),
		{
			code: "PAYLOAD_TOO_LARGE",
			message: "Source metadata sidecars exceed the maximum size",
			status: 413,
		}
	);
});

test("rejects source metadata sidecars whose aggregate size exceeds the parsing limit", async () => {
	const { app, client } = mountTestApp();
	const sourceId = crypto.randomUUID();
	const sidecarIds = [crypto.randomUUID(), crypto.randomUUID()];
	const sourceBytes = Uint8Array.from([137, 80, 78, 71]);
	const aggregateOversizeBytes = new Uint8Array(4 * 1024 * 1024 + 1).fill(32);
	const uploads = await Promise.all([
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("source.png", sourceBytes, sourceId)
		),
		...sidecarIds.map((sidecarId, index) =>
			app.request(
				`/api/projects/${projectId}/import-inbox`,
				uploadRequest(
					`sidecar-${index}.json`,
					aggregateOversizeBytes,
					sidecarId
				)
			)
		),
	]);
	expect(uploads.map((upload) => upload.status)).toEqual([201, 201, 201]);

	await expectProcedureError(
		client.imports.createSourceMetadataMappingProposal({
			entryId: sourceId,
			input: { sidecarEntryIds: sidecarIds },
			projectId,
		}),
		{
			code: "PAYLOAD_TOO_LARGE",
			message: "Source metadata sidecars exceed the maximum size",
			status: 413,
		}
	);
});

test("bounds source metadata proposal input size and sidecar count", async () => {
	const { client, rpcApp } = mountTestApp();
	const sourceId = crypto.randomUUID();
	await expectProcedureError(
		client.imports.createSourceMetadataMappingProposal({
			entryId: sourceId,
			input: {
				sidecarEntryIds: Array.from({ length: 11 }, () => crypto.randomUUID()),
			},
			projectId,
		}),
		{ code: "BAD_REQUEST", status: 400 }
	);

	const oversizedRequestBody = await rpcApp.request(
		"/rpc/imports/createSourceMetadataMappingProposal",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: `${JSON.stringify({
				json: {
					entryId: sourceId,
					input: { sidecarEntryIds: [crypto.randomUUID()] },
					projectId,
				},
			})}${" ".repeat(8192)}`,
		}
	);
	expect(oversizedRequestBody.status).toBe(413);
	expect(oversizedRequestBody.headers.get("cache-control")).toBe(
		"private, no-store"
	);
	expect(await oversizedRequestBody.json()).toMatchObject({
		json: {
			code: "PAYLOAD_TOO_LARGE",
			message: "Source metadata proposal request exceeds the maximum size",
			status: 413,
		},
	});
});

test("answers Import Inbox procedures privately and uncached", async () => {
	const { rpcApp } = mountTestApp();
	const response = await rpcApp.request("/rpc/imports/listEntries", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ json: { projectId } }),
	});
	expect(response.status).toBe(200);
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(await response.json()).toMatchObject({ json: [] });
});

test("reports a sidecar storage failure from the proposal procedure with a support reference", async () => {
	const { app, client, storageState } = mountTestApp();
	const sourceId = crypto.randomUUID();
	const sidecarId = crypto.randomUUID();
	const uploads = await Promise.all([
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("source.png", Uint8Array.from([137, 80, 78, 71]), sourceId)
		),
		app.request(
			`/api/projects/${projectId}/import-inbox`,
			uploadRequest("sidecar.json", new TextEncoder().encode("{}"), sidecarId)
		),
	]);
	expect(uploads.map((upload) => upload.status)).toEqual([201, 201]);
	storageState.failGet = true;

	const error = await client.imports
		.createSourceMetadataMappingProposal({
			entryId: sourceId,
			input: { sidecarEntryIds: [sidecarId] },
			projectId,
		})
		.catch((caught: unknown) => caught);
	expect(error).toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
		data: { supportReference: expect.stringMatching(supportReferencePattern) },
		status: 500,
	});
});
