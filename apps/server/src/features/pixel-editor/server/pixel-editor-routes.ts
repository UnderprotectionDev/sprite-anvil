import { ORPCError } from "@orpc/server";
import type { Context, Hono, Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import { previewFrame } from "./frame-structure";
import { readOfflineConflictPreview } from "./offline-conflict-reads";
import type { PixelEditorRouteDependencies } from "./pixel-editor-context";
import { handlePng } from "./pixel-editor-http";
import { readDraftPreview } from "./working-draft";

const draftRequestBytes = 128 * 1024;
// The wire format must accommodate 1,000 operations with 4,096 points each.
const reconcileRequestBytes = 96 * 1024 * 1024;

const pixelEditorRpcPath =
	/^\/(?:rpc|api-reference)\/(?:workingDrafts|offlineConflicts)\//u;
const reconcileProcedurePath = /\/offlineConflicts\/reconcile\/?$/u;

export async function guardPixelEditorRpcRequest(
	c: Context,
	authenticated: boolean,
	next: Next
) {
	const { path } = c.req;
	if (!pixelEditorRpcPath.test(path)) {
		await next();
		return;
	}
	c.header("Cache-Control", "private, no-store");
	if (!authenticated) {
		return c.json({ json: new ORPCError("UNAUTHORIZED").toJSON() }, 401);
	}
	const maxSize = reconcileProcedurePath.test(path)
		? reconcileRequestBytes
		: draftRequestBytes;
	return bodyLimit({
		maxSize,
		onError: (context) =>
			context.json({ json: new ORPCError("PAYLOAD_TOO_LARGE").toJSON() }, 413),
	})(c, next);
}

/** Private image URLs are kept stable for already persisted drafts. */
export function mountPixelEditorRoutes(
	app: Hono,
	dependencies: PixelEditorRouteDependencies
) {
	const base = "/api/projects/:projectId/pixel-editor";
	const drafts = `${base}/drafts/:draftId`;
	app.get(`${drafts}/preview`, (c) =>
		handlePng(c, dependencies, (scope) =>
			readDraftPreview(scope, c.req.param("draftId"))
		)
	);
	app.get(`${drafts}/structure/frames/:frameKey/preview`, (c) =>
		handlePng(c, dependencies, (scope) =>
			previewFrame(scope, c.req.param("draftId"), c.req.param("frameKey"))
		)
	);
	app.get(`${base}/offline-conflicts/:conflictId/preview/:side`, (c) =>
		handlePng(c, dependencies, (scope) =>
			readOfflineConflictPreview(
				scope,
				c.req.param("conflictId"),
				c.req.param("side")
			)
		)
	);
	app.all(`${base}/*`, (c) => c.notFound());
}
