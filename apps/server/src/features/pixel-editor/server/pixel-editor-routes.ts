import { createHash } from "node:crypto";
import {
	type PixelDraft,
	type PixelDraftRecord,
	type PixelOperation,
	pixelColorReplacePreviewInputSchema,
	pixelColorReplacePreviewSchema,
	pixelDraftCommitResponseSchema,
	pixelDraftHistoryInputSchema,
	pixelDraftOpenInputSchema,
	pixelDraftSchema,
	pixelEditorMaxOperations,
	pixelOperationSchema,
} from "@sprite-anvil/api/pixel-editor";
import type { Context, Hono } from "hono";
import z from "zod";
import { createProjectAssetVersionObjectKey } from "../../../cloudflare";
import {
	type Access,
	draftIdSchema,
	type ErrorName,
	fail,
	type LoadedDraft,
	loadDraft,
	mapUpdateFailure,
	noStoreJson,
	type PixelEditorRouteDependencies,
	readJson,
	readSourceRaster,
	resolveAccess,
	structureFailure,
} from "./pixel-editor-http";
import { mountPixelEditorStructureRoutes } from "./pixel-editor-structure-routes";
import {
	applyOperations,
	applyOperationToState,
	colorToHex,
	countColor,
	countColors,
	diffRasters,
	PixelOperationError,
	parseColor,
} from "./pixel-operations";
import { encodeRasterPng } from "./pixel-raster-codec";
import { assertSheetEditKeepsProtectedFrames } from "./sheet-structure";

export type {
	PixelEditorRouteDependencies,
	PixelEditorSession,
} from "./pixel-editor-http";

const fileExtensionPattern = /\.[^.]+$/;
const expectedRevisionSchema = z.number().int().min(0);

function sortedUsage(counts: Map<string, number>, only?: Set<string>) {
	return [...counts.entries()]
		.filter(([color]) => (only ? only.has(color) : true))
		.map(([color, pixelCount]) => ({ color, pixelCount }))
		.sort(
			(a, b) => b.pixelCount - a.pixelCount || a.color.localeCompare(b.color)
		);
}

function draftPath(draft: PixelDraftRecord) {
	return `/api/projects/${encodeURIComponent(draft.projectId)}/pixel-editor/drafts/${draft.id}`;
}

function buildView(loaded: LoadedDraft): PixelDraft {
	const { draft, source, applied } = loaded;
	const palette = [...countColors(source).keys()].sort();
	const paletteSet = new Set(palette);
	const used = countColors(applied);
	const outOfPalette = new Set(
		[...used.keys()].filter((color) => !paletteSet.has(color))
	);
	return pixelDraftSchema.parse({
		id: draft.id,
		projectId: draft.projectId,
		assetRecordId: draft.assetRecordId,
		sourceAssetVersionId: draft.sourceAssetVersionId,
		status: draft.status,
		revision: draft.revision,
		operations: draft.operations.slice(0, draft.appliedOperationCount),
		appliedOperationCount: draft.appliedOperationCount,
		canUndo: draft.appliedOperationCount > 0,
		canRedo: draft.operations.length > draft.appliedOperationCount,
		sourceSize: { width: source.width, height: source.height },
		size: { width: applied.width, height: applied.height },
		diff: diffRasters(source, applied),
		palette: { origin: "source-image", colors: palette },
		usedColors: sortedUsage(used),
		outOfPaletteColors: sortedUsage(used, outOfPalette),
		sourcePreviewUrl: `/api/projects/${encodeURIComponent(draft.projectId)}/asset-versions/${draft.sourceAssetVersionId}/preview`,
		previewUrl: `${draftPath(draft)}/preview`,
		committedAssetVersionId: draft.committedAssetVersionId,
		updatedAt: draft.updatedAt.toISOString(),
	});
}

async function viewResponse(
	c: Context,
	dependencies: PixelEditorRouteDependencies,
	access: Extract<Access, { ok: true }>,
	draftId: string,
	status: 200 | 201 = 200
) {
	const loaded = await loadDraft(c, access, dependencies, draftId);
	if (loaded instanceof Response) {
		return loaded;
	}
	return noStoreJson(c, buildView(loaded), status);
}

