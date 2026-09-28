import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type {
	ImportInboxEntry,
	ImportInboxFileRecord,
	ImportInboxStore,
	ImportInboxUploadInput,
} from "@sprite-anvil/api/import-inbox";
import { importInboxEntrySchema } from "@sprite-anvil/api/import-inbox";
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
import { mountImportInboxRoutes } from "./features/imports/server/import-inbox-routes";
import { serializePublicApiError } from "./output-contracts";

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
	mountImportInboxRoutes(app, {
		assetVersionStore: {
			getAssetRecordForUpload: async (
				_userId,
				requestedProjectId,
				assetRecordId
			) =>
				requestedProjectId === projectId &&
				assetRecordId === targetAssetRecordId
					? { projectId, assetRecordId, assetFamilyId: crypto.randomUUID() }
					: null,
			// biome-ignore lint/suspicious/useAwait: The test store mirrors the asynchronous production contract.
			createCandidateVersion: async (_userId, input) => {
				const existed = createdVersions.includes(input.id);
				if (!existed) {
					createdVersions.push(input.id);
				}
				return {
					kind: existed ? ("existing" as const) : ("created" as const),
					version: {} as never,
				};
			},
		},
		importInboxStore: store,
		sourceMetadataMappingProposalStore,
		createId: () => {
			uploadAttempt += 1;
			return (
				"924eac6d-9fbb-44ce-b215-38f3774d95" +
				String(uploadAttempt).padStart(2, "0")
			);
		},
		createStorage: () => ({
			// biome-ignore lint/suspicious/useAwait: Storage methods mirror asynchronous network calls.
			delete: async (key) => {
				deletedKeys.push(key);
				objects.delete(key);
			},
			// biome-ignore lint/suspicious/useAwait: Storage methods mirror asynchronous network calls.
			get: async (key) => {
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
			put: async (key, body) => {
				objects.set(
					key,
					new Uint8Array(await new Response(body).arrayBuffer())
				);
			},
		}),
		getProjectForUser: async (requestedUserId, requestedProjectId) =>
			requestedUserId === userId && requestedProjectId === projectId
				? { id: projectId }
				: null,
		getSession: async (headers) =>
			headers.get("authorization") === `Bearer ${userId}`
				? { user: { id: userId } }
				: null,
	});

	return {
		app,
		targetAssetRecordId,
		createdVersions,
		deletedKeys,
		objects,
		sourceMetadataMappingProposalStore,
		storageState,
		store,
	};
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
	const { app, objects } = mountTestApp();
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

	const listResponse = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		{ headers: { authorization: `Bearer ${userId}` } }
	);
	expect(listResponse.status).toBe(200);
	expect(await listResponse.json()).toEqual([created]);

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
	const { app } = mountTestApp();
	const sourceFileName = " hero source.aseprite ";
	const response = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest(sourceFileName, opaqueAsepriteFile)
	);

	expect(response.status).toBe(201);
	const created = importInboxEntrySchema.parse(await response.json());
	expect(created.fileName).toBe(sourceFileName);

	const listResponse = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		{ headers: { authorization: `Bearer ${userId}` } }
	);
	expect(await listResponse.json()).toEqual([created]);

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
	const { app } = mountTestApp();
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

	const proposalPath = `/api/projects/${projectId}/import-inbox/${sourceId}/source-metadata-mapping-proposals`;
	const createdResponse = await app.request(proposalPath, {
		method: "POST",
		headers: {
			authorization: `Bearer ${userId}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({ sidecarEntryIds: [asepriteId, texturePackerId] }),
	});
	expect(createdResponse.status).toBe(201);
	const created = (await createdResponse.json()) as {
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

	const rereadResponse = await app.request(proposalPath, {
		headers: { authorization: `Bearer ${userId}` },
	});
	expect(rereadResponse.status).toBe(200);
	expect(await rereadResponse.json()).toEqual([created]);
});

test("rejects malformed and unsupported sidecars without saving proposals", async () => {
	const { app } = mountTestApp();
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
	const proposalPath = `/api/projects/${projectId}/import-inbox/${sourceId}/source-metadata-mapping-proposals`;
	const invalidJsonResponse = await app.request(proposalPath, {
		method: "POST",
		headers: {
			authorization: `Bearer ${userId}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({ sidecarEntryIds: [invalidJsonId] }),
	});
	expect(invalidJsonResponse.status).toBe(422);
	expect(await invalidJsonResponse.json()).toEqual({
		error: "Invalid source metadata JSON",
	});

	const unsupportedResponse = await app.request(proposalPath, {
		method: "POST",
		headers: {
			authorization: `Bearer ${userId}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({ sidecarEntryIds: [unsupportedId] }),
	});
	expect(unsupportedResponse.status).toBe(422);
	expect(await unsupportedResponse.json()).toEqual({
		error: "Unsupported source metadata format",
	});

	const reread = await app.request(proposalPath, {
		headers: { authorization: `Bearer ${userId}` },
	});
	expect(reread.status).toBe(200);
	expect(await reread.json()).toEqual([]);
});

test("reads Aseprite array and TexturePacker hash layouts from JSON structure", async () => {
	const { app } = mountTestApp();
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

	const response = await app.request(
		`/api/projects/${projectId}/import-inbox/${sourceId}/source-metadata-mapping-proposals`,
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${userId}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ sidecarEntryIds: [asepriteId, texturePackerId] }),
		}
	);
	expect(response.status).toBe(201);
	const proposal = (await response.json()) as {
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
	const { app } = mountTestApp();
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

	const response = await app.request(
		`/api/projects/${projectId}/import-inbox/${sourceId}/source-metadata-mapping-proposals`,
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${userId}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ sidecarEntryIds: [sidecarId] }),
		}
	);
	expect(response.status).toBe(201);
	const proposal = (await response.json()) as {
		suggestions: { gameplayMetadata: { reason: string; status: string } };
	};
	expect(proposal.suggestions.gameplayMetadata).toEqual({
		reason: "project-context-required",
		status: "unknown",
	});
});

test("protects source metadata proposals with project access and inbox membership", async () => {
	const { app } = mountTestApp();
	const sourceId = crypto.randomUUID();
	const sourceUpload = await app.request(
		`/api/projects/${projectId}/import-inbox`,
		uploadRequest("source.png", Uint8Array.from([137, 80, 78, 71]), sourceId)
	);
	expect(sourceUpload.status).toBe(201);
	const proposalPath = `/api/projects/${projectId}/import-inbox/${sourceId}/source-metadata-mapping-proposals`;
	const request = {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ sidecarEntryIds: [crypto.randomUUID()] }),
	};
	const unauthenticated = await app.request(proposalPath, request);
	expect(unauthenticated.status).toBe(401);

	const missingSidecar = await app.request(proposalPath, {
		...request,
		headers: {
			...request.headers,
			authorization: `Bearer ${userId}`,
		},
	});
	expect(missingSidecar.status).toBe(404);

	const inaccessibleProject = await app.request(
		`/api/projects/${otherProjectId}/import-inbox/${sourceId}/source-metadata-mapping-proposals`,
		{
			...request,
			headers: {
				...request.headers,
				authorization: `Bearer ${userId}`,
			},
		}
	);
	expect(inaccessibleProject.status).toBe(404);
});

test("finalizes a source metadata mapping into one rereadable Candidate Version", async () => {
	const {
		app,
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
	const path = `/api/projects/${projectId}/import-inbox/${sourceId}/source-metadata-mapping-proposals/${proposal.id}/finalization`;
	const request = {
		method: "POST",
		headers: {
			authorization: `Bearer ${userId}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			assetRecordId: targetAssetRecordId,
			decisions: [
				{
					field: "frame",
					key: "walk",
					sourceEntryId: sidecarId,
					sourcePath: "frames.walk",
				},
			],
		}),
	};
	expect(
		(
			await app.request(path, {
				...request,
				body: JSON.stringify({
					assetRecordId: targetAssetRecordId,
					decisions: [],
				}),
			})
		).status
	).toBe(422);
	expect(createdVersions).toHaveLength(0);
	const created = await app.request(path, request);
	expect(created.status).toBe(201);
	const result = await created.json();
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
	expect((await app.request(path, request)).status).toBe(200);
	expect(createdVersions).toEqual([proposal.id]);
	const reread = await app.request(path, {
		headers: { authorization: `Bearer ${userId}` },
	});
	expect(await reread.json()).toEqual(result);
	expect(
		(
			await app.request(path, {
				...request,
				body: JSON.stringify({
					assetRecordId: crypto.randomUUID(),
					decisions: [
						{
							field: "frame",
							key: "walk",
							sourceEntryId: sidecarId,
							sourcePath: "frames.walk",
						},
					],
				}),
			})
		).status
	).toBe(404);
	expect((await app.request(path, { method: "GET" })).status).toBe(401);
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
	const { app } = mountTestApp();
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

	const response = await app.request(
		`/api/projects/${projectId}/import-inbox/${sourceId}/source-metadata-mapping-proposals`,
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${userId}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ sidecarEntryIds: [sidecarId] }),
		}
	);
	expect(response.status).toBe(413);
	expect(await response.json()).toEqual({
		error: "Source metadata sidecars exceed the maximum size",
	});
});

