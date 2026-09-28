import { expect, test } from "bun:test";
import type {
	ManagedSnapshotFileRecord,
	ManagedSnapshotStore,
} from "@sprite-anvil/api/production-provenance";
import { managedSnapshotSummarySchema } from "@sprite-anvil/api/production-provenance";
import { Hono } from "hono";
import {
	type ManagedSnapshotRouteDependencies,
	mountManagedSnapshotRoutes,
} from "./managed-snapshot-routes";

const projectId = "managed-snapshot-project";
const assetVersionId = "a17f5ff0-a50d-438f-8bf2-a0152b42c301";
const assetRecordId = "a17f5ff0-a50d-438f-8bf2-a0152b42c302";
const userId = "managed-snapshot-user";
const sourceBytes = new TextEncoder().encode("abc");
const sourceDigest =
	"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
type ManagedSnapshotSession = Awaited<
	ReturnType<ManagedSnapshotRouteDependencies["getSession"]>
>;

function createHarness(
	session: ManagedSnapshotSession = { user: { id: userId } }
) {
	const snapshots = new Map<string, ManagedSnapshotFileRecord>();
	const storedObjects = new Map<string, Uint8Array>();
	const store: ManagedSnapshotStore = {
		getAssetVersionForUser: (requestedUserId, requestedProjectId, versionId) =>
			Promise.resolve(
				requestedUserId === userId &&
					requestedProjectId === projectId &&
					versionId === assetVersionId
					? { assetRecordId }
					: null
			),
		create: (_requestedUserId, { id, ...input }) => {
			const record: ManagedSnapshotFileRecord = {
				assetRecordId,
				assetVersionId,
				byteSize: input.byteSize,
				createdAt: "2026-09-28T12:00:00.000Z",
				fileName: input.fileName,
				id,
				downloadUrl: `/api/projects/${projectId}/managed-snapshots/${id}/content`,
				objectKey: input.objectKey,
				projectId,
				sha256: input.sha256,
			};
			snapshots.set(id, record);
			return Promise.resolve({
				kind: "created",
				snapshot: {
					assetVersionId: record.assetVersionId,
					byteSize: record.byteSize,
					createdAt: record.createdAt,
					downloadUrl: record.downloadUrl,
					fileName: record.fileName,
					id: record.id,
					sha256: record.sha256,
				},
			});
		},
		list: (_requestedUserId, requestedProjectId, versionId) =>
			Promise.resolve(
				requestedProjectId === projectId && versionId === assetVersionId
					? [...snapshots.values()].map((snapshot) => ({
							assetVersionId: snapshot.assetVersionId,
							byteSize: snapshot.byteSize,
							createdAt: snapshot.createdAt,
							downloadUrl: snapshot.downloadUrl,
							fileName: snapshot.fileName,
							id: snapshot.id,
							sha256: snapshot.sha256,
						}))
					: null
			),
		getFileRecord: (_requestedUserId, requestedProjectId, snapshotId) =>
			Promise.resolve(
				requestedProjectId === projectId
					? (snapshots.get(snapshotId) ?? null)
					: null
			),
	};
	const dependencies: ManagedSnapshotRouteDependencies = {
		createId: () => crypto.randomUUID(),
		createStorage: () => ({
			async put(key, body) {
				storedObjects.set(
					key,
					new Uint8Array(await new Response(body).arrayBuffer())
				);
			},
			get(key) {
				const object = storedObjects.get(key);
				return Promise.resolve(
					object
						? {
								body: new ReadableStream<Uint8Array>({
									start(controller) {
										controller.enqueue(object.slice());
										controller.close();
									},
								}),
								contentLength: object.byteLength,
								contentType: "application/octet-stream",
							}
						: null
				);
			},
			delete(key) {
				storedObjects.delete(key);
				return Promise.resolve();
			},
		}),
		getProjectForUser: (requestedUserId, requestedProjectId) =>
			Promise.resolve(
				requestedUserId === userId && requestedProjectId === projectId
					? { id: projectId }
					: null
			),
		getSession: () => Promise.resolve(session),
		managedSnapshotStore: store,
	};
	const app = new Hono();
	mountManagedSnapshotRoutes(app, dependencies);
	return { app, storedObjects };
}

test("a user can preserve and retrieve an opaque external working file", async () => {
	const { app } = createHarness();
	const createResponse = await app.request(
		`/api/projects/${projectId}/asset-versions/${assetVersionId}/managed-snapshots`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/octet-stream",
				"X-Managed-Snapshot-File-Name": encodeURIComponent("warrior.aseprite"),
				"X-Managed-Snapshot-Size": sourceBytes.byteLength.toString(),
				"Idempotency-Key": "warrior-working-file-v1",
			},
			body: sourceBytes,
		}
	);

	expect(createResponse.status).toBe(201);
	const created = await createResponse.json();
	expect(created).toMatchObject({
		byteSize: 3,
		fileName: "warrior.aseprite",
		sha256: sourceDigest,
	});

	const listResponse = await app.request(
		`/api/projects/${projectId}/asset-versions/${assetVersionId}/managed-snapshots`
	);
	expect(listResponse.status).toBe(200);
	const [saved] = managedSnapshotSummarySchema
		.array()
		.parse(await listResponse.json());
	if (!saved) {
		throw new Error("The Managed Snapshot was not returned after upload.");
	}
	expect(saved).toMatchObject({
		byteSize: 3,
		fileName: "warrior.aseprite",
		sha256: sourceDigest,
	});

	const contentResponse = await app.request(saved.downloadUrl);
	expect(contentResponse.status).toBe(200);
	expect(new Uint8Array(await contentResponse.arrayBuffer())).toEqual(
		sourceBytes
	);
});

test("Managed Snapshot upload rejects unauthenticated requests", async () => {
	const { app } = createHarness(null);
	const response = await app.request(
		`/api/projects/${projectId}/asset-versions/${assetVersionId}/managed-snapshots`,
		{
			method: "POST",
			headers: {
				"X-Managed-Snapshot-File-Name": "warrior.aseprite",
				"X-Managed-Snapshot-Size": "3",
				"Idempotency-Key": "unauthorized-upload",
			},
			body: sourceBytes,
		}
	);

	expect(response.status).toBe(401);
});

test("Managed Snapshot upload rejects a byte count that does not match the file", async () => {
	const { app, storedObjects } = createHarness();
	const response = await app.request(
		`/api/projects/${projectId}/asset-versions/${assetVersionId}/managed-snapshots`,
		{
			method: "POST",
			headers: {
				"X-Managed-Snapshot-File-Name": "warrior.aseprite",
				"X-Managed-Snapshot-Size": "4",
				"Idempotency-Key": "wrong-file-length",
			},
			body: sourceBytes,
		}
	);

	expect(response.status).toBe(400);
	expect(storedObjects.size).toBe(0);
});
