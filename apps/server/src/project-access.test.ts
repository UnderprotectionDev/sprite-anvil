import { expect, test } from "bun:test";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import type {
	ContextAgentScope,
	ProjectAccessStore,
} from "@sprite-anvil/api/project-access-store";
import type { AppRouterClient } from "@sprite-anvil/api/routers/index";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Session } from "@sprite-anvil/auth";
import { createDb } from "@sprite-anvil/db";
import { user as userTable } from "@sprite-anvil/db/schema/auth";
import { project as projectTable } from "@sprite-anvil/db/schema/project";
import { betterAuth } from "better-auth";
import { type MemoryDB, memoryAdapter } from "better-auth/adapters/memory";
import { testUtils } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { createProjectAccessStore } from "./features/projects/server/project-access-store";

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
	return login.headers.get("cookie") ?? "";
}

function createMemoryProjectAccessStore(
	projectIdForCreatedProject: string = crypto.randomUUID()
): ProjectAccessStore {
	const projects = new Map<
		string,
		{ createdAt: string; id: string; name: string; ownerId: string }
	>();
	const permissions = new Map<
		string,
		{
			createdAt: string;
			id: string;
			principal: "context_agent";
			projectId: string;
			purpose: string;
			revokedAt: string | null;
			scopes: ContextAgentScope[];
		}
	>();

	return {
		createProject(ownerId, name) {
			const project = {
				createdAt: new Date().toISOString(),
				id: projectIdForCreatedProject,
				name,
				ownerId,
			};
			projects.set(project.id, project);
			return Promise.resolve(project);
		},
		getProject(ownerId, projectId) {
			const project = projects.get(projectId);
			return Promise.resolve(project?.ownerId === ownerId ? project : null);
		},
		listProjects(ownerId) {
			return Promise.resolve(
				[...projects.values()].filter((project) => project.ownerId === ownerId)
			);
		},
		listContextAgentPermissions(ownerId, projectId) {
			const project = projects.get(projectId);
			if (project?.ownerId !== ownerId) {
				return Promise.resolve(null);
			}
			return Promise.resolve(
				[...permissions.values()].filter(
					(permission) => permission.projectId === projectId
				)
			);
		},
		grantContextAgentPermission(ownerId, projectId, input) {
			const project = projects.get(projectId);
			if (project?.ownerId !== ownerId) {
				return Promise.resolve(null);
			}
			const permission = {
				createdAt: new Date().toISOString(),
				id: crypto.randomUUID(),
				principal: "context_agent" as const,
				projectId,
				purpose: input.purpose,
				revokedAt: null,
				scopes: input.scopes,
			};
			permissions.set(permission.id, permission);
			return Promise.resolve(permission);
		},
		revokeContextAgentPermission(ownerId, projectId, permissionId) {
			const project = projects.get(projectId);
			const permission = permissions.get(permissionId);
			if (project?.ownerId !== ownerId || permission?.projectId !== projectId) {
				return Promise.resolve(false);
			}
			permissions.set(permissionId, {
				...permission,
				revokedAt: new Date().toISOString(),
			});
			return Promise.resolve(true);
		},
		hasContextAgentPermission(projectId, purpose, scope) {
			return Promise.resolve(
				[...permissions.values()].some(
					(permission) =>
						permission.projectId === projectId &&
						permission.purpose === purpose &&
						permission.revokedAt === null &&
						permission.scopes.includes(scope)
				)
			);
		},
	};
}

function createRpcClient(
	auth: ReturnType<typeof createTestAuth>["auth"],
	store: ProjectAccessStore,
	cookie?: string,
	getSession: (headers: Headers) => Promise<Session | null> = (headers) =>
		auth.api.getSession({ headers })
) {
	const rpcHandler = new RPCHandler(appRouter);
	const app = new Hono();
	app.onError((_error, c) => c.text("Internal Server Error", 500));
	app.use("/*", async (c, next) => {
		const result = await rpcHandler.handle(c.req.raw, {
			context: {
				projectAccess: store,
				session: await getSession(c.req.raw.headers),
			},
			prefix: "/rpc",
		});
		if (result.matched) {
			return c.newResponse(result.response.body, result.response);
		}
		await next();
	});
	const client = createORPCClient<AppRouterClient>(
		new RPCLink({
			url: "http://localhost/rpc",
			fetch: async (input, init) => {
				const request = new Request(input, init);
				if (cookie) {
					request.headers.set("cookie", cookie);
				}
				return await app.fetch(request);
			},
		})
	);
	return client;
}

