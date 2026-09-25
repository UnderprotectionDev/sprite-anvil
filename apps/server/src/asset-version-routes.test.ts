import { expect, test } from "bun:test";
import { Hono } from "hono";
import {
	type AssetVersionRouteDependencies,
	type AssetVersionSession,
	mountAssetVersionRoutes,
} from "./features/asset-versions/server/asset-version-routes";

const projectId = "asset-version-route-project";
const assetRecordId = "a17f5ff0-a50d-438f-8bf2-a0152b42c3e9";
const userId = "asset-version-route-user";

function createRouteHarness(
	session: AssetVersionSession | null = { user: { id: userId } }
) {
	const calls = {
		candidateVersion: 0,
		delete: 0,
		put: 0,
		storage: 0,
	};
	const objects = new Map<string, Uint8Array>();
	const storage = {
		async put(
			key: string,
			body: ReadableStream<Uint8Array>,
			_contentType: "image/png" | "image/webp"
		) {
			calls.put += 1;
			objects.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
		},
		get: () => Promise.resolve(null),
		delete(key: string) {
			return Promise.resolve().then(() => {
				calls.delete += 1;
				objects.delete(key);
			});
		},
	};
	const dependencies: AssetVersionRouteDependencies = {
		assetVersionStore: {
			createCandidateVersion() {
				calls.candidateVersion += 1;
				return Promise.resolve(null);
			},
			getAssetRecordForUpload(
				requestedUserId,
				requestedProjectId,
				requestedRecordId
			) {
				return Promise.resolve(
					requestedUserId === userId &&
						requestedProjectId === projectId &&
						requestedRecordId === assetRecordId
						? {
								projectId,
								assetFamilyId: "asset-version-route-family",
								assetRecordId,
							}
						: null
				);
			},
			getFileRecord() {
				return Promise.resolve(null);
			},
			list() {
				return Promise.resolve(null);
			},
			recordReviewEvent() {
				return Promise.resolve(null);
			},
			selectCanonicalDesign() {
				return Promise.resolve(null);
			},
		},
		createStorage() {
			calls.storage += 1;
			return storage;
		},
		getProjectForUser: (requestedUserId, requestedProjectId) =>
			Promise.resolve(
				requestedUserId === userId && requestedProjectId === projectId
					? { id: projectId }
					: null
			),
		getSession: () => Promise.resolve(session),
	};
	const app = new Hono();
	mountAssetVersionRoutes(app, dependencies);
	return { app, calls, objects };
}

function upload(
	app: Hono,
	bytes: Uint8Array,
	declaredLength: number,
	contentType = "image/png"
) {
	return app.request(
		`/api/projects/${projectId}/asset-records/${assetRecordId}/versions`,
		{
			method: "POST",
			headers: {
				"Content-Type": contentType,
				"X-Asset-Version-File-Name": "upload.png",
				"X-Asset-Version-Size": declaredLength.toString(),
				"Idempotency-Key": "asset-version-route-test",
			},
			body: bytes,
		}
	);
}

test("denies Asset Version uploads before reading project or storage without a session", async () => {
	const { app, calls } = createRouteHarness(null);

	const response = await upload(app, new Uint8Array([1]), 1);

	expect(response.status).toBe(401);
	expect(calls.storage).toBe(0);
	expect(calls.candidateVersion).toBe(0);
});

test("rejects a declared upload length that is larger than the streamed content and removes the object", async () => {
	const { app, calls, objects } = createRouteHarness();

	const response = await upload(app, new Uint8Array([1]), 2);
	const error = await response.json();

	expect(response.status).toBe(400);
	expect(error).toMatchObject({
		error: "Invalid Asset Version content length",
	});
	expect(calls.put).toBe(1);
	expect(calls.delete).toBe(1);
	expect(calls.candidateVersion).toBe(0);
	expect(objects.size).toBe(0);
});

test("rejects streamed content that exceeds the declared length and removes the object", async () => {
	const { app, calls, objects } = createRouteHarness();

	const response = await upload(app, new Uint8Array([1, 2]), 1);
	const error = await response.json();

	expect(response.status).toBe(400);
	expect(error).toMatchObject({
		error: "Invalid Asset Version content length",
	});
	expect(calls.delete).toBe(1);
	expect(calls.candidateVersion).toBe(0);
	expect(objects.size).toBe(0);
});

test("rejects a PNG signature without a complete valid image", async () => {
	const { app, calls, objects } = createRouteHarness();

	const response = await upload(app, new Uint8Array([137, 80, 78, 71]), 4);
	const error = await response.json();

	expect(response.status).toBe(422);
	expect(error).toMatchObject({ error: "Invalid Asset Version image content" });
	expect(calls.candidateVersion).toBe(0);
	expect(calls.delete).toBe(1);
	expect(objects.size).toBe(0);
});
