import { createHash } from "node:crypto";
import {
	type FrameOperation,
	frameKeySchema,
	frameOperationInputSchema,
	frameStructureCommitInputSchema,
	frameStructureCommitResponseSchema,
	type SheetStructure,
	type SheetStructureView,
	sheetSlicingApplyInputSchema,
	sheetSlicingPreviewInputSchema,
	sheetSlicingPreviewSchema,
	sheetStructureSchema,
	sheetStructureViewSchema,
} from "@sprite-anvil/api/pixel-editor-structure";
import type { Context, Hono } from "hono";
import { createProjectAssetVersionObjectKey } from "../../../cloudflare";
import {
	type Access,
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
import type { Raster } from "./pixel-operations";
import { encodeRasterPng } from "./pixel-raster-codec";
import {
	applyFrameOperation,
	assertProtectedFramesUnchanged,
	computeCells,
	createStructure,
	frameStatus,
	orderChanged,
	type RenderContext,
	renderFrames,
	resliceStructure,
} from "./sheet-structure";

const fileExtensionPattern = /\.[^.]+$/;

type Ready = Extract<Access, { ok: true }>;

function digest(parts: string[]) {
	return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

function assetVersionIdsOf(structure: SheetStructure) {
	const ids = new Set<string>();
	for (const frame of structure.frames) {
		if (frame.origin.kind === "asset-version") {
			ids.add(frame.origin.assetVersionId);
		}
	}
	return ids;
}

/** Reads other Asset Versions of this project as rasters; null when one is missing or unreadable. */
async function readSources(
	dependencies: PixelEditorRouteDependencies,
	access: Ready,
	ids: Iterable<string>
): Promise<{ sources: Map<string, Raster> } | { missing: string }> {
	const sources = new Map<string, Raster>();
	for (const id of ids) {
		// biome-ignore lint/performance/noAwaitInLoops: a few rasters are read in order and the first failure stops the request
		const file = await dependencies.assetVersionStore.getFileRecord(
			access.userId,
			access.projectId,
			id
		);
		const raster = file ? await readSourceRaster(dependencies, file) : null;
		if (!raster) {
			return { missing: id };
		}
		sources.set(id, raster);
	}
	return { sources };
}

function structurePath(projectId: string, draftId: string) {
	return `/api/projects/${encodeURIComponent(projectId)}/pixel-editor/drafts/${draftId}/structure`;
}

interface StructureState {
	context: RenderContext;
	loaded: LoadedDraft;
	structure: SheetStructure;
}

/** Loads the draft plus every raster its frames need. */
async function loadStructure(
	c: Context,
	access: Ready,
	dependencies: PixelEditorRouteDependencies
): Promise<StructureState | Response> {
	const loaded = await loadDraft(c, access, dependencies);
	if (loaded instanceof Response) {
		return loaded;
	}
	const { structure } = loaded.draft;
	if (!structure) {
		return fail(c, "Working Draft has no frame structure", 409);
	}
	const read = await readSources(
		dependencies,
		access,
		assetVersionIdsOf(structure)
	);
	if ("missing" in read) {
		return fail(c, "Source Asset Version image unavailable", 502);
	}
	return {
		loaded,
		structure,
		context: { sheet: loaded.applied, sources: read.sources },
	};
}

function buildView(state: StructureState): SheetStructureView {
	const { loaded, structure, context } = state;
	const cells = computeCells(structure.slicing, loaded.applied);
	const rendered = renderFrames(structure, cells, context);
	const affected: string[] = [];
	const frames = structure.frames.map((frame, index) => {
		const entry = rendered.get(frame.key);
		const status = frameStatus(frame, entry?.fingerprint ?? "");
		if (status !== "pinned") {
			affected.push(frame.key);
		}
		return {
			key: frame.key,
			index,
			origin: frame.origin,
			durationMs: frame.durationMs,
			offsetX: frame.offsetX,
			offsetY: frame.offsetY,
			pivotX: frame.pivotX,
			pivotY: frame.pivotY,
			keep: frame.keep,
			status,
			unitVersionId: frame.committed?.unitVersionId ?? null,
			previewUrl: `${structurePath(loaded.draft.projectId, loaded.draft.id)}/frames/${frame.key}/preview`,
		};
	});
	return sheetStructureViewSchema.parse({
		draftId: loaded.draft.id,
		draftRevision: loaded.draft.revision,
		sheetSize: { width: loaded.applied.width, height: loaded.applied.height },
		slicing: structure.slicing,
		cells,
		frames,
		affectedFrameKeys: affected,
		orderChanged: orderChanged(structure),
		lastCommit: structure.lastCommit,
	});
}

async function structureResponse(
	c: Context,
	access: Ready,
	dependencies: PixelEditorRouteDependencies,
	status: 200 | 201 = 200
) {
	const state = await loadStructure(c, access, dependencies);
	if (state instanceof Response) {
		return state;
	}
	try {
		return noStoreJson(c, buildView(state), status);
	} catch (error) {
		return (
			structureFailure(c, error) ??
			fail(c, "Invalid frame operation", 422, "The frame structure is stale")
		);
	}
}

async function requireAccess(
	c: Context,
	dependencies: PixelEditorRouteDependencies
) {
	const access = await resolveAccess(c, dependencies);
	if (!access.ok) {
		return fail(c, access.error, access.status);
	}
	return access;
}

async function previewSlicing(
	c: Context,
	dependencies: PixelEditorRouteDependencies
) {
	const access = await requireAccess(c, dependencies);
	if (access instanceof Response) {
		return access;
	}
	const input = sheetSlicingPreviewInputSchema.safeParse(await readJson(c));
	if (!input.success) {
		return fail(c, "Invalid slicing parameters", 400);
	}
	const loaded = await loadDraft(c, access, dependencies);
	if (loaded instanceof Response) {
		return loaded;
	}
	try {
		const cells = computeCells(input.data.slicing, loaded.applied);
		return noStoreJson(
			c,
			sheetSlicingPreviewSchema.parse({
				cells,
				frameCount: cells.length,
				sheetSize: {
					width: loaded.applied.width,
					height: loaded.applied.height,
				},
			})
		);
	} catch (error) {
		return (
			structureFailure(c, error) ?? fail(c, "Invalid slicing parameters", 422)
		);
	}
}

async function applySlicing(
	c: Context,
	dependencies: PixelEditorRouteDependencies
) {
	const access = await requireAccess(c, dependencies);
	if (access instanceof Response) {
		return access;
	}
	const input = sheetSlicingApplyInputSchema.safeParse(await readJson(c));
	if (!input.success) {
		return fail(c, "Invalid slicing parameters", 400);
	}
	const loaded = await loadDraft(c, access, dependencies);
	if (loaded instanceof Response) {
		return loaded;
	}
	if (loaded.draft.status !== "open") {
		return fail(c, "Working Draft is not open", 409);
	}
	try {
		let next: SheetStructure;
		const before = loaded.draft.structure;
		if (before) {
			next = resliceStructure(before, input.data.slicing, loaded.applied);
			const read = await readSources(
				dependencies,
				access,
				assetVersionIdsOf(next)
			);
			if ("missing" in read) {
				return fail(c, "Source Asset Version image unavailable", 502);
			}
			const context = { sheet: loaded.applied, sources: read.sources };
			assertProtectedFramesUnchanged(
				before,
				next,
				{
					before: computeCells(before.slicing, loaded.applied),
					after: computeCells(next.slicing, loaded.applied),
				},
				{ before: context, after: context }
			);
		} else {
			next = createStructure(input.data.slicing, loaded.applied);
		}
		const result = await dependencies.pixelEditorStore.updateStructure(
			access.userId,
			access.projectId,
			loaded.draft.id,
			{
				expectedRevision: input.data.expectedRevision,
				structure: sheetStructureSchema.parse(next),
			}
		);
		return (
			mapUpdateFailure(c, result) ?? structureResponse(c, access, dependencies)
		);
	} catch (error) {
		const failure = structureFailure(c, error);
		if (failure) {
			return failure;
		}
		throw error;
	}
}

async function applyFrameEdit(
	c: Context,
	dependencies: PixelEditorRouteDependencies
) {
	const access = await requireAccess(c, dependencies);
	if (access instanceof Response) {
		return access;
	}
	const input = frameOperationInputSchema.safeParse(await readJson(c));
	if (!input.success) {
		return fail(c, "Invalid frame operation", 400);
	}
	const state = await loadStructure(c, access, dependencies);
	if (state instanceof Response) {
		return state;
	}
	if (state.loaded.draft.status !== "open") {
		return fail(c, "Working Draft is not open", 409);
	}
	const operation: FrameOperation = input.data.operation;
	const sources = new Map(state.context.sources);
	if (
		operation.type === "add-from-asset-version" ||
		operation.type === "replace"
	) {
		const read = await readSources(dependencies, access, [
			operation.assetVersionId,
		]);
		if ("missing" in read) {
			return fail(c, "Not found", 404);
		}
		for (const [id, raster] of read.sources) {
			sources.set(id, raster);
		}
	}
	try {
		const next = applyFrameOperation(state.structure, operation, sources);
		const cells = computeCells(next.slicing, state.loaded.applied);
		assertProtectedFramesUnchanged(
			state.structure,
			next,
			{ before: cells, after: cells },
			{
				before: { sheet: state.loaded.applied, sources },
				after: { sheet: state.loaded.applied, sources },
			}
		);
		renderFrames(next, cells, { sheet: state.loaded.applied, sources });
		const result = await dependencies.pixelEditorStore.updateStructure(
			access.userId,
			access.projectId,
			state.loaded.draft.id,
			{
				expectedRevision: input.data.expectedRevision,
				structure: sheetStructureSchema.parse(next),
			}
		);
		return (
			mapUpdateFailure(c, result) ?? structureResponse(c, access, dependencies)
		);
	} catch (error) {
		const failure = structureFailure(c, error);
		if (failure) {
			return failure;
		}
		throw error;
	}
}

async function storeFrameUnit(
	dependencies: PixelEditorRouteDependencies,
	access: Ready,
	loaded: LoadedDraft,
	frame: SheetStructure["frames"][number],
	fingerprint: string,
	png: Uint8Array<ArrayBuffer>
): Promise<{ assetVersionId: string; unitVersionId: string } | null> {
	const { draft, sourceFile } = loaded;
	const versionId = dependencies.createId
		? dependencies.createId()
		: crypto.randomUUID();
	const objectKey = createProjectAssetVersionObjectKey(
		access.projectId,
		draft.assetRecordId,
		versionId
	);
	const storage = dependencies.createStorage();
	await storage.put(
		objectKey,
		new Response(png).body as ReadableStream<Uint8Array>,
		"image/png",
		png.byteLength
	);
	const baseName = sourceFile.fileName
		? sourceFile.fileName.replace(fileExtensionPattern, "")
		: "sheet";
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
			fileName: `${baseName}-${frame.key}.png`,
			idempotencyKey: `pixel-editor-frame:${draft.id}:${frame.key}:${fingerprint.slice(0, 32)}`,
			integrityVerified: true,
			sourceKind: "derived",
			unitCorrection: {
				sourceAssetVersionId:
					frame.committed?.assetVersionId ?? draft.sourceAssetVersionId,
				unitType: "frame",
				unitKey: frame.key,
			},
		}
	);
	const usable =
		created &&
		(created.kind === "created" || created.kind === "existing") &&
		created.unitVersion;
	if (!usable) {
		await storage.delete(objectKey);
		return null;
	}
	if (created.kind === "existing") {
		await storage.delete(objectKey);
	}
	return {
		assetVersionId: created.version.id,
		unitVersionId: usable.id,
	};
}