test("a project owner can grant, read back, and revoke Context Agent access", async () => {
	const { auth } = createTestAuth();
	const cookie = await createUserSession(auth, "project-owner");
	const client = createRpcClient(
		auth,
		createMemoryProjectAccessStore(),
		cookie
	);
	const purpose = "Prepare a project context proposal";
	const scopes: ContextAgentScope[] = ["project_context:read"];

	const project = await client.projects.create({ name: "Forest Quest" });
	const permission = await client.projects.access.grantContextAgent({
		projectId: project.id,
		purpose,
		scopes,
	});
	const readBack = await client.projects.access.list({ projectId: project.id });
	const allowedBeforeRevocation =
		await client.projects.access.checkContextAgent({
			projectId: project.id,
			purpose,
			scope: "project_context:read",
		});
	await expect(
		client.projects.access.checkContextAgent({
			projectId: project.id,
			purpose,
			scope: "context_proposals:write",
		})
	).rejects.toMatchObject({ code: "FORBIDDEN" });
	await expect(
		client.projects.access.checkContextAgent({
			projectId: project.id,
			purpose: "Read project references",
			scope: "project_context:read",
		})
	).rejects.toMatchObject({ code: "FORBIDDEN" });

	await client.projects.access.revoke({
		projectId: project.id,
		permissionId: permission.id,
	});
	const readBackAfterRevocation = await client.projects.access.list({
		projectId: project.id,
	});
	await expect(
		client.projects.access.checkContextAgent({
			projectId: project.id,
			purpose,
			scope: "project_context:read",
		})
	).rejects.toMatchObject({ code: "FORBIDDEN" });

	expect(project.name).toBe("Forest Quest");
	expect(readBack[0]).toMatchObject({
		id: permission.id,
		purpose,
		scopes,
		revokedAt: null,
	});
	expect(allowedBeforeRevocation).toBe(true);
	expect(readBackAfterRevocation[0]?.revokedAt).toEqual(expect.any(String));
});

test("existing opaque Project IDs can be read and authorized", async () => {
	const { auth } = createTestAuth();
	const cookie = await createUserSession(auth, "opaque-project-owner");
	const client = createRpcClient(
		auth,
		createMemoryProjectAccessStore("ash-knight-v1"),
		cookie
	);
	const project = await client.projects.create({ name: "Ash Knight" });
	expect(await client.projects.get({ projectId: project.id })).toMatchObject({
		id: "ash-knight-v1",
		name: "Ash Knight",
	});
	const permission = await client.projects.access.grantContextAgent({
		projectId: project.id,
		purpose: "Prepare a project context proposal",
		scopes: ["project_context:read"],
	});

	expect(project.id).toBe("ash-knight-v1");
	expect(
		await client.projects.access.checkContextAgent({
			projectId: project.id,
			purpose: permission.purpose,
			scope: "project_context:read",
		})
	).toBe(true);
	await expect(
		client.projects.access.checkConnection({
			projectId: project.id,
			purpose: "Generate a candidate asset",
			scope: "candidate_versions:write",
		})
	).rejects.toMatchObject({ code: "FORBIDDEN" });
});

const databaseUrl = process.env.DATABASE_URL;