async function openDraft(
	c: Context,
	dependencies: PixelEditorRouteDependencies
) {
	const access = await resolveAccess(c, dependencies);
	if (!access.ok) {
		return fail(c, access.error, access.status);
	}
	const input = pixelDraftOpenInputSchema.safeParse(await readJson(c));
	if (!input.success) {
		return fail(c, "Invalid Working Draft request", 400);
	}
	const sourceFile = await dependencies.assetVersionStore.getFileRecord(
		access.userId,
		access.projectId,
		input.data.sourceAssetVersionId
	);
	if (!sourceFile || sourceFile.projectId !== access.projectId) {
		return fail(c, "Not found", 404);
	}
	const source = await readSourceRaster(dependencies, sourceFile);
	if (!source) {
		return fail(c, "Source Asset Version image unavailable", 502);
	}
	const result = await dependencies.pixelEditorStore.createDraft(
		access.userId,
		{
			id: dependencies.createId ? dependencies.createId() : crypto.randomUUID(),
			projectId: access.projectId,
			assetFamilyId: sourceFile.assetFamilyId,
			assetRecordId: sourceFile.assetRecordId,
			sourceAssetVersionId: sourceFile.id,
		}
	);
	if (!result) {
		return fail(c, "Not found", 404);
	}
	return viewResponse(
		c,
		dependencies,
		access,
		result.draft.id,
		result.kind === "created" ? 201 : 200
	);
}

async function applyDraftOperation(
	c: Context,
	dependencies: PixelEditorRouteDependencies
) {
	const access = await resolveAccess(c, dependencies);
	if (!access.ok) {
		return fail(c, access.error, access.status);
	}
	const body = (await readJson(c)) as {
		expectedRevision?: unknown;
		operation?: unknown;
	} | null;
	const revision = expectedRevisionSchema.safeParse(body?.expectedRevision);
	if (!revision.success) {
		return fail(c, "Invalid Working Draft request", 400);
	}
	const operation = pixelOperationSchema.safeParse(body?.operation);
	if (!operation.success) {
		return fail(c, "Invalid pixel operation", 400);
	}
	const loaded = await loadDraft(c, access, dependencies);
	if (loaded instanceof Response) {
		return loaded;
	}
	if (loaded.draft.status !== "open") {
		return fail(c, "Working Draft is not open", 409);
	}
	if (loaded.draft.appliedOperationCount >= pixelEditorMaxOperations) {
		return fail(
			c,
			"Invalid pixel operation",
			422,
			"Working Draft reached the operation limit; commit before editing further"
		);
	}
	try {
		const { raster: next } = applyOperationToState(
			{ raster: loaded.applied, clipboard: loaded.clipboard },
			operation.data
		);
		if (loaded.draft.structure) {
			assertSheetEditKeepsProtectedFrames(
				loaded.draft.structure,
				loaded.applied,
				next
			);
		}
	} catch (error) {
		const failure = structureFailure(c, error, "Invalid pixel operation");
		if (failure) {
			return failure;
		}
		if (error instanceof PixelOperationError) {
			return fail(c, "Invalid pixel operation", 422, error.message);
		}
		throw error;
	}
	const operations: PixelOperation[] = [
		...loaded.draft.operations.slice(0, loaded.draft.appliedOperationCount),
		operation.data,
	];
	const result = await dependencies.pixelEditorStore.updateOperations(
		access.userId,
		access.projectId,
		loaded.draft.id,
		{
			expectedRevision: revision.data,
			operations,
			appliedOperationCount: operations.length,
		}
	);
	return (
		mapUpdateFailure(c, result) ??
		viewResponse(c, dependencies, access, loaded.draft.id)
	);
}

