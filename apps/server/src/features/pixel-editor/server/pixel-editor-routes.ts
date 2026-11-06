import type { Hono } from "hono";
import { mountOfflineConflictRoutes } from "./offline-conflict-routes";
import type { PixelEditorRouteDependencies } from "./pixel-editor-context";
import { handleJson, handlePng, readJson } from "./pixel-editor-http";
import { mountPixelEditorStructureRoutes } from "./pixel-editor-structure-routes";
import {
	applyDraftOperation,
	commitDraft,
	discardDraft,
	moveHistory,
	openDraft,
	previewColorReplace,
	readDraftPreview,
	readDraftView,
} from "./working-draft";

export type {
	PixelEditorRouteDependencies,
	PixelEditorSession,
} from "./pixel-editor-context";

/** Thin adapters: the Working Draft behavior lives in working-draft.ts. */
export function mountPixelEditorRoutes(
	app: Hono,
	dependencies: PixelEditorRouteDependencies
) {
	const base = "/api/projects/:projectId/pixel-editor/drafts";
	mountPixelEditorStructureRoutes(app, dependencies, base);
	mountOfflineConflictRoutes(app, dependencies);

	app.post(base, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) => openDraft(scope, body));
	});
	app.get(`${base}/:draftId`, (c) =>
		handleJson(c, dependencies, (scope) =>
			readDraftView(scope, c.req.param("draftId"))
		)
	);
	app.get(`${base}/:draftId/preview`, (c) =>
		handlePng(c, dependencies, (scope) =>
			readDraftPreview(scope, c.req.param("draftId"))
		)
	);
	app.post(`${base}/:draftId/operations`, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) =>
			applyDraftOperation(scope, c.req.param("draftId"), body)
		);
	});
	for (const direction of ["undo", "redo"] as const) {
		app.post(`${base}/:draftId/${direction}`, async (c) => {
			const body = await readJson(c);
			return handleJson(c, dependencies, (scope) =>
				moveHistory(scope, c.req.param("draftId"), body, direction)
			);
		});
	}
	app.post(`${base}/:draftId/color-replace-preview`, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) =>
			previewColorReplace(scope, c.req.param("draftId"), body)
		);
	});
	app.post(`${base}/:draftId/commit`, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) =>
			commitDraft(scope, c.req.param("draftId"), body)
		);
	});
	app.post(`${base}/:draftId/discard`, (c) =>
		handleJson(c, dependencies, (scope) =>
			discardDraft(scope, c.req.param("draftId"))
		)
	);
}