interface PinnedFrames {
	committed: Map<
		string,
		{ assetVersionId: string; fingerprint: string; unitVersionId: string }
	>;
	createdUnitVersionIds: string[];
	reusedUnitVersionIds: string[];
}

/** Reuses the Unit Version of every unchanged frame and builds one for each affected frame. */
async function pinFrames(
	dependencies: PixelEditorRouteDependencies,
	access: Ready,
	loaded: LoadedDraft,
	structure: SheetStructure,
	rendered: ReturnType<typeof renderFrames>
): Promise<PinnedFrames | null> {
	const pinned: PinnedFrames = {
		committed: new Map(),
		createdUnitVersionIds: [],
		reusedUnitVersionIds: [],
	};
	for (const frame of structure.frames) {
		const entry = rendered.get(frame.key);
		if (!entry) {
			continue;
		}
		if (frameStatus(frame, entry.fingerprint) === "pinned" && frame.committed) {
			pinned.committed.set(frame.key, {
				...frame.committed,
				fingerprint: entry.fingerprint,
			});
			pinned.reusedUnitVersionIds.push(frame.committed.unitVersionId);
			continue;
		}
		// biome-ignore lint/performance/noAwaitInLoops: units are stored one at a time so a failure leaves a retryable prefix
		const stored = await storeFrameUnit(
			dependencies,
			access,
			loaded,
			frame,
			entry.fingerprint,
			await encodeRasterPng(entry.raster)
		);
		if (!stored) {
			return null;
		}
		pinned.committed.set(frame.key, {
			...stored,
			fingerprint: entry.fingerprint,
		});
		pinned.createdUnitVersionIds.push(stored.unitVersionId);
	}
	return pinned;
}

