import { expect, test } from "bun:test";
import { betterAuth } from "better-auth";
import { type MemoryDB, memoryAdapter } from "better-auth/adapters/memory";
import { testUtils } from "better-auth/plugins";
import { Hono } from "hono";

import { type AssetRouteDependencies, mountAssetRoutes } from "./asset-routes";
import type { CloudflareConfig } from "./cloudflare";

const cloudflareConfig: CloudflareConfig = {
	CLOUDFLARE_ACCOUNT_ID: "test-account",
	CLOUDFLARE_QUEUE_ID: "test-queue",
	CLOUDFLARE_QUEUES_TOKEN: "test-token",
	R2_ACCESS_KEY_ID: "test-access-key",
	R2_SECRET_ACCESS_KEY: "test-secret-key",
	R2_BUCKET: "test-assets",
};

function jsonHeaders(cookie?: string) {
	const headers = new Headers({ "content-type": "application/json" });
	if (cookie) {
		headers.set("cookie", cookie);
	}
	return headers;
}

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
	getSession?: AssetRouteDependencies["getSession"]
) {
	const app = new Hono();
	const calls = {
		config: 0,
		enqueuedKeys: [] as string[],
		existingKeys: [] as string[],
		signedUploads: [] as {
			contentType: "image/png" | "image/webp";
			userId: string;
		}[],
	};

	mountAssetRoutes(app, {
		getSession: getSession ?? ((headers) => auth.api.getSession({ headers })),
		cloudflareConfig: () => {
			calls.config += 1;
			return cloudflareConfig;
		},
		createStorage: () => ({
			signUpload: (userId, contentType) => {
				calls.signedUploads.push({ userId, contentType });
				return Promise.resolve({
					key: `users/${userId}/asset.png`,
					url: "https://assets.example.test/upload",
				});
			},
			exists: (key) => {
				calls.existingKeys.push(key);
				return Promise.resolve();
			},
		}),
		createQueue: () => ({
			send: (key) => {
				calls.enqueuedKeys.push(key);
				return Promise.resolve();
			},
		}),
	});

	return { app, calls };
}

test("denies missing, malformed, and expired sessions before upload side effects", async () => {
	const { auth, database } = createTestAuth();
	const userSession = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth);

	const sessionRecord = database.session?.find(
		(record) => record.id === userSession.session.id
	);
	if (!sessionRecord) {
		throw new Error("Expected the test session to be stored in memory");
	}
	sessionRecord.expiresAt = new Date(Date.now() - 1000);

	const cookieHeaders = [
		jsonHeaders(),
		jsonHeaders("better-auth.session_token=malformed"),
		jsonHeaders(userSession.headers.get("cookie") ?? undefined),
	];

	await Promise.all(
		cookieHeaders.map(async (headers) => {
			const response = await app.request("/api/assets/upload-url", {
				method: "POST",
				headers,
				body: JSON.stringify({ name: "sprite.png", contentType: "image/png" }),
			});

			expect(response.status).toBe(401);
			expect(await response.json()).toEqual({ error: "Unauthorized" });
		})
	);

	expect(calls.config).toBe(0);
	expect(calls.signedUploads).toEqual([]);
});

test("fails closed when session lookup fails", async () => {
	const { auth } = createTestAuth();
	const { app, calls } = createTestApp(auth, () =>
		Promise.reject(new Error("Session lookup failed"))
	);
	app.onError((_error, c) => c.text("Internal Server Error", 500));

	const response = await app.request("/api/assets/upload-url", {
		method: "POST",
		headers: jsonHeaders(),
		body: JSON.stringify({ name: "sprite.png", contentType: "image/png" }),
	});

	expect(response.status).toBe(500);
	expect(calls.config).toBe(0);
	expect(calls.signedUploads).toEqual([]);
});

test("rejects malformed JSON before upload side effects", async () => {
	const { auth } = createTestAuth();
	const userSession = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth);

	const uploadResponse = await app.request("/api/assets/upload-url", {
		method: "POST",
		headers: jsonHeaders(userSession.headers.get("cookie") ?? undefined),
		body: "{",
	});
	const completionResponse = await app.request("/api/assets/complete", {
		method: "POST",
		headers: jsonHeaders(userSession.headers.get("cookie") ?? undefined),
		body: "{",
	});

	expect(uploadResponse.status).toBe(400);
	expect(await uploadResponse.json()).toEqual({
		error: "Invalid upload request",
	});
	expect(completionResponse.status).toBe(400);
	expect(await completionResponse.json()).toEqual({
		error: "Invalid asset key",
	});
	expect(calls.config).toBe(0);
	expect(calls.signedUploads).toEqual([]);
	expect(calls.existingKeys).toEqual([]);
	expect(calls.enqueuedKeys).toEqual([]);
});

test("rejects asset completion when the key belongs to another user", async () => {
	const { auth } = createTestAuth();
	const userSession = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth);

	const response = await app.request("/api/assets/complete", {
		method: "POST",
		headers: jsonHeaders(userSession.headers.get("cookie") ?? undefined),
		body: JSON.stringify({ key: "users/user-b/asset.png" }),
	});

	expect(response.status).toBe(400);
	expect(await response.json()).toEqual({ error: "Invalid asset key" });
	expect(calls.config).toBe(0);
	expect(calls.existingKeys).toEqual([]);
	expect(calls.enqueuedKeys).toEqual([]);
});

test("accepts completion for the authenticated user's asset", async () => {
	const { auth } = createTestAuth();
	const userSession = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth);

	const response = await app.request("/api/assets/complete", {
		method: "POST",
		headers: jsonHeaders(userSession.headers.get("cookie") ?? undefined),
		body: JSON.stringify({ key: "users/user-a/asset.png" }),
	});

	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ queued: true });
	expect(calls.config).toBe(1);
	expect(calls.existingKeys).toEqual(["users/user-a/asset.png"]);
	expect(calls.enqueuedKeys).toEqual(["users/user-a/asset.png"]);
});

test("scopes signed upload keys to the authenticated user", async () => {
	const { auth } = createTestAuth();
	const userSession = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth);

	const response = await app.request("/api/assets/upload-url", {
		method: "POST",
		headers: jsonHeaders(userSession.headers.get("cookie") ?? undefined),
		body: JSON.stringify({ name: "sprite.png", contentType: "image/png" }),
	});

	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({
		key: "users/user-a/asset.png",
		url: "https://assets.example.test/upload",
	});
	expect(calls.signedUploads).toEqual([
		{ userId: "user-a", contentType: "image/png" },
	]);
});