async function moveHistory(
	c: Context,
	dependencies: PixelEditorRouteDependencies,
	direction: "undo" | "redo"
) {
	const access = await resolveAccess(c, dependencies);
	if (!access.ok) {
		return fail(c, access.error, access.status);
	}
	const input = pixelDraftHistoryInputSchema.safeParse(await readJson(c));
	if (!input.success) {
		return fail(c, "Invalid Working Draft request", 400);
	}
	const loaded = await loadDraft(c, access, dependencies);
	if (loaded instanceof Response) {
		return loaded;
	}
	const { draft } = loaded;
	if (draft.status !== "open") {
		return fail(c, "Working Draft is not open", 409);
	}
	if (direction === "undo" && draft.appliedOperationCount === 0) {
		return fail(c, "Nothing to undo", 409);
	}
	if (
		direction === "redo" &&
		draft.appliedOperationCount >= draft.operations.length
	) {
		return fail(c, "Nothing to redo", 409);
	}
	const appliedOperationCount =
		draft.appliedOperationCount + (direction === "undo" ? -1 : 1);
	if (draft.structure) {
		try {
			assertSheetEditKeepsProtectedFrames(
				draft.structure,
				loaded.applied,
				applyOperations(
					loaded.source,
					draft.operations.slice(0, appliedOperationCount)
				)
			);
		} catch (error) {
			const failure = structureFailure(c, error, "Invalid pixel operation");
			if (failure) {
				return failure;
			}
			throw error;
		}
	}
	const result = await dependencies.pixelEditorStore.updateOperations(
		access.userId,
		access.projectId,
		draft.id,
		{
			expectedRevision: input.data.expectedRevision,
			operations: draft.operations,
			appliedOperationCount,
		}
	);
	return (
		mapUpdateFailure(c, result) ??
		viewResponse(c, dependencies, access, draft.id)
	);
}

type StoredCandidate =
	| { ok: true; created: boolean; versionId: string }
	| { ok: false; error: ErrorName; status: 404 | 409 | 503 };

/** Stores the rendered PNG and creates the single Candidate Version for a draft. */
async function storeCandidate(
	dependencies: PixelEditorRouteDependencies,
	access: Extract<Access, { ok: true }>,
	{ draft, sourceFile }: LoadedDraft,
	png: Uint8Array<ArrayBuffer>
): Promise<StoredCandidate> {
	const versionId = dependencies.createId
		? dependencies.createId()
		: crypto.randomUUID();
	const objectKey = createProjectAssetVersionObjectKey(
		access.projectId,
		draft.assetRecordId,
		versionId
	);
	const storage = dependencies.createStorage();
	let persistenceAttempted = false;
	try {
		await storage.put(
			objectKey,
			new Response(png).body as ReadableStream<Uint8Array>,
			"image/png",
			png.byteLength
		);
		persistenceAttempted = true;
		const created = await dependencies.assetVersionStore.createCandidateVersion(
			access.userId,
			{
				id: versionId,
				assetFamilyId: draft.assetFamilyId,
				assetRecordId: draft.assetRecordId,
				projectId: access.projectId,
				objectKey,
				contentType: "image/png",
				contentLength: png.byteLength,
				contentDigest: createHash("sha256").update(png).digest("hex"),
				fileName: sourceFile.fileName
					? `${sourceFile.fileName.replace(fileExtensionPattern, "")}-pixel-edit.png`
					: "pixel-edit.png",
				idempotencyKey: `pixel-editor-draft:${draft.id}`,
				integrityVerified: true,
				sourceKind: "derived",
			}
		);
		if (
			!(created && (created.kind === "created" || created.kind === "existing"))
		) {
			await storage.delete(objectKey);
			return created
				? { ok: false, error: "Working Draft commit failed", status: 409 }
				: { ok: false, error: "Not found", status: 404 };
		}
		if (created.kind === "existing") {
			await storage.delete(objectKey);
		}
		return {
			ok: true,
			created: created.kind === "created",
			versionId: created.version.id,
		};
	} catch {
		if (!persistenceAttempted) {
			try {
				await storage.delete(objectKey);
			} catch {
				// Failed closed; the draft stays open and retryable.
			}
		}
		return { ok: false, error: "Working Draft commit failed", status: 503 };
	}
}

