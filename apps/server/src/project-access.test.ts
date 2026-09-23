import { expect, test } from "bun:test";
import { createDb } from "@sprite-anvil/db";
import { user as userTable } from "@sprite-anvil/db/schema/auth";
import { project as projectTable } from "@sprite-anvil/db/schema/project";
import { betterAuth } from "better-auth";
import { type MemoryDB, memoryAdapter } from "better-auth/adapters/memory";
import { testUtils } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { findOwnedProject } from "./project-repository";
import {
	mountProjectRoutes,
	type ProjectRecord,
	type ProjectRouteDependencies,
} from "./project-routes";

const projectId = "project-ash-knight";
const previewKey = "users/user-a/preview.png";

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
	const savedUser = await context.test.saveUser(
		context.test.createUser({
			email: `${userId}@example.test`,
			id: userId,
		})
	);
	const login = await context.test.login({ userId: savedUser.id });
	return { headers: login.headers, session: login.session };
}

function createPreview() {
	return {
		body: new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([137, 80, 78, 71]));
				controller.close();
			},
		}),
		contentType: "image/png" as const,
	};
}

function createTestApp(
	auth: ReturnType<typeof createTestAuth>["auth"],
	projects: ProjectRecord[] = [
		{
			id: projectId,
			ownerUserId: "user-a",
			name: "Ash Knight",
			previewKey,
		},
	],
	getSession?: ProjectRouteDependencies["getSession"],
	findOwnedProjectOverride?: ProjectRouteDependencies["findOwnedProject"]
) {
	const app = new Hono();
	const persistedProjects = new Map(
		projects.map((projectRecord) => [projectRecord.id, projectRecord])
	);
	const calls = {
		projectReads: [] as { projectId: string; ownerUserId: string }[],
		previewReads: [] as string[],
	};

	mountProjectRoutes(app, {
		getSession: getSession ?? ((headers) => auth.api.getSession({ headers })),
		findOwnedProject: (id, ownerUserId) => {
			calls.projectReads.push({ projectId: id, ownerUserId });
			if (findOwnedProjectOverride) {
				return findOwnedProjectOverride(id, ownerUserId);
			}
			const record = persistedProjects.get(id);
			return Promise.resolve(
				record?.ownerUserId === ownerUserId ? record : null
			);
		},
		getPreview: (key) => {
			calls.previewReads.push(key);
			return Promise.resolve(
				key.endsWith("/preview.png") ? createPreview() : null
			);
		},
	});

	app.onError((_error, c) => c.text("Internal Server Error", 500));
	return { app, calls, persistedProjects };
}

function getHeaders(cookie?: string) {
	const headers = new Headers();
	if (cookie) {
		headers.set("cookie", cookie);
	}
	return headers;
}

test("reads the current owner-scoped project record and preview", async () => {
	const { auth } = createTestAuth();
	const userSession = await createUserSession(auth, "user-a");
	const { app, calls, persistedProjects } = createTestApp(auth);
	const headers = getHeaders(userSession.headers.get("cookie") ?? undefined);

	const projectResponse = await app.request(`/api/projects/${projectId}`, {
		headers,
	});
	expect(projectResponse.status).toBe(200);
	expect(projectResponse.headers.get("cache-control")).toBe(
		"private, no-store"
	);
	expect(await projectResponse.json()).toEqual({
		id: projectId,
		name: "Ash Knight",
		previewUrl: `/api/projects/${projectId}/preview`,
	});

	persistedProjects.set(projectId, {
		id: projectId,
		ownerUserId: "user-a",
		name: "Ash Knight Updated",
		previewKey,
	});
	const updatedProjectResponse = await app.request(
		`/api/projects/${projectId}`,
		{ headers }
	);
	expect(await updatedProjectResponse.json()).toMatchObject({
		name: "Ash Knight Updated",
	});

	const previewResponse = await app.request(
		`/api/projects/${projectId}/preview`,
		{ headers }
	);
	expect(previewResponse.status).toBe(200);
	expect(previewResponse.headers.get("content-type")).toBe("image/png");
	expect(previewResponse.headers.get("cache-control")).toBe(
		"private, no-store"
	);
	expect(previewResponse.headers.get("x-content-type-options")).toBe("nosniff");
	expect([...new Uint8Array(await previewResponse.arrayBuffer())]).toEqual([
		137, 80, 78, 71,
	]);

	expect(calls.projectReads).toEqual([
		{ projectId, ownerUserId: "user-a" },
		{ projectId, ownerUserId: "user-a" },
		{ projectId, ownerUserId: "user-a" },
	]);
	expect(calls.previewReads).toEqual([previewKey]);
});

