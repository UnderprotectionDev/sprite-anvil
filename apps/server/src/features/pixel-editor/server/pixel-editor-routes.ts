import { createHash } from "node:crypto";
import type {
	AssetVersionFileRecord,
	AssetVersionStore,
} from "@sprite-anvil/api/asset-versions";
import {
	type PixelDraft,
	type PixelDraftRecord,
	type PixelDraftUpdateResult,
	type PixelEditorStore,
	type PixelOperation,
	pixelColorReplacePreviewInputSchema,
	pixelColorReplacePreviewSchema,
	pixelDraftCommitResponseSchema,
	pixelDraftHistoryInputSchema,
	pixelDraftOpenInputSchema,
	pixelDraftSchema,
	pixelEditorErrorSchema,
	pixelEditorMaxOperations,
	pixelOperationSchema,
} from "@sprite-anvil/api/pixel-editor";
import type { Context, Hono } from "hono";
import z from "zod";
import {
	createProjectAssetVersionObjectKey,
	type TwoDVisualAssetStorage,
} from "../../../cloudflare";
import {
	applyOperation,
	applyOperations,
	colorToHex,
	countColor,
	countColors,
	diffRasters,
	PixelOperationError,
	parseColor,
	type Raster,
} from "./pixel-operations";
import { encodeRasterPng, readRasterFromPng } from "./pixel-raster-codec";

const projectIdSchema = z.string().min(1).max(200);
const draftIdSchema = z.string().uuid();
const fileExtensionPattern = /\.[^.]+$/;
const expectedRevisionSchema = z.number().int().min(0);

export interface PixelEditorSession {
	user: { id: string };
}

export interface PixelEditorRouteDependencies {
	assetVersionStore: Pick<
		AssetVersionStore,
		"createCandidateVersion" | "getFileRecord"
	>;
	createId?: () => string;
	createStorage: () => TwoDVisualAssetStorage;
	getProjectForUser: (
		userId: string,
		projectId: string
	) => Promise<{ id: string } | null>;
	getSession: (headers: Headers) => Promise<PixelEditorSession | null>;
	pixelEditorStore: PixelEditorStore;
}

type ErrorName = z.infer<typeof pixelEditorErrorSchema>["error"];
type ErrorStatus = 400 | 401 | 404 | 409 | 422 | 502 | 503;

function fail(
	c: Context,
	error: ErrorName,
	status: ErrorStatus,
	detail?: string
) {
	c.header("Cache-Control", "private, no-store");
	return c.json(
		pixelEditorErrorSchema.parse({ error, ...(detail ? { detail } : {}) }),
		status
	);
}

type Access =
	| { ok: true; projectId: string; userId: string }
	| { ok: false; error: ErrorName; status: 401 | 404 };

async function resolveAccess(
	c: Context,
	dependencies: PixelEditorRouteDependencies
): Promise<Access> {
	const session = await dependencies.getSession(c.req.raw.headers);
	if (!session?.user) {
		return { ok: false, error: "Unauthorized", status: 401 };
	}
	const projectId = projectIdSchema.safeParse(c.req.param("projectId"));
	if (!projectId.success) {
		return { ok: false, error: "Not found", status: 404 };
	}
	const project = await dependencies.getProjectForUser(
		session.user.id,
		projectId.data
	);
	if (!project) {
		return { ok: false, error: "Not found", status: 404 };
	}
	return { ok: true, projectId: projectId.data, userId: session.user.id };
}

async function readJson(c: Context): Promise<unknown> {
	try {
		return await c.req.json();
	} catch {
		return null;
	}
}

async function readSourceRaster(
	dependencies: PixelEditorRouteDependencies,
	file: AssetVersionFileRecord
): Promise<Raster | null> {
	if (!(file.integrityVerified && file.contentDigest)) {
		return null;
	}
	const object = await dependencies
		.createStorage()
		.get(file.objectKey as never);
	if (!object) {
		return null;
	}
	const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
	const digest = createHash("sha256").update(bytes).digest("hex");
	if (
		bytes.byteLength !== file.contentLength ||
		digest !== file.contentDigest
	) {
		return null;
	}
	try {
		return await readRasterFromPng(bytes);
	} catch {
		return null;
	}
}

interface LoadedDraft {
	applied: Raster;
	draft: PixelDraftRecord;
	source: Raster;
	sourceFile: AssetVersionFileRecord;
}

async function loadDraft(
	c: Context,
	access: Extract<Access, { ok: true }>,
	dependencies: PixelEditorRouteDependencies,
	draftIdInput = c.req.param("draftId")
): Promise<LoadedDraft | Response> {
	const draftId = draftIdSchema.safeParse(draftIdInput);
	if (!draftId.success) {
		return fail(c, "Not found", 404);
	}
	const draft = await dependencies.pixelEditorStore.getDraft(
		access.userId,
		access.projectId,
		draftId.data
	);
	if (!draft) {
		return fail(c, "Not found", 404);
	}
	const sourceFile = await dependencies.assetVersionStore.getFileRecord(
		access.userId,
		access.projectId,
		draft.sourceAssetVersionId
	);
	const source = sourceFile
		? await readSourceRaster(dependencies, sourceFile)
		: null;
	if (!(sourceFile && source)) {
		return fail(c, "Source Asset Version image unavailable", 502);
	}
	try {
		const applied = applyOperations(
			source,
			draft.operations.slice(0, draft.appliedOperationCount)
		);
		return { applied, draft, source, sourceFile };
	} catch (error) {
		if (error instanceof PixelOperationError) {
			return fail(c, "Invalid pixel operation", 422, error.message);
		}
		throw error;
	}
}

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
	c.header("Cache-Control", "private, no-store");
	return c.json(buildView(loaded), status);
}

function mapUpdateFailure(c: Context, result: PixelDraftUpdateResult | null) {
	if (!result) {
		return fail(c, "Not found", 404);
	}
	if (result.kind === "conflict") {
		return fail(c, "Working Draft revision conflict", 409);
	}
	if (result.kind === "not-open") {
		return fail(c, "Working Draft is not open", 409);
	}
	return null;
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
		applyOperation(loaded.applied, operation.data);
	} catch (error) {
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
	const result = await dependencies.pixelEditorStore.updateOperations(
		access.userId,
		access.projectId,
		draft.id,
		{
			expectedRevision: input.data.expectedRevision,
			operations: draft.operations,
			appliedOperationCount:
				draft.appliedOperationCount + (direction === "undo" ? -1 : 1),
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
	c.header("Cache-Control", "private, no-store");
	return c.json(
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
		c.header("Cache-Control", "private, no-store");
		return c.json(buildView(loaded));
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
