import { expect, test } from "bun:test";
import { RPCHandler } from "@orpc/server/fetch";
import {
	privateDataResponseSchema,
	serializePrivateDataResponse,
	serializeRpcHealthResponse,
} from "@sprite-anvil/api/output-contracts";
import type { ProjectContextStore } from "@sprite-anvil/api/project-context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { betterAuth } from "better-auth";
import { type MemoryDB, memoryAdapter } from "better-auth/adapters/memory";
import { testUtils } from "better-auth/plugins";
import { Hono } from "hono";

const createdAt = new Date("2026-09-23T10:00:00.000Z");
const secretFieldPattern =
	/accessToken|refreshToken|encryptionKey|provider-access-token|project-encryption-key/i;
const unusedProjectContextStore = {
	createProject: () => {
		throw new Error("Unexpected Project Context access in this test");
	},
	createProposal: () => {
		throw new Error("Unexpected Context Proposal access in this test");
	},
	getRevision: () => Promise.resolve(null),
	getRevisionByProposal: () => Promise.resolve(null),
	getProposal: () => Promise.resolve(null),
	activateProposal: () => Promise.resolve(null),
	listProjects: () => Promise.resolve([]),
	listProposals: () => Promise.resolve([]),
} satisfies ProjectContextStore;

test("RPC response serializers use strict allowlisted output contracts", () => {
	const user = {
		id: "user-1",
		name: "Pixel Artist",
		email: "artist@example.test",
		emailVerified: true,
		image: null,
		createdAt,
		updatedAt: createdAt,
		accessToken: "provider-access-token",
		refreshToken: "provider-refresh-token",
		encryptionKey: "project-encryption-key",
	};
	const response = serializePrivateDataResponse(user);

	expect(response).toEqual({
		message: "This is private",
		user: {
			id: "user-1",
			name: "Pixel Artist",
			email: "artist@example.test",
			emailVerified: true,
			image: null,
			createdAt,
			updatedAt: createdAt,
		},
	});
	expect(JSON.stringify(response)).not.toMatch(secretFieldPattern);
	expect(
		privateDataResponseSchema.safeParse({
			user: {
				id: "user-1",
				name: "Pixel Artist",
				email: "artist@example.test",
				emailVerified: true,
				image: null,
				createdAt,
				updatedAt: createdAt,
				accessToken: "provider-access-token",
			},
			message: "This is private",
		}).success
	).toBe(false);
	expect(serializeRpcHealthResponse()).toBe("OK");
});

test("mounted RPC output does not return secret fields from the session user", async () => {
	const auth = betterAuth({
		baseURL: "http://localhost:3000",
		database: memoryAdapter({} satisfies MemoryDB),
		emailAndPassword: { enabled: true },
		plugins: [testUtils()],
		secret: "sprite-anvil-integration-test-secret-at-least-32-characters",
	});
	const authContext = await auth.$context;
	const user = await authContext.test.saveUser(
		authContext.test.createUser({
			email: "rpc-user@example.test",
			id: "rpc-user",
		})
	);
	const login = await authContext.test.login({ userId: user.id });
	const session = await auth.api.getSession({ headers: login.headers });
	if (!session) {
		throw new Error("Expected an authenticated RPC test session");
	}
	const sessionWithSecretFields = {
		...session,
		user: {
			...session.user,
			accessToken: "provider-access-token",
			encryptionKey: "project-encryption-key",
		},
	};

	const rpcHandler = new RPCHandler(appRouter);
	const app = new Hono();
	app.all("/rpc/*", async (c) => {
		const rpcResult = await rpcHandler.handle(c.req.raw, {
			prefix: "/rpc",
			context: {
				projectAccess: {} as never,
				db: createDb({
					DATABASE_URL:
						"postgresql://user:password@localhost:5432/sprite-anvil-test",
				}),
				projectContextStore: unusedProjectContextStore,
				session: sessionWithSecretFields,
			},
		});
		if (rpcResult.matched) {
			return c.newResponse(rpcResult.response.body, rpcResult.response);
		}
		return c.notFound();
	});

	const response = await app.request("/rpc/privateData", {
		method: "POST",
		headers: login.headers,
	});
	const payload: unknown = await response.json();

	expect(response.status).toBe(200);
	expect(JSON.stringify(payload)).not.toMatch(secretFieldPattern);
});
