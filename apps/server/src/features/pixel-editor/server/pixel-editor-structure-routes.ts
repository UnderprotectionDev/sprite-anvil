import type { Hono } from "hono";
import {
	applyFrameEdit,
	applySlicing,
	commitStructure,
	previewFrame,
	previewSlicing,
	readStructureView,
} from "./frame-structure";
import type { PixelEditorRouteDependencies } from "./pixel-editor-context";
import { handleJson, handlePng, readJson } from "./pixel-editor-http";

/** Thin adapters: the frame structure behavior lives in frame-structure.ts. */
export function mountPixelEditorStructureRoutes(
	app: Hono,
	dependencies: PixelEditorRouteDependencies,
	base: string
) {
	app.post(`${base}/:draftId/slicing-preview`, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) =>
			previewSlicing(scope, c.req.param("draftId"), body)
		);
	});
	app.post(`${base}/:draftId/structure/slicing`, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) =>
			applySlicing(scope, c.req.param("draftId"), body)
		);
	});
	app.get(`${base}/:draftId/structure`, (c) =>
		handleJson(c, dependencies, (scope) =>
			readStructureView(scope, c.req.param("draftId"))
		)
	);
	app.post(`${base}/:draftId/structure/operations`, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) =>
			applyFrameEdit(scope, c.req.param("draftId"), body)
		);
	});
	app.post(`${base}/:draftId/structure/commit`, async (c) => {
		const body = await readJson(c);
		return handleJson(c, dependencies, (scope) =>
			commitStructure(scope, c.req.param("draftId"), body)
		);
	});
	app.get(`${base}/:draftId/structure/frames/:frameKey/preview`, (c) =>
		handlePng(c, dependencies, (scope) =>
			previewFrame(scope, c.req.param("draftId"), c.req.param("frameKey"))
		)
	);
}
