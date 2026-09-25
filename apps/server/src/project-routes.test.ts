import { expect, test } from "bun:test";
import { createDb, getProjectForUser } from "@sprite-anvil/db";
import { user as userTable } from "@sprite-anvil/db/schema/auth";
import { project as projectTable } from "@sprite-anvil/db/schema/project";
import { betterAuth } from "better-auth";
import { type MemoryDB, memoryAdapter } from "better-auth/adapters/memory";
import { testUtils } from "better-auth/plugins";
import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { CloudflareConfig } from "./cloudflare";
import {
	mountProjectRoutes,
	type ProjectRouteDependencies,
} from "./features/projects/server/project-routes";
import {
	projectSummaryResponseSchema,
	publicApiErrorSchema,
	twoDVisualAssetAcceptedResponseSchema,
} from "./output-contracts";

const projectId = "00000000-0000-4000-8000-000000000001";
const twoDVisualAssetId = "00000000-0000-4000-8000-000000000002";
const secretMaterialPattern =
	/X-Amz-|access[-_ ]?key|secret[-_ ]?key|access[-_ ]?token|encryption[-_ ]?key|server[-_ ]?secret|password|authorization|credential|token|https?:\/\//i;
const cloudflareConfig: CloudflareConfig = {
	CLOUDFLARE_ACCOUNT_ID: "test-account",
	CLOUDFLARE_QUEUE_ID: "test-queue",
	CLOUDFLARE_QUEUES_TOKEN: "test-queue-token",
	R2_ACCESS_KEY_ID: "test-access-key",
	R2_SECRET_ACCESS_KEY: "test-secret-key",
	R2_BUCKET: "test-assets",
};

function createTestAuth() {
	const database: MemoryDB = {};
	const auth = betterAuth({
		baseURL: "http://localhost:3000",
		database: memoryAdapter(database),
		emailAndPassword: { enabled: true },
		plugins: [testUtils()],
		secret: "sprite-anvil-integration-test-secret-at-least-32-characters",
	});

	return { auth, database };
}

async function createUserSession(
	auth: ReturnType<typeof createTestAuth>["auth"],
	userId: string
) {
	const context = await auth.$context;
	const user = await context.test.saveUser(
		context.test.createUser({
			email: `${userId}@example.test`,
			id: userId,
		})
	);
	const login = await context.test.login({ userId: user.id });
	return { headers: login.headers, session: login.session };
}

function createTestApp(
	auth: ReturnType<typeof createTestAuth>["auth"],
	overrides: {
		getProjectForUser?: ProjectRouteDependencies["getProjectForUser"];
		getSession?: ProjectRouteDependencies["getSession"];
		createId?: () => string;
		failQueue?: boolean;
	} = {}
) {
	const calls = {
		cloudflareConfig: 0,
		getProjectForUser: [] as { projectId: string; userId: string }[],
		getObject: [] as string[],
		putObject: [] as { contentType: string; key: string; body: string }[],
		deletedKeys: [] as string[],
		queuedKeys: [] as string[],
	};
	const app = new Hono();
	app.onError((_error, c) => c.json({ error: "Internal Server Error" }, 500));

	mountProjectRoutes(app, {
		getSession:
			overrides.getSession ?? ((headers) => auth.api.getSession({ headers })),
		getProjectForUser: (userId, id) => {
			calls.getProjectForUser.push({ projectId: id, userId });
			if (overrides.getProjectForUser) {
				return overrides.getProjectForUser(userId, id);
			}
			return Promise.resolve(
				userId === "user-a" && id === projectId
					? {
							id: projectId,
							name: "Ash Knight",
							ownerUserId: userId,
							previewKey: `users/${userId}/preview.png`,
							accessToken: "provider-access-token",
							encryptionKey: "project-encryption-key",
						}
					: null
			);
		},
		cloudflareConfig: () => {
			calls.cloudflareConfig += 1;
			return cloudflareConfig;
		},
		createStorage: () => ({
			delete: (key) => {
				calls.deletedKeys.push(key);
				return Promise.resolve();
			},
			get: (key) => {
				calls.getObject.push(key);
				return Promise.resolve({
					body: new Blob(["sprite-bytes"]).stream(),
					contentLength: 12,
					contentType: "image/png",
				});
			},
			put: async (key, body, contentType) => {
				calls.putObject.push({
					contentType,
					key,
					body: await new Response(body).text(),
				});
			},
		}),
		createQueue: () => ({
			send: (key) => {
				calls.queuedKeys.push(key);
				if (overrides.failQueue) {
					return Promise.reject(
						new Error("queue token leaked in this message")
					);
				}
				return Promise.resolve();
			},
		}),
		createId: overrides.createId ?? (() => twoDVisualAssetId),
	});

	return { app, calls };
}