async function commitDraft(
	c: Context,
	dependencies: PixelEditorRouteDependencies
) {
	const access = await resolveAccess(c, dependencies);
	if (!access.ok) {
		return fail(c, access.error, access.status);
	}
	const loaded = await loadDraft(c, access, dependencies);
	if (loaded instanceof Response) {
		return loaded;
	}
	const { draft, applied } = loaded;
	if (draft.status === "committed" && draft.committedAssetVersionId) {
		return c.json(
			pixelDraftCommitResponseSchema.parse({
				draft: buildView(loaded),
				assetVersionId: draft.committedAssetVersionId,
				created: false,
			})
		);
	}
	if (draft.status !== "open") {
		return fail(c, "Working Draft is not open", 409);
	}
	if (draft.appliedOperationCount === 0) {
		return fail(c, "Working Draft has no changes", 400);
	}

	const stored = await storeCandidate(
		dependencies,
		access,
		loaded,
		await encodeRasterPng(applied)
	);
	if (!stored.ok) {
		return fail(c, stored.error, stored.status);
	}
	const marked = await dependencies.pixelEditorStore.markCommitted(
		access.userId,
		access.projectId,
		draft.id,
		stored.versionId
	);
	if (!marked) {
		return fail(c, "Not found", 404);
	}
	// A concurrent commit may have won; the stored link is authoritative.
	const reread = await loadDraft(c, access, dependencies);
	if (reread instanceof Response) {
		return reread;
	}
	return noStoreJson(
		c,
		pixelDraftCommitResponseSchema.parse({
			draft: buildView(reread),
			assetVersionId: reread.draft.committedAssetVersionId ?? stored.versionId,
			created: stored.created,
		}),
		stored.created ? 201 : 200
	);
}

export function mountPixelEditorRoutes(
	app: Hono,
	dependencies: PixelEditorRouteDependencies
) {
	const base = "/api/projects/:projectId/pixel-editor/drafts";
	mountPixelEditorStructureRoutes(app, dependencies, base);

	app.post(base, (c) => openDraft(c, dependencies));

	app.get(`${base}/:draftId`, async (c) => {
		const access = await resolveAccess(c, dependencies);
		if (!access.ok) {
			return fail(c, access.error, access.status);
		}
		const loaded = await loadDraft(c, access, dependencies);
		if (loaded instanceof Response) {
			return loaded;
		}
		return noStoreJson(c, buildView(loaded));
	});

	app.get(`${base}/:draftId/preview`, async (c) => {
		const access = await resolveAccess(c, dependencies);
		if (!access.ok) {
			return fail(c, access.error, access.status);
		}
		const loaded = await loadDraft(c, access, dependencies);
		if (loaded instanceof Response) {
			return loaded;
		}
		const png = await encodeRasterPng(loaded.applied);
		return c.body(png, 200, {
			"Cache-Control": "private, no-store",
			"Content-Type": "image/png",
			"X-Content-Type-Options": "nosniff",
		});
	});

	app.post(`${base}/:draftId/operations`, (c) =>
		applyDraftOperation(c, dependencies)
	);
	app.post(`${base}/:draftId/undo`, (c) =>
		moveHistory(c, dependencies, "undo")
	);
	app.post(`${base}/:draftId/redo`, (c) =>
		moveHistory(c, dependencies, "redo")
	);

	app.post(`${base}/:draftId/color-replace-preview`, async (c) => {
		const access = await resolveAccess(c, dependencies);
		if (!access.ok) {
			return fail(c, access.error, access.status);
		}
		const input = pixelColorReplacePreviewInputSchema.safeParse(
			await readJson(c)
		);
		if (!input.success) {
			return fail(c, "Invalid Working Draft request", 400);
		}
		const loaded = await loadDraft(c, access, dependencies);
		if (loaded instanceof Response) {
			return loaded;
		}
		const palette = new Set(countColors(loaded.source).keys());
		const [r, g, b, a] = parseColor(input.data.to);
		const target = colorToHex(r, g, b, a);
		c.header("Cache-Control", "private, no-store");
		return c.json(
			pixelColorReplacePreviewSchema.parse({
				from: input.data.from,
				to: input.data.to,
				affectedPixelCount: countColor(loaded.applied, input.data.from),
				resultIsInPalette: a === 0 || palette.has(target),
			})
		);
	});

	app.post(`${base}/:draftId/commit`, (c) => commitDraft(c, dependencies));

	app.post(`${base}/:draftId/discard`, async (c) => {
		const access = await resolveAccess(c, dependencies);
		if (!access.ok) {
			return fail(c, access.error, access.status);
		}
		const draftId = draftIdSchema.safeParse(c.req.param("draftId"));
		if (!draftId.success) {
			return fail(c, "Not found", 404);
		}
		const result = await dependencies.pixelEditorStore.discardDraft(
			access.userId,
			access.projectId,
			draftId.data
		);
		return (
			mapUpdateFailure(c, result) ??
			viewResponse(c, dependencies, access, draftId.data)
		);
	});
}
