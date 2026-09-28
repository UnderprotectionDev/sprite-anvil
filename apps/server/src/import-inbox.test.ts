import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type {
	ImportInboxEntry,
	ImportInboxFileRecord,
	ImportInboxStore,
	ImportInboxUploadInput,
} from "@sprite-anvil/api/import-inbox";
import { importInboxEntrySchema } from "@sprite-anvil/api/import-inbox";
import { Hono } from "hono";
import { mountImportInboxRoutes } from "./features/imports/server/import-inbox-routes";

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

function mountTestApp() {
	const store = new MemoryImportInboxStore();
	const objects = new Map<string, Uint8Array>();
	const deletedKeys: string[] = [];
	let uploadAttempt = 0;
	const app = new Hono();
	mountImportInboxRoutes(app, {
		importInboxStore: store,
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

	return { app, deletedKeys, objects, store };
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