async function commitStructure(
	c: Context,
	dependencies: PixelEditorRouteDependencies
) {
	const access = await requireAccess(c, dependencies);
	if (access instanceof Response) {
		return access;
	}
	const input = frameStructureCommitInputSchema.safeParse(await readJson(c));
	if (!input.success) {
		return fail(c, "Invalid Working Draft request", 400);
	}
	const state = await loadStructure(c, access, dependencies);
	if (state instanceof Response) {
		return state;
	}
	const { loaded, structure } = state;
	if (loaded.draft.status !== "open") {
		return fail(c, "Working Draft is not open", 409);
	}
	if (loaded.draft.revision !== input.data.expectedRevision) {
		return fail(c, "Working Draft revision conflict", 409);
	}
	let rendered: ReturnType<typeof renderFrames>;
	try {
		rendered = renderFrames(
			structure,
			computeCells(structure.slicing, loaded.applied),
			state.context
		);
	} catch (error) {
		return (
			structureFailure(c, error) ?? fail(c, "Invalid frame operation", 422)
		);
	}
	const affected = structure.frames.filter((frame) => {
		const entry = rendered.get(frame.key);
		return frameStatus(frame, entry?.fingerprint ?? "") !== "pinned";
	});
	if (
		affected.length === 0 &&
		structure.lastCommit &&
		!orderChanged(structure)
	) {
		return fail(c, "Frame structure has no changes", 400);
	}

	let pinned: Awaited<ReturnType<typeof pinFrames>>;
	try {
		pinned = await pinFrames(dependencies, access, loaded, structure, rendered);
	} catch {
		return fail(c, "Frame structure commit failed", 503);
	}
	if (!pinned) {
		return fail(c, "Frame structure commit failed", 409);
	}
	const { committed, createdUnitVersionIds, reusedUnitVersionIds } = pinned;
	try {
		const unitVersionIds = structure.frames.map(
			(frame) => committed.get(frame.key)?.unitVersionId ?? ""
		);
		const composite =
			await dependencies.assetVersionStore.createCompositeVersion(
				access.userId,
				{
					projectId: access.projectId,
					assetRecordId: loaded.draft.assetRecordId,
					unitVersionIds,
					idempotencyKey: `pixel-editor-structure:${loaded.draft.id}:${digest(unitVersionIds).slice(0, 32)}`,
				}
			);
		if (!composite) {
			return fail(c, "Not found", 404);
		}
		if (composite.kind !== "created" && composite.kind !== "existing") {
			return fail(c, "Frame structure commit failed", 409);
		}
		const next: SheetStructure = {
			...structure,
			frames: structure.frames.map((frame) => ({
				...frame,
				committed: committed.get(frame.key) ?? frame.committed,
			})),
			lastCommit: {
				compositeVersionId: composite.compositeVersion.id,
				frameKeys: structure.frames.map((frame) => frame.key),
				unitVersionIds,
			},
		};
		const result = await dependencies.pixelEditorStore.updateStructure(
			access.userId,
			access.projectId,
			loaded.draft.id,
			{
				expectedRevision: input.data.expectedRevision,
				structure: sheetStructureSchema.parse(next),
			}
		);
		const failure = mapUpdateFailure(c, result);
		if (failure) {
			return failure;
		}
		const reread = await loadStructure(c, access, dependencies);
		if (reread instanceof Response) {
			return reread;
		}
		return noStoreJson(
			c,
			frameStructureCommitResponseSchema.parse({
				structure: buildView(reread),
				compositeVersionId: composite.compositeVersion.id,
				createdUnitVersionIds,
				reusedUnitVersionIds,
				created: composite.kind === "created",
			}),
			composite.kind === "created" ? 201 : 200
		);
	} catch {
		return fail(c, "Frame structure commit failed", 503);
	}
}

