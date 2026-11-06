import type { Hono } from "hono";
import { createAbandonConfirmations } from "./abandon-confirmation";
import {
	listOfflineConflicts,
	readOfflineConflict,
	readOfflineConflictPreview,
} from "./offline-conflict-reads";
import {
	resolveOfflineConflict,
	serveAbandonConfirmation,
} from "./offline-conflict-resolution";
import { reconcileStagedDraft } from "./offline-reconcile";
import type { PixelEditorRouteDependencies } from "./pixel-editor-context";
import { handleJson, handlePng, readJson } from "./pixel-editor-http";

/** Thin adapters: the reconnect check, reads and resolution live in the offline-* modules. */
export function mountOfflineConflictRoutes(
	app: Hono,
	dependencies: PixelEditorRouteDependencies
) {
	const base = "/api/projects/:projectId/pixel-editor/offline-conflicts";
	const confirmations = createAbandonConfirmations(dependencies);

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
	app.post(`${base}/:conflictId/abandon-confirmation`, (c) =>
		handleJson(c, dependencies, (scope) =>
			serveAbandonConfirmation(scope, confirmations, c.req.param("conflictId"))
		)
	);
	app.post(`${base}/:conflictId/resolve`, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) =>
			resolveOfflineConflict(
				scope,
				confirmations,
				c.req.param("conflictId"),
				body
			)
		);
	});
}