test("denies unauthenticated project reads before looking up project data", async () => {
	const { auth } = createTestAuth();
	const { app, calls } = createTestApp(auth);

	const response = await app.request(`/api/projects/${projectId}`);

	expect(response.status).toBe(401);
	expect(await response.json()).toEqual({ error: "Unauthorized" });
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(calls.getProjectForUser).toEqual([]);
	optedOutOfStorage(calls);
});

test("returns only the authenticated user's public project fields", async () => {
	const { auth } = createTestAuth();
	const user = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth);
	const response = await app.request(`/api/projects/${projectId}`, {
		headers: new Headers({ cookie: user.headers.get("cookie") ?? "" }),
	});

	expect(response.status).toBe(200);
	const payload: unknown = await response.json();
	expect(payload).toEqual({
		id: projectId,
		name: "Ash Knight",
		previewUrl: `/api/projects/${projectId}/preview`,
	});
	expect(JSON.stringify(payload)).not.toMatch(secretMaterialPattern);
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(calls.getProjectForUser).toEqual([{ projectId, userId: "user-a" }]);
	optedOutOfStorage(calls);
});

test("strict output contracts reject credential-shaped fields", () => {
	expect(
		projectSummaryResponseSchema.safeParse({
			id: projectId,
			name: "Ash Knight",
			previewUrl: null,
			encryptionKey: "project-encryption-key",
		}).success
	).toBe(false);
	expect(
		projectSummaryResponseSchema.safeParse({
			id: projectId,
			name: "Ash Knight",
			previewUrl: "https://2d-visual-assets.example.test/preview",
		}).success
	).toBe(false);
	expect(
		twoDVisualAssetAcceptedResponseSchema.safeParse({
			twoDVisualAssetId,
			accessToken: "storage-access-token",
		}).success
	).toBe(false);
	expect(
		publicApiErrorSchema.safeParse({
			error: "2D Visual Asset upload failed",
			serverSecret: "database-password",
		}).success
	).toBe(false);
});

test("denies malformed sessions before looking up the project", async () => {
	const { auth } = createTestAuth();
	const { app, calls } = createTestApp(auth);
	const response = await app.request(`/api/projects/${projectId}`, {
		headers: new Headers({ cookie: "better-auth.session_token=malformed" }),
	});

	expect(response.status).toBe(401);
	expect(await response.json()).toEqual({ error: "Unauthorized" });
	expect(calls.getProjectForUser).toEqual([]);
	optedOutOfStorage(calls);
});

test("denies another user's project reads and previews before object access", async () => {
	const { auth } = createTestAuth();
	const otherUser = await createUserSession(auth, "user-b");
	const { app, calls } = createTestApp(auth);
	const headers = new Headers(
		otherUser.headers.get("cookie")
			? { cookie: otherUser.headers.get("cookie") ?? "" }
			: undefined
	);

	const projectResponse = await app.request(`/api/projects/${projectId}`, {
		headers,
	});
	const previewResponse = await app.request(
		`/api/projects/${projectId}/2d-visual-assets/${twoDVisualAssetId}/preview`,
		{ headers }
	);
	const uploadResponse = await app.request(
		`/api/projects/${projectId}/2d-visual-assets`,
		{
			method: "POST",
			headers: new Headers({
				cookie: otherUser.headers.get("cookie") ?? "",
				"content-type": "image/png",
			}),
			body: "sprite-bytes",
		}
	);

	expect(projectResponse.status).toBe(404);
	expect(previewResponse.status).toBe(404);
	expect(uploadResponse.status).toBe(404);
	expect(calls.getProjectForUser).toEqual([
		{ projectId, userId: "user-b" },
		{ projectId, userId: "user-b" },
		{ projectId, userId: "user-b" },
	]);
	optedOutOfStorage(calls);
});

