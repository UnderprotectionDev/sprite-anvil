import { expect, spyOn, test } from "bun:test";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import type { Context } from "@sprite-anvil/api/context";
import type { AppRouterClient } from "@sprite-anvil/api/routers/index";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { Hono } from "hono";
import { serializeRpcInternalServerError } from "./output-contracts";

const supportReferencePattern =
	/^SUP-[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}$/;

test("unexpected RPC failures return a support reference without exposing the exception", async () => {
	const handler = new RPCHandler(appRouter);
	const app = new Hono();
	const context = {
		assetFamilyStore: {} as never,
		assetVersionStore: {} as never,
		assetRecordStore: {} as never,
		assetRecordTrackingStore: {} as never,
		db: {} as never,
		projectAccess: {} as never,
		projectContextStore: {
			listProjects: () => {
				throw new Error("private project database detail");
			},
		} as never,
		session: { user: { id: "user-1" } },
	} as unknown as Context;

	app.use("/*", async (c, next) => {
		const result = await handler.handle(c.req.raw, {
			context,
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
			fetch: async (input, init) => app.fetch(new Request(input, init)),
		})
	);
	const consoleError = spyOn(console, "error").mockImplementation(
		() => undefined
	);
	let caught: unknown;

	try {
		await client.projectContexts.list().catch((error: unknown) => {
			caught = error;
		});
		const logEntry = consoleError.mock.calls.find(
			([message]) => message === "Unhandled API operation"
		);
		const logDetails = logEntry?.[1] as
			| { operation?: string; supportReference?: string }
			| undefined;
		expect(logDetails?.operation).toBe("projectContexts.list");
		expect(typeof logDetails?.supportReference).toBe("string");
		expect(logDetails?.supportReference).toBe(
			(caught as { data: { supportReference: string } }).data.supportReference
		);
		expect(JSON.stringify(logDetails)).not.toContain(
			"private project database detail"
		);
	} finally {
		consoleError.mockRestore();
	}

	expect(caught).toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
		message: "Internal server error",
		data: {
			supportReference: expect.stringMatching(supportReferencePattern),
		},
	});
	expect(JSON.stringify(caught)).not.toContain(
		"private project database detail"
	);
});

test("unhandled RPC setup failures return an ORPC error with a usable support reference", async () => {
	const supportReference = "SUP-7CFB1C3A-A7A3-4BC2-B748-B5065AA2314A";
	const app = new Hono();
	app.onError((_error, c) =>
		c.json(serializeRpcInternalServerError(supportReference), 500)
	);
	app.use("/rpc/*", () => {
		throw new Error("private session lookup detail");
	});

	const client = createORPCClient<AppRouterClient>(
		new RPCLink({
			url: "http://localhost/rpc",
			fetch: async (input, init) => app.fetch(new Request(input, init)),
		})
	);
	let caught: unknown;
	await client.healthCheck().catch((error: unknown) => {
		caught = error;
	});

	expect(caught).toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
		data: { supportReference },
	});
	expect(JSON.stringify(caught)).not.toContain("private session lookup detail");
});
