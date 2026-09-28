import { expect, test } from "bun:test";
import {
	importInboxEntriesSchema,
	importInboxEntrySchema,
} from "@sprite-anvil/api/import-inbox";
import { sourceMetadataMappingProposalSchema } from "@sprite-anvil/api/source-metadata-mapping";
import { createDb, getProjectForUser } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import { project } from "@sprite-anvil/db/schema/project";
import { sourceMetadataMappingProposals } from "@sprite-anvil/db/schema/source-metadata-mapping";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { mountImportInboxRoutes } from "./features/imports/server/import-inbox-routes";
import { createImportInboxStore } from "./features/imports/server/import-inbox-store";
import { createSourceMetadataMappingProposalStore } from "./features/imports/server/source-metadata-mapping-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
const userId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const entryId = crypto.randomUUID();
const uploadAttemptId = crypto.randomUUID();
const sourceBytes = Uint8Array.from([
	65, 83, 69, 80, 82, 73, 84, 69, 0, 255, 32, 0, 128,
]);

function createTestStorage(objects: Map<string, Uint8Array>) {
	return () => ({
		delete: (key: string) => {
			objects.delete(key);
			return Promise.resolve();
		},
		get: (key: string) => {
			const bytes = objects.get(key);
			return Promise.resolve(
				bytes
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
					: null
			);
		},
		put: async (
			key: string,
			body: ReadableStream<Uint8Array>,
			_contentType: string,
			_contentLength?: number
		) => {
			objects.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
		},
	});
}

test.skipIf(!databaseUrl)(
	"rereads Import Inbox metadata and managed file content from persistent storage",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const objects = new Map<string, Uint8Array>();
		let insertedUser = false;
		let insertedProject = false;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Import Inbox Integration Test",
				email: `import-inbox-${userId}@example.test`,
			});
			insertedUser = true;
			await db.insert(project).values({
				id: projectId,
				name: "Import Inbox Persistence",
				ownerUserId: userId,
			});
			insertedProject = true;

			const firstApp = new Hono();
			mountImportInboxRoutes(firstApp, {
				importInboxStore: createImportInboxStore(db),
				sourceMetadataMappingProposalStore:
					createSourceMetadataMappingProposalStore(db),
				createId: () => uploadAttemptId,
				createStorage: createTestStorage(objects),
				getProjectForUser: (requestedUserId, requestedProjectId) =>
					getProjectForUser(db, requestedUserId, requestedProjectId),
				getSession: (headers) =>
					Promise.resolve(
						headers.get("authorization") === `Bearer ${userId}`
							? { user: { id: userId } }
							: null
					),
			});
			const upload = await firstApp.request(
				`/api/projects/${projectId}/import-inbox`,
				{
					method: "POST",
					headers: {
						authorization: `Bearer ${userId}`,
						"content-type": "application/octet-stream",
						"x-import-inbox-size": String(sourceBytes.byteLength),
						"x-import-inbox-file-name": encodeURIComponent(
							" hero source.aseprite "
						),
						"x-import-inbox-source-type": "application/octet-stream",
						"idempotency-key": entryId,
					},
					body: sourceBytes,
				}
			);
			expect(upload.status).toBe(201);
			const created = importInboxEntrySchema.parse(await upload.json());
			expect(created.fileName).toBe(" hero source.aseprite ");

			const rereadDb = createDb({ DATABASE_URL: databaseUrl });
			const rereadApp = new Hono();
			mountImportInboxRoutes(rereadApp, {
				importInboxStore: createImportInboxStore(rereadDb),
				sourceMetadataMappingProposalStore:
					createSourceMetadataMappingProposalStore(rereadDb),
				createStorage: createTestStorage(objects),
				getProjectForUser: (requestedUserId, requestedProjectId) =>
					getProjectForUser(rereadDb, requestedUserId, requestedProjectId),
				getSession: (headers) =>
					Promise.resolve(
						headers.get("authorization") === `Bearer ${userId}`
							? { user: { id: userId } }
							: null
					),
			});
			const rereadList = await rereadApp.request(
				`/api/projects/${projectId}/import-inbox`,
				{ headers: { authorization: `Bearer ${userId}` } }
			);
			expect(rereadList.status).toBe(200);
			expect(importInboxEntriesSchema.parse(await rereadList.json())).toEqual([
				created,
			]);

			const rereadFile = await rereadApp.request(
				`/api/projects/${projectId}/import-inbox/${entryId}/file`,
				{ headers: { authorization: `Bearer ${userId}` } }
			);
			expect(rereadFile.status).toBe(200);
			expect(
				Array.from(new Uint8Array(await rereadFile.arrayBuffer()))
			).toEqual(Array.from(sourceBytes));
		} finally {
			await db
				.delete(sourceMetadataMappingProposals)
				.where(eq(sourceMetadataMappingProposals.projectId, projectId));
			await db
				.delete(importInboxEntries)
				.where(eq(importInboxEntries.projectId, projectId));
			if (insertedProject) {
				await db.delete(project).where(eq(project.id, projectId));
			}
			if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);