test("rejects expired sessions before looking up the project", async () => {
	const { auth, database } = createTestAuth();
	const userSession = await createUserSession(auth, "user-a");
	const sessionRecord = database.session?.find(
		(record) => record.id === userSession.session.id
	);
	if (!sessionRecord) {
		throw new Error("Expected the test session to be stored in memory");
	}
	sessionRecord.expiresAt = new Date(Date.now() - 1000);

	const { app, calls } = createTestApp(auth);
	const response = await app.request(`/api/projects/${projectId}`, {
		headers: new Headers({
			cookie: userSession.headers.get("cookie") ?? "",
		}),
	});

	expect(response.status).toBe(401);
	expect(await response.json()).toEqual({ error: "Unauthorized" });
	expect(calls.getProjectForUser).toEqual([]);
	optedOutOfStorage(calls);
});

test("fails closed when session lookup fails", async () => {
	const { auth } = createTestAuth();
	const { app, calls } = createTestApp(auth, {
		getSession: () => Promise.reject(new Error("database password leaked")),
	});
	const response = await app.request(`/api/projects/${projectId}`);

	expect(response.status).toBe(500);
	expect(await response.json()).toEqual({ error: "Internal Server Error" });
	expect(calls.getProjectForUser).toEqual([]);
	optedOutOfStorage(calls);
});

test("fails closed without exposing project lookup errors", async () => {
	const { auth } = createTestAuth();
	const { app, calls } = createTestApp(auth, {
		getProjectForUser: () =>
			Promise.reject(new Error("database access token leaked")),
	});
	const response = await app.request(`/api/projects/${projectId}`, {
		headers: new Headers({
			cookie:
				(await createUserSession(auth, "user-a")).headers.get("cookie") ?? "",
		}),
	});

	expect(response.status).toBe(500);
	const payload: unknown = await response.json();
	expect(payload).toEqual({ error: "Internal Server Error" });
	expect(JSON.stringify(payload)).not.toMatch(secretMaterialPattern);
	expect(calls.getProjectForUser).toEqual([{ projectId, userId: "user-a" }]);
	optedOutOfStorage(calls);
});

test("uploads project 2D Visual Assets through the server without returning a storage token", async () => {
	const { auth } = createTestAuth();
	const user = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth);
	const response = await app.request(
		`/api/projects/${projectId}/2d-visual-assets`,
		{
			method: "POST",
			headers: new Headers({
				cookie: user.headers.get("cookie") ?? "",
				"content-type": "image/png",
			}),
			body: "sprite-bytes",
		}
	);

	expect(response.status).toBe(201);
	const payload: unknown = await response.json();
	expect(payload).toEqual({ twoDVisualAssetId });
	expect(JSON.stringify(payload)).not.toMatch(secretMaterialPattern);
	expect(calls.putObject).toEqual([
		{
			contentType: "image/png",
			key: `projects/${projectId}/2d-visual-assets/${twoDVisualAssetId}`,
			body: "sprite-bytes",
		},
	]);
	expect(calls.queuedKeys).toEqual([
		`projects/${projectId}/2d-visual-assets/${twoDVisualAssetId}`,
	]);
});

test("rejects an invalid serialized asset ID before storage side effects", async () => {
	const { auth } = createTestAuth();
	const user = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth, {
		createId: () => "00000000-0000-0000-0000-000000000003",
	});
	const response = await app.request(
		`/api/projects/${projectId}/2d-visual-assets`,
		{
			method: "POST",
			headers: new Headers({
				cookie: user.headers.get("cookie") ?? "",
				"content-type": "image/png",
			}),
			body: "sprite-bytes",
		}
	);

	expect(response.status).toBe(500);
	expect(await response.json()).toEqual({ error: "Internal Server Error" });
	expect(calls.cloudflareConfig).toBe(0);
	expect(calls.putObject).toEqual([]);
	expect(calls.queuedKeys).toEqual([]);
	expect(calls.deletedKeys).toEqual([]);
});

