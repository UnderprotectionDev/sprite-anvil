import { expect, test } from "bun:test";
import { RPCHandler } from "@orpc/server/fetch";
import type { ProjectContextScopeStore } from "@sprite-anvil/api/context-scopes";
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
import {
	publicApiErrorSchema,
	serializePublicApiError,
} from "./output-contracts";

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
const unusedProjectContextScopeStore = {
	createTheme: () => Promise.resolve(null),
	createVisualWorld: () => Promise.resolve(null),
	list: () => Promise.resolve(null),
} satisfies ProjectContextScopeStore;

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

test("public HTTP errors accept a valid support reference without requiring one", () => {
	const supportReference = "SUP-7CFB1C3A-A7A3-4BC2-B748-B5065AA2314A";

	expect(
		serializePublicApiError("Internal Server Error", supportReference)
	).toEqual({
		error: "Internal Server Error",
		supportReference,
	});
	expect(serializePublicApiError("Not found")).toEqual({ error: "Not found" });
	expect(
		publicApiErrorSchema.safeParse({
			error: "Internal Server Error",
			supportReference: "SUP-not-a-uuid",
		}).success
	).toBe(false);
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
				assetRecordStore: {} as never,
				assetRecordTrackingStore: {} as never,
				projectAccess: {} as never,
				db: createDb({
					DATABASE_URL:
						"postgresql://user:password@localhost:5432/sprite-anvil-test",
				}),
				projectContextStore: unusedProjectContextStore,
				projectContextScopeStore: unusedProjectContextScopeStore,
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