test.skipIf(!databaseUrl)(
	"persists a source metadata proposal that a new server instance can reread",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const objects = new Map<string, Uint8Array>();
		const proposalSourceEntryId = crypto.randomUUID();
		const sidecarEntryId = crypto.randomUUID();
		const proposalProjectId = crypto.randomUUID();
		const proposalUserId = crypto.randomUUID();
		let insertedUser = false;
		let insertedProject = false;
		const mappingSourceBytes = Uint8Array.from([
			137, 80, 78, 71, 13, 10, 26, 10,
		]);
		const sidecarBytes = new TextEncoder().encode(
			JSON.stringify({
				frames: {
					button: { frame: { h: 20, w: 30, x: 0, y: 0 } },
				},
				meta: {
					app: "http://www.aseprite.org/",
					image: "button-sheet.png",
					version: "1.3.10",
				},
			})
		);

		function uploadRequest(fileName: string, bytes: Uint8Array, id: string) {
			return {
				method: "POST",
				headers: {
					authorization: `Bearer ${proposalUserId}`,
					"content-type": "application/octet-stream",
					"x-import-inbox-size": String(bytes.byteLength),
					"x-import-inbox-file-name": encodeURIComponent(fileName),
					"x-import-inbox-source-type": "application/octet-stream",
					"idempotency-key": id,
				},
				body: bytes,
			};
		}

		function createApp(targetDb: ReturnType<typeof createDb>) {
			const app = new Hono();
			mountImportInboxRoutes(app, {
				importInboxStore: createImportInboxStore(targetDb),
				sourceMetadataMappingProposalStore:
					createSourceMetadataMappingProposalStore(targetDb),
				createStorage: createTestStorage(objects),
				getProjectForUser: (requestedUserId, requestedProjectId) =>
					getProjectForUser(targetDb, requestedUserId, requestedProjectId),
				getSession: (headers) =>
					Promise.resolve(
						headers.get("authorization") === `Bearer ${proposalUserId}`
							? { user: { id: proposalUserId } }
							: null
					),
			});
			return app;
		}

		try {
			await db.insert(user).values({
				id: proposalUserId,
				name: "Metadata Proposal Integration Test",
				email: `metadata-proposal-${proposalUserId}@example.test`,
			});
			insertedUser = true;
			await db.insert(project).values({
				id: proposalProjectId,
				name: "Source Metadata Proposal Persistence",
				ownerUserId: proposalUserId,
			});
			insertedProject = true;

			const firstApp = createApp(db);
			const sourceUpload = await firstApp.request(
				`/api/projects/${proposalProjectId}/import-inbox`,
				uploadRequest(
					"button-sheet.png",
					mappingSourceBytes,
					proposalSourceEntryId
				)
			);
			const sidecarUpload = await firstApp.request(
				`/api/projects/${proposalProjectId}/import-inbox`,
				uploadRequest("mapping-data.bin", sidecarBytes, sidecarEntryId)
			);
			expect(sourceUpload.status).toBe(201);
			expect(sidecarUpload.status).toBe(201);
			const proposalPath = `/api/projects/${proposalProjectId}/import-inbox/${proposalSourceEntryId}/source-metadata-mapping-proposals`;
			const createdResponse = await firstApp.request(proposalPath, {
				method: "POST",
				headers: {
					authorization: `Bearer ${proposalUserId}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({ sidecarEntryIds: [sidecarEntryId] }),
			});
			expect(createdResponse.status).toBe(201);
			const created = sourceMetadataMappingProposalSchema.parse(
				await createdResponse.json()
			);

			const rereadDb = createDb({ DATABASE_URL: databaseUrl });
			const rereadResponse = await createApp(rereadDb).request(proposalPath, {
				headers: { authorization: `Bearer ${proposalUserId}` },
			});
			expect(rereadResponse.status).toBe(200);
			expect(await rereadResponse.json()).toEqual([created]);
		} finally {
			await db
				.delete(sourceMetadataMappingProposals)
				.where(eq(sourceMetadataMappingProposals.projectId, proposalProjectId));
			await db
				.delete(importInboxEntries)
				.where(eq(importInboxEntries.projectId, proposalProjectId));
			if (insertedProject) {
				await db.delete(project).where(eq(project.id, proposalProjectId));
			}
			if (insertedUser) {
				await db.delete(user).where(eq(user.id, proposalUserId));
			}
		}
	}
);