test("serves previews only through the owner-checked project route", async () => {
	const { auth } = createTestAuth();
	const user = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth);
	const response = await app.request(
		`/api/projects/${projectId}/2d-visual-assets/${twoDVisualAssetId}/preview`,
		{
			headers: new Headers({ cookie: user.headers.get("cookie") ?? "" }),
		}
	);

	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe("image/png");
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	expect(await response.text()).toBe("sprite-bytes");
	expect(calls.getObject).toEqual([
		`projects/${projectId}/2d-visual-assets/${twoDVisualAssetId}`,
	]);
});

test("preserves owner-scoped routes for opaque project IDs", async () => {
	const { auth } = createTestAuth();
	const user = await createUserSession(auth, "user-a");
	const opaqueProjectId = "ash-knight-v1";
	const { app, calls } = createTestApp(auth, {
		getProjectForUser: (_userId, id) =>
			Promise.resolve(
				id === opaqueProjectId
					? {
							id,
							name: "Ash Knight",
							ownerUserId: "user-a",
							previewKey: "users/user-a/preview.png",
						}
					: null
			),
	});
	const headers = new Headers({ cookie: user.headers.get("cookie") ?? "" });

	const projectResponse = await app.request(
		`/api/projects/${opaqueProjectId}`,
		{ headers }
	);
	expect(projectResponse.status).toBe(200);
	expect(await projectResponse.json()).toEqual({
		id: opaqueProjectId,
		name: "Ash Knight",
		previewUrl: `/api/projects/${opaqueProjectId}/preview`,
	});

	const previewResponse = await app.request(
		`/api/projects/${opaqueProjectId}/preview`,
		{ headers }
	);
	expect(previewResponse.status).toBe(200);
	expect(previewResponse.headers.get("content-type")).toBe("image/png");
	expect(previewResponse.headers.get("cache-control")).toBe(
		"private, no-store"
	);
	expect(await previewResponse.text()).toBe("sprite-bytes");
	expect(calls.getObject).toEqual(["users/user-a/preview.png"]);

	const uploadResponse = await app.request(
		`/api/projects/${opaqueProjectId}/2d-visual-assets`,
		{
			method: "POST",
			headers: new Headers({
				cookie: user.headers.get("cookie") ?? "",
				"content-type": "image/png",
			}),
			body: "sprite-bytes",
		}
	);
	expect(uploadResponse.status).toBe(201);
	expect(calls.putObject).toEqual([
		{
			contentType: "image/png",
			key: `projects/${opaqueProjectId}/2d-visual-assets/${twoDVisualAssetId}`,
			body: "sprite-bytes",
		},
	]);
});