export function mountPixelEditorStructureRoutes(
	app: Hono,
	dependencies: PixelEditorRouteDependencies,
	base: string
) {
	app.post(`${base}/:draftId/slicing-preview`, (c) =>
		previewSlicing(c, dependencies)
	);
	app.post(`${base}/:draftId/structure/slicing`, (c) =>
		applySlicing(c, dependencies)
	);
	app.get(`${base}/:draftId/structure`, async (c) => {
		const access = await requireAccess(c, dependencies);
		if (access instanceof Response) {
			return access;
		}
		return structureResponse(c, access, dependencies);
	});
	app.post(`${base}/:draftId/structure/operations`, (c) =>
		applyFrameEdit(c, dependencies)
	);
	app.post(`${base}/:draftId/structure/commit`, (c) =>
		commitStructure(c, dependencies)
	);
	app.get(`${base}/:draftId/structure/frames/:frameKey/preview`, async (c) => {
		const access = await requireAccess(c, dependencies);
		if (access instanceof Response) {
			return access;
		}
		const frameKey = frameKeySchema.safeParse(c.req.param("frameKey"));
		if (!frameKey.success) {
			return fail(c, "Not found", 404);
		}
		const state = await loadStructure(c, access, dependencies);
		if (state instanceof Response) {
			return state;
		}
		try {
			const cells = computeCells(state.structure.slicing, state.loaded.applied);
			const entry = renderFrames(state.structure, cells, state.context).get(
				frameKey.data
			);
			if (!entry) {
				return fail(c, "Not found", 404);
			}
			return c.body(await encodeRasterPng(entry.raster), 200, {
				"Cache-Control": "private, no-store",
				"Content-Type": "image/png",
				"X-Content-Type-Options": "nosniff",
			});
		} catch (error) {
			return (
				structureFailure(c, error) ?? fail(c, "Invalid frame operation", 422)
			);
		}
	});
}