test.skipIf(!databaseUrl)(
	"Context Agent permission grants persist and revocation stops new access",
	async () => {
		if (!databaseUrl) {
			throw new Error("DATABASE_URL must point to an isolated test branch");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const store = createProjectAccessStore(db);
		const ownerUserId = crypto.randomUUID();
		await db.insert(userTable).values({
			id: ownerUserId,
			name: "Permission Test Owner",
			email: `${ownerUserId}@example.test`,
		});
		let projectId: string | null = null;

		try {
			const project = await store.createProject(
				ownerUserId,
				"Permission Persistence Check"
			);
			projectId = project.id;
			const granted = await store.grantContextAgentPermission(
				ownerUserId,
				project.id,
				{
					purpose: "Prepare a project context proposal",
					scopes: ["project_context:read"],
				}
			);
			if (!granted) {
				throw new Error("Expected the owner to grant project access");
			}

			const readBack = await store.listContextAgentPermissions(
				ownerUserId,
				project.id
			);
			expect(readBack).toMatchObject([
				{
					id: granted.id,
					purpose: granted.purpose,
					scopes: granted.scopes,
					revokedAt: null,
				},
			]);
			expect(
				await store.hasContextAgentPermission(
					project.id,
					granted.purpose,
					"project_context:read"
				)
			).toBe(true);

			expect(
				await store.revokeContextAgentPermission(
					ownerUserId,
					project.id,
					granted.id
				)
			).toBe(true);
			const readBackAfterRevocation = await store.listContextAgentPermissions(
				ownerUserId,
				project.id
			);
			expect(readBackAfterRevocation?.[0]).toMatchObject({
				id: granted.id,
				revokedAt: expect.any(String),
			});
			expect(
				await store.hasContextAgentPermission(
					project.id,
					granted.purpose,
					"project_context:read"
				)
			).toBe(false);
		} finally {
			if (projectId) {
				await db.delete(projectTable).where(eq(projectTable.id, projectId));
			}
			await db.delete(userTable).where(eq(userTable.id, ownerUserId));
		}
	}
);

test("project access controls require an authenticated owner", async () => {
	const { auth } = createTestAuth();
	const anonymousClient = createRpcClient(
		auth,
		createMemoryProjectAccessStore()
	);

	await expect(
		anonymousClient.projects.create({ name: "Private Project" })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

test("project access controls reject expired sessions", async () => {
	const { auth, database } = createTestAuth();
	const cookie = await createUserSession(auth, "expired-project-owner");
	const sessionRecord = database.session?.[0];
	if (!sessionRecord) {
		throw new Error("Expected the test session to be stored in memory");
	}
	sessionRecord.expiresAt = new Date(Date.now() - 1000);
	const client = createRpcClient(
		auth,
		createMemoryProjectAccessStore(),
		cookie
	);

	await expect(client.projects.list()).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

test("project access controls fail closed when session lookup fails", async () => {
	const { auth } = createTestAuth();
	const client = createRpcClient(
		auth,
		createMemoryProjectAccessStore(),
		undefined,
		() => Promise.reject(new Error("Session lookup failed"))
	);

	await expect(client.projects.list()).rejects.toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
	});
});

test("project permissions are hidden from another user's session", async () => {
	const { auth } = createTestAuth();
	const store = createMemoryProjectAccessStore();
	const ownerCookie = await createUserSession(auth, "project-owner");
	const otherCookie = await createUserSession(auth, "another-user");
	const owner = createRpcClient(auth, store, ownerCookie);
	const otherUser = createRpcClient(auth, store, otherCookie);
	const project = await owner.projects.create({ name: "Private Project" });

	expect(await otherUser.projects.list()).toEqual([]);
	await expect(
		otherUser.projects.get({ projectId: project.id })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		otherUser.projects.access.list({ projectId: project.id })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("project permission grants reject scopes outside the Context Agent boundary", async () => {
	const { auth } = createTestAuth();
	const cookie = await createUserSession(auth, "scope-owner");
	const client = createRpcClient(
		auth,
		createMemoryProjectAccessStore(),
		cookie
	);
	const project = await client.projects.create({ name: "Private Project" });

	const grantWithUnapprovedScope = Reflect.apply(
		client.projects.access.grantContextAgent,
		undefined,
		[
			{
				projectId: project.id,
				purpose: "Prepare project context",
				scopes: ["project_context:read", "context_revision:activate"],
			},
		]
	);

	await expect(grantWithUnapprovedScope).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect(
		await client.projects.access.list({ projectId: project.id })
	).toHaveLength(0);
});

test("a connection cannot access project data before a provider is selected", async () => {
	const { auth } = createTestAuth();
	const cookie = await createUserSession(auth, "connection-owner");
	const client = createRpcClient(
		auth,
		createMemoryProjectAccessStore(),
		cookie
	);
	const project = await client.projects.create({ name: "Forest Quest" });

	const access = client.projects.access.checkConnection({
		projectId: project.id,
		purpose: "Generate a candidate asset",
		scope: "candidate_versions:write",
	});

	await expect(access).rejects.toMatchObject({ code: "FORBIDDEN" });
});