test("does not read a legacy preview object outside the owner scope", async () => {
	const { auth } = createTestAuth();
	const user = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth, {
		getProjectForUser: (_userId, id) =>
			Promise.resolve(
				id === projectId
					? {
							id,
							name: "Ash Knight",
							ownerUserId: "user-a",
							previewKey: "users/user-b/preview.png",
						}
					: null
			),
	});
	const headers = new Headers({ cookie: user.headers.get("cookie") ?? "" });

	const projectResponse = await app.request(`/api/projects/${projectId}`, {
		headers,
	});
	expect(await projectResponse.json()).toEqual({
		id: projectId,
		name: "Ash Knight",
		previewUrl: null,
	});

	const previewResponse = await app.request(
		`/api/projects/${projectId}/preview`,
		{ headers }
	);
	expect(previewResponse.status).toBe(404);
	expect(previewResponse.headers.get("cache-control")).toBe(
		"private, no-store"
	);
	expect(calls.getObject).toEqual([]);
});

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"reads persisted projects only for their authenticated owner",
	async () => {
		if (!databaseUrl) {
			throw new Error("DATABASE_URL must point to an isolated test branch");
		}
		const database = createDb({ DATABASE_URL: databaseUrl });
		const ownerUserId = crypto.randomUUID();
		const otherUserId = crypto.randomUUID();
		const persistedProjectId = crypto.randomUUID();
		const { auth } = createTestAuth();
		const ownerSession = await createUserSession(auth, ownerUserId);
		const otherUserSession = await createUserSession(auth, otherUserId);
		const { app, calls } = createTestApp(auth, {
			getProjectForUser: (userId, id) =>
				getProjectForUser(database, userId, id),
		});

		try {
			await database.insert(userTable).values([
				{
					id: ownerUserId,
					name: "Test Owner",
					email: `${ownerUserId}@example.test`,
				},
				{
					id: otherUserId,
					name: "Other User",
					email: `${otherUserId}@example.test`,
				},
			]);
			await database.insert(projectTable).values({
				id: persistedProjectId,
				ownerUserId,
				name: "Persisted Project",
				previewKey: null,
			});

			const ownerResponse = await app.request(
				`/api/projects/${persistedProjectId}`,
				{
					headers: new Headers({
						cookie: ownerSession.headers.get("cookie") ?? "",
					}),
				}
			);
			expect(ownerResponse.status).toBe(200);
			expect(await ownerResponse.json()).toEqual({
				id: persistedProjectId,
				name: "Persisted Project",
				previewUrl: null,
			});

			const otherResponse = await app.request(
				`/api/projects/${persistedProjectId}`,
				{
					headers: new Headers({
						cookie: otherUserSession.headers.get("cookie") ?? "",
					}),
				}
			);
			expect(otherResponse.status).toBe(404);
			expect(await otherResponse.json()).toEqual({ error: "Not found" });
			expect(calls.getProjectForUser).toEqual([
				{ projectId: persistedProjectId, userId: ownerUserId },
				{ projectId: persistedProjectId, userId: otherUserId },
			]);
		} finally {
			await database
				.delete(projectTable)
				.where(eq(projectTable.id, persistedProjectId));
			await database
				.delete(userTable)
				.where(inArray(userTable.id, [ownerUserId, otherUserId]));
		}
	}
);

test("does not keep an uploaded object when queue publication fails", async () => {
	const { auth } = createTestAuth();
	const user = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth, { failQueue: true });
	const response = await app.request(
		`/api/projects/${projectId}/2d-visual-assets`,
		{
			method: "POST",
			headers: new Headers({
				cookie: user.headers.get("cookie") ?? "",
				"content-type": "image/webp",
			}),
			body: "sprite-bytes",
		}
	);

	expect(response.status).toBe(503);
	const payload: unknown = await response.json();
	expect(payload).toEqual({ error: "2D Visual Asset upload failed" });
	expect(JSON.stringify(payload)).not.toMatch(secretMaterialPattern);
	expect(calls.queuedKeys).toEqual([
		`projects/${projectId}/2d-visual-assets/${twoDVisualAssetId}`,
	]);
	expect(calls.putObject).toHaveLength(1);
	expect(calls.deletedKeys).toEqual([
		`projects/${projectId}/2d-visual-assets/${twoDVisualAssetId}`,
	]);
});

test("rejects unsupported upload types before storage configuration is read", async () => {
	const { auth } = createTestAuth();
	const user = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth);
	const response = await app.request(
		`/api/projects/${projectId}/2d-visual-assets`,
		{
			method: "POST",
			headers: new Headers({
				cookie: user.headers.get("cookie") ?? "",
				"content-type": "text/plain",
			}),
			body: "not an image",
		}
	);

	expect(response.status).toBe(415);
	expect(await response.json()).toEqual({
		error: "Unsupported 2D Visual Asset type",
	});
	expect(calls.cloudflareConfig).toBe(0);
	expect(calls.putObject).toEqual([]);
	expect(calls.queuedKeys).toEqual([]);
});

function optedOutOfStorage(calls: ReturnType<typeof createTestApp>["calls"]) {
	expect(calls.cloudflareConfig).toBe(0);
	expect(calls.getObject).toEqual([]);
	expect(calls.putObject).toEqual([]);
	expect(calls.deletedKeys).toEqual([]);
	expect(calls.queuedKeys).toEqual([]);
}