const databaseUrl = process.env.DATABASE_URL;

test.skipIf(!databaseUrl)(
	"reads the persisted project record through the Hono boundary",
	async () => {
		if (!databaseUrl) {
			throw new Error("DATABASE_URL must point to an isolated test branch");
		}
		const database = createDb({ DATABASE_URL: databaseUrl });
		const ownerUserId = crypto.randomUUID();
		const otherUserId = crypto.randomUUID();
		const persistedProjectId = `project-${crypto.randomUUID()}`;
		const { auth } = createTestAuth();
		const ownerSession = await createUserSession(auth, ownerUserId);
		const otherUserSession = await createUserSession(auth, otherUserId);
		const persistedPreviewKey = `users/${ownerUserId}/preview.png`;
		const { app, calls } = createTestApp(
			auth,
			[],
			undefined,
			(id, lookupOwnerId) => findOwnedProject(database, id, lookupOwnerId)
		);

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
				previewKey: persistedPreviewKey,
			});

			const response = await app.request(
				`/api/projects/${persistedProjectId}`,
				{
					headers: getHeaders(ownerSession.headers.get("cookie") ?? undefined),
				}
			);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({
				id: persistedProjectId,
				name: "Persisted Project",
				previewUrl: `/api/projects/${persistedProjectId}/preview`,
			});
			expect(calls.projectReads).toEqual([
				{ projectId: persistedProjectId, ownerUserId },
			]);

			const previewResponse = await app.request(
				`/api/projects/${persistedProjectId}/preview`,
				{
					headers: getHeaders(ownerSession.headers.get("cookie") ?? undefined),
				}
			);
			expect(previewResponse.status).toBe(200);
			expect([...new Uint8Array(await previewResponse.arrayBuffer())]).toEqual([
				137, 80, 78, 71,
			]);

			const otherUserResponse = await app.request(
				`/api/projects/${persistedProjectId}`,
				{
					headers: getHeaders(
						otherUserSession.headers.get("cookie") ?? undefined
					),
				}
			);
			expect(otherUserResponse.status).toBe(404);
			expect(await otherUserResponse.json()).toEqual({
				error: "Project not found",
			});
			expect(calls.projectReads).toEqual([
				{ projectId: persistedProjectId, ownerUserId },
				{ projectId: persistedProjectId, ownerUserId },
				{ projectId: persistedProjectId, ownerUserId: otherUserId },
			]);
			expect(calls.previewReads).toEqual([persistedPreviewKey]);
		} finally {
			await database
				.delete(projectTable)
				.where(eq(projectTable.id, persistedProjectId));
			await database.delete(userTable).where(eq(userTable.id, ownerUserId));
			await database.delete(userTable).where(eq(userTable.id, otherUserId));
		}
	}
);

