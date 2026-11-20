import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { Hono } from "hono";
import {
	guardPixelEditorRpcRequest,
	mountPixelEditorRoutes,
} from "../pixel-editor-routes";
import { createPixelEditorOperations } from "../pixel-editor-rpc";
import {
	createHarness,
	otherProjectId,
	projectId,
	sourceVersionId,
} from "./pixel-editor-harness";

test("Working Draft and Offline Conflict JSON honor the session and Project scope in oRPC", async () => {
	const harness = await createHarness();
	const authenticated = await harness.dependencies.getSession(new Headers());
	const pixelEditorOperations = createPixelEditorOperations(
		harness.dependencies
	);
	const input = { projectId, sourceAssetVersionId: sourceVersionId };

	await expect(
		call(appRouter.workingDrafts.open, input, {
			context: { session: null, pixelEditorOperations } as Context,
		})
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	const context = { session: authenticated, pixelEditorOperations } as Context;
	await expect(
		call(
			appRouter.workingDrafts.open,
			{ ...input, projectId: otherProjectId },
			{
				context,
			}
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect(harness.drafts.size).toBe(0);
	const draft = await call(appRouter.workingDrafts.open, input, { context });
	expect(
		await call(
			appRouter.workingDrafts.read,
			{ projectId, draftId: draft.id },
			{ context }
		)
	).toMatchObject({ id: draft.id, revision: 0 });
	expect(
		await call(appRouter.offlineConflicts.list, { projectId }, { context })
	).toEqual({ conflicts: [], unreadable: [] });
});

test("the production Hono mount serves previews and leaves draft JSON to oRPC", async () => {
	const harness = await createHarness();
	const app = new Hono();
	mountPixelEditorRoutes(app, harness.dependencies);
	app.get("/*", (c) => c.text("SPA shell"));
	const opened = await harness.open();
	const { id } = (await opened.json()) as { id: string };
	const draftPath = `${harness.base}/${id}`;

	expect((await app.request(draftPath)).status).toBe(404);
	const png = await app.request(`${draftPath}/preview`);
	expect(png.status).toBe(200);
	expect(png.headers.get("content-type")).toBe("image/png");
	expect(png.headers.get("cache-control")).toBe("private, no-store");
});

test("Pixel Editor RPC rejects oversized procedure bodies before decoding them", async () => {
	const app = new Hono();
	app.use("/*", (c, next) =>
		guardPixelEditorRpcRequest(
			c,
			c.req.header("authorization") === "session",
			next
		)
	);
	app.post("/rpc/*", (c) => c.text("reached RPC"));
	const size = 128 * 1024 + 1;
	const response = await app.request("/rpc/workingDrafts/apply", {
		method: "POST",
		body: "x".repeat(size),
		headers: { authorization: "session" },
	});
	expect(response.status).toBe(413);
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(await response.json()).toMatchObject({
		json: { code: "PAYLOAD_TOO_LARGE" },
	});

	const offline = await app.request("/rpc/offlineConflicts/reconcile", {
		method: "POST",
		body: "x",
		headers: {
			authorization: "session",
			"Content-Length": String(96 * 1024 * 1024 + 1),
		},
	});
	expect(offline.status).toBe(413);
	expect(await offline.json()).toMatchObject({
		json: { code: "PAYLOAD_TOO_LARGE" },
	});

	const anonymous = await app.request("/rpc/offlineConflicts/reconcile", {
		method: "POST",
		body: "x",
		headers: { "Content-Length": String(96 * 1024 * 1024 + 1) },
	});
	expect(anonymous.status).toBe(401);
	expect(await anonymous.json()).toMatchObject({
		json: { code: "UNAUTHORIZED" },
	});

	const accepted = await app.request("/rpc/offlineConflicts/reconcile", {
		method: "POST",
		body: "x".repeat(size),
		headers: { authorization: "session" },
	});
	expect(accepted.status).toBe(200);
});

test("an authenticated HTTP RPC call persists and rereads a Working Draft", async () => {
	const harness = await createHarness();
	const session = await harness.dependencies.getSession(new Headers());
	const context = {
		session,
		pixelEditorOperations: createPixelEditorOperations(harness.dependencies),
	} as Context;
	const handler = new RPCHandler(appRouter);
	const app = new Hono();
	mountPixelEditorRoutes(app, harness.dependencies);
	app.use("/rpc/*", (c) =>
		guardPixelEditorRpcRequest(c, Boolean(session), async () => {
			const result = await handler.handle(c.req.raw, {
				context,
				prefix: "/rpc",
			});
			if (result.matched) {
				c.res = c.newResponse(result.response.body, result.response);
			}
		})
	);
	const request = (procedure: string, input: unknown) =>
		app.request(`/rpc/workingDrafts/${procedure}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ json: input }),
		});
	const opened = await request("open", {
		projectId,
		sourceAssetVersionId: sourceVersionId,
	});
	expect(opened.status).toBe(200);
	expect(opened.headers.get("cache-control")).toBe("private, no-store");
	const { json: draft } = (await opened.json()) as { json: { id: string } };
	expect(harness.drafts.has(draft.id)).toBe(true);
	const reread = await request("read", { projectId, draftId: draft.id });
	expect(reread.status).toBe(200);
	expect(await reread.json()).toMatchObject({
		json: { id: draft.id, revision: 0 },
	});
});