test("rejects source metadata sidecars whose aggregate size exceeds the parsing limit", async () => {
	const { app } = mountTestApp();
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

	const response = await app.request(
		`/api/projects/${projectId}/import-inbox/${sourceId}/source-metadata-mapping-proposals`,
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${userId}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ sidecarEntryIds: sidecarIds }),
		}
	);
	expect(response.status).toBe(413);
	expect(await response.json()).toEqual({
		error: "Source metadata sidecars exceed the maximum size",
	});
});

test("bounds source metadata proposal input size and sidecar count", async () => {
	const { app } = mountTestApp();
	const sourceId = crypto.randomUUID();
	const proposalPath = `/api/projects/${projectId}/import-inbox/${sourceId}/source-metadata-mapping-proposals`;
	const headers = {
		authorization: `Bearer ${userId}`,
		"content-type": "application/json",
	};
	const excessiveSidecarCount = await app.request(proposalPath, {
		method: "POST",
		headers,
		body: JSON.stringify({
			sidecarEntryIds: Array.from({ length: 11 }, () => crypto.randomUUID()),
		}),
	});
	expect(excessiveSidecarCount.status).toBe(400);
	expect(await excessiveSidecarCount.json()).toEqual({
		error: "Invalid source metadata proposal",
	});

	const oversizedRequestBody = await app.request(proposalPath, {
		method: "POST",
		headers,
		body: `${JSON.stringify({ sidecarEntryIds: [crypto.randomUUID()] })}${" ".repeat(8192)}`,
	});
	expect(oversizedRequestBody.status).toBe(413);
	expect(await oversizedRequestBody.json()).toEqual({
		error: "Source metadata proposal request exceeds the maximum size",
	});
});