test("denies missing, malformed, and expired sessions before content access", async () => {
	const { auth, database } = createTestAuth();
	const expiredSession = await createUserSession(auth, "expired-user");
	const record = database.session?.find(
		(session) => session.id === expiredSession.session.id
	);
	if (!record) {
		throw new Error("Expected the test session to be stored in memory");
	}
	record.expiresAt = new Date(Date.now() - 1000);

	const { app, calls } = createTestApp(auth);
	const sessionHeaders = [
		getHeaders(),
		getHeaders("better-auth.session_token=malformed"),
		getHeaders(expiredSession.headers.get("cookie") ?? undefined),
	];

	const paths = [
		`/api/projects/${projectId}`,
		`/api/projects/${projectId}/preview`,
	];
	const responses = await Promise.all(
		sessionHeaders.flatMap((headers) =>
			paths.map((path) => app.request(path, { headers }))
		)
	);
	await Promise.all(
		responses.map(async (response) => {
			expect(response.status).toBe(401);
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(await response.json()).toEqual({ error: "Unauthorized" });
		})
	);

	expect(calls.projectReads).toEqual([]);
	expect(calls.previewReads).toEqual([]);
});

test("does not reveal a project or preview to another authenticated user", async () => {
	const { auth } = createTestAuth();
	const otherUserSession = await createUserSession(auth, "user-b");
	const { app, calls } = createTestApp(auth);
	const headers = getHeaders(
		otherUserSession.headers.get("cookie") ?? undefined
	);

	const responses = await Promise.all(
		[`/api/projects/${projectId}`, `/api/projects/${projectId}/preview`].map(
			(path) => app.request(path, { headers })
		)
	);
	await Promise.all(
		responses.map(async (response) => {
			expect(response.status).toBe(404);
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(await response.json()).toEqual({ error: "Project not found" });
		})
	);

	expect(calls.projectReads).toEqual([
		{ projectId, ownerUserId: "user-b" },
		{ projectId, ownerUserId: "user-b" },
	]);
	expect(calls.previewReads).toEqual([]);
});

test("fails closed when session lookup fails", async () => {
	const { auth } = createTestAuth();
	const { app, calls } = createTestApp(auth, undefined, () =>
		Promise.reject(new Error("Session lookup failed"))
	);

	const responses = await Promise.all(
		[`/api/projects/${projectId}`, `/api/projects/${projectId}/preview`].map(
			(path) =>
				app.request(path, {
					headers: getHeaders("better-auth.session_token=unavailable"),
				})
		)
	);
	for (const response of responses) {
		expect(response.status).toBe(500);
	}

	expect(calls.projectReads).toEqual([]);
	expect(calls.previewReads).toEqual([]);
});

test("does not read a preview whose object key is outside the owner scope", async () => {
	const { auth } = createTestAuth();
	const userSession = await createUserSession(auth, "user-a");
	const { app, calls } = createTestApp(auth, [
		{
			id: projectId,
			ownerUserId: "user-a",
			name: "Ash Knight",
			previewKey: "users/user-b/preview.png",
		},
	]);
	const headers = getHeaders(userSession.headers.get("cookie") ?? undefined);

	const projectResponse = await app.request(`/api/projects/${projectId}`, {
		headers,
	});
	expect(await projectResponse.json()).toMatchObject({ previewUrl: null });

	const previewResponse = await app.request(
		`/api/projects/${projectId}/preview`,
		{ headers }
	);
	expect(previewResponse.status).toBe(404);
	expect(calls.previewReads).toEqual([]);
});

test("accepts opaque non-UUID project IDs", async () => {
	const { auth } = createTestAuth();
	const userSession = await createUserSession(auth, "user-a");
	const opaqueProjectId = "ash-knight-v1";
	const { app, calls } = createTestApp(auth, [
		{
			id: opaqueProjectId,
			ownerUserId: "user-a",
			name: "Ash Knight",
			previewKey,
		},
	]);

	const response = await app.request(`/api/projects/${opaqueProjectId}`, {
		headers: getHeaders(userSession.headers.get("cookie") ?? undefined),
	});

	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({
		id: opaqueProjectId,
		name: "Ash Knight",
		previewUrl: `/api/projects/${opaqueProjectId}/preview`,
	});
	expect(calls.projectReads).toEqual([
		{ projectId: opaqueProjectId, ownerUserId: "user-a" },
	]);
});
