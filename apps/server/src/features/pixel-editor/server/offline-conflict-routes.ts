import type { Hono } from "hono";
import {
	listOfflineConflicts,
	readOfflineConflict,
	readOfflineConflictPreview,
	reconcileStagedDraft,
	resolveOfflineConflict,
} from "./offline-conflicts";
import type { PixelEditorRouteDependencies } from "./pixel-editor-context";
import { handleJson, handlePng, readJson } from "./pixel-editor-http";

/** Thin adapters: the reconnect check and resolution live in offline-conflicts.ts. */
export function mountOfflineConflictRoutes(
	app: Hono,
	dependencies: PixelEditorRouteDependencies
) {
	const base = "/api/projects/:projectId/pixel-editor/offline-conflicts";

	app.post(`${base}/reconcile`, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) =>
			reconcileStagedDraft(scope, body)
		);
	});
	app.get(base, (c) =>
		handleJson(c, dependencies, (scope) => listOfflineConflicts(scope))
	);
	app.get(`${base}/:conflictId`, (c) =>
		handleJson(c, dependencies, (scope) =>
			readOfflineConflict(scope, c.req.param("conflictId"))
		)
	);
	app.get(`${base}/:conflictId/preview/:side`, (c) =>
		handlePng(c, dependencies, (scope) =>
			readOfflineConflictPreview(
				scope,
				c.req.param("conflictId"),
				c.req.param("side")
			)
		)
	);
	app.post(`${base}/:conflictId/resolve`, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) =>
			resolveOfflineConflict(scope, c.req.param("conflictId"), body)
		);
	});
}
