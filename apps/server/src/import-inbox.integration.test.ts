import { expect, test } from "bun:test";
import {
	importInboxEntriesSchema,
	importInboxEntrySchema,
} from "@sprite-anvil/api/import-inbox";
import { createDb, getProjectForUser } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import { project } from "@sprite-anvil/db/schema/project";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { mountImportInboxRoutes } from "./features/imports/server/import-inbox-routes";
import { createImportInboxStore } from "./features/imports/server/import-inbox-store";

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
