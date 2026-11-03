import { createHash } from "node:crypto";
import type { PixelOperation } from "@sprite-anvil/api/pixel-editor";
import {
	type FrameOperation,
	type FrameStructureCommitResponse,
	frameKeySchema,
	frameOperationInputSchema,
	frameStructureCommitInputSchema,
	frameStructureCommitResponseSchema,
	type SheetSlicingPreview,
	type SheetStructure,
	type SheetStructureView,
	sheetSlicingApplyInputSchema,
	sheetSlicingPreviewInputSchema,
	sheetSlicingPreviewSchema,
	sheetStructureViewSchema,
} from "@sprite-anvil/api/pixel-editor-structure";
import { storePngCandidate } from "./candidate-store";
import {
	type DraftContext,
	failure,
	loadDraft,
	type Outcome,
	readSourceRaster,
	type Scope,
	structureFailure,
	success,
	updateFailure,
} from "./pixel-editor-context";
import type { Raster } from "./pixel-operations";
import { encodeRasterPng } from "./pixel-raster-codec";
import {
	applyFrameOperation,
	assertProtectedFramesUnchanged,
	assertSheetEditKeepsProtectedFrames,
	computeCells,
	createStructure,
	frameStatus,
	geometryChangeOf,
	orderChanged,
	parseStructure,
	type RenderContext,
	remapStructure,
	renderFrames,
	resliceStructure,
} from "./sheet-structure";

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

/** Reads other Asset Versions of this project as rasters; names the first one that is missing or unreadable. */
export async function readSources(
	{ access, dependencies }: Scope,
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

/** Rasters that the frames of a structure draw from, beside the sheet itself. */
export async function loadRenderContext(
	context: DraftContext,
	structure: SheetStructure
): Promise<Outcome<RenderContext>> {
	const read = await readSources(context, assetVersionIdsOf(structure));
	if ("missing" in read) {
		return failure("Source Asset Version image unavailable", 502);
	}
	return success({ sheet: context.applied, sources: read.sources });
}

/**
 * The frame structure that goes with a sheet edit, or null when the draft has
 * none. Edits that keep the sheet geometry only need the kept cells untouched.
 * Crop, canvas resize and scale move the grid, so the structure is remapped by
 * the same integer translation or factor ("inverse" for undo) and must then
 * prove that every kept frame renders exactly as before; anything else is
 * rejected with a descriptive error.
 */
export async function structureForSheetEdit(
	context: DraftContext,
	operation: PixelOperation,
	rasters: { after: Raster; before: Raster },
	direction: "forward" | "inverse"
): Promise<Outcome<SheetStructure | null>> {
	const { structure } = context.draft;
	if (!structure) {
		return success(null);
	}
	try {
		// Undo maps the current sheet back, so `before` is the one the edit started from.
		const change = geometryChangeOf(operation, rasters.before);
		const current = direction === "forward" ? rasters.before : rasters.after;
		const target = direction === "forward" ? rasters.after : rasters.before;
		if (!change) {
			assertSheetEditKeepsProtectedFrames(structure, current, target);
			return success(structure);
		}
		const next = remapStructure(structure, change, direction);
		const rendering = await loadRenderContext(context, structure);
		if (!rendering.ok) {
			return rendering;
		}
		const { sources } = rendering.value;
		assertProtectedFramesUnchanged(
			structure,
			next,
			{
				before: computeCells(structure.slicing, current),
				after: computeCells(next.slicing, target),
			},
			{
				before: { sheet: current, sources },
				after: { sheet: target, sources },
			}
		);
		renderFrames(next, computeCells(next.slicing, target), {
			sheet: target,
			sources,
		});
		return success(parseStructure(next));
	} catch (error) {
		const mapped = structureFailure(error, "Invalid pixel operation");
		if (mapped) {
			return mapped;
		}
		throw error;
	}
}

function structurePath(projectId: string, draftId: string) {
	return `/api/projects/${encodeURIComponent(projectId)}/pixel-editor/drafts/${draftId}/structure`;
}

/** A Working Draft that has a frame structure, with every raster its frames need. */
interface StructureState {
	context: RenderContext;
	loaded: DraftContext;
	structure: SheetStructure;
}

async function loadStructure(
	scope: Scope,
	draftId: string
): Promise<Outcome<StructureState>> {
	const loaded = await loadDraft(scope, draftId);
	if (!loaded.ok) {
		return loaded;
	}
	const { structure } = loaded.value.draft;
	if (!structure) {
		return failure("Working Draft has no frame structure", 409);
	}
	const context = await loadRenderContext(loaded.value, structure);
	if (!context.ok) {
		return context;
	}
	return success({ loaded: loaded.value, structure, context: context.value });
}

function buildStructureView({
	context,
	loaded,
	structure,
}: StructureState): SheetStructureView {
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
			issue: frame.issue,
			editCount: frame.edits.length,
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

export async function readStructureView(
	scope: Scope,
	draftId: string,
	status: 200 | 201 = 200
): Promise<Outcome<SheetStructureView>> {
	const state = await loadStructure(scope, draftId);
	if (!state.ok) {
		return state;
	}
	try {
		return success(buildStructureView(state.value), status);
	} catch (error) {
		return (
			structureFailure(error) ??
			failure("Invalid frame operation", 422, "The frame structure is stale")
		);
	}
}

export async function previewSlicing(
	scope: Scope,
	draftId: string,
	body: unknown
): Promise<Outcome<SheetSlicingPreview>> {
	const input = sheetSlicingPreviewInputSchema.safeParse(body);
	if (!input.success) {
		return failure("Invalid slicing parameters", 400);
	}
	const loaded = await loadDraft(scope, draftId);
	if (!loaded.ok) {
		return loaded;
	}
	const { applied } = loaded.value;
	try {
		const cells = computeCells(input.data.slicing, applied);
		return success(
			sheetSlicingPreviewSchema.parse({
				cells,
				frameCount: cells.length,
				sheetSize: { width: applied.width, height: applied.height },
			})
		);
	} catch (error) {
		return (
			structureFailure(error) ?? failure("Invalid slicing parameters", 422)
		);
	}
}

export async function applySlicing(
	scope: Scope,
	draftId: string,
	body: unknown
): Promise<Outcome<SheetStructureView>> {
	const { access, dependencies } = scope;
	const input = sheetSlicingApplyInputSchema.safeParse(body);
	if (!input.success) {
		return failure("Invalid slicing parameters", 400);
	}
	const loaded = await loadDraft(scope, draftId);
	if (!loaded.ok) {
		return loaded;
	}
	const context = loaded.value;
	if (context.draft.status !== "open") {
		return failure("Working Draft is not open", 409);
	}
	try {
		let next: SheetStructure;
		const before = context.draft.structure;
		if (before) {
			next = resliceStructure(before, input.data.slicing, context.applied);
			const rendering = await loadRenderContext(context, next);
			if (!rendering.ok) {
				return rendering;
			}
			assertProtectedFramesUnchanged(
				before,
				next,
				{
					before: computeCells(before.slicing, context.applied),
					after: computeCells(next.slicing, context.applied),
				},
				{ before: rendering.value, after: rendering.value }
			);
		} else {
			next = createStructure(input.data.slicing, context.applied);
		}
		const result = await dependencies.pixelEditorStore.updateStructure(
			access.userId,
			access.projectId,
			context.draft.id,
			{
				expectedRevision: input.data.expectedRevision,
				structure: parseStructure(next),
			}
		);
		return updateFailure(result) ?? readStructureView(scope, draftId);
	} catch (error) {
		const mapped = structureFailure(error);
		if (mapped) {
			return mapped;
		}
		throw error;
	}
}

export async function applyFrameEdit(
	scope: Scope,
	draftId: string,
	body: unknown
): Promise<Outcome<SheetStructureView>> {
	const { access, dependencies } = scope;
	const input = frameOperationInputSchema.safeParse(body);
	if (!input.success) {
		return failure("Invalid frame operation", 400);
	}
	const state = await loadStructure(scope, draftId);
	if (!state.ok) {
		return state;
	}
	const { context, loaded, structure } = state.value;
	if (loaded.draft.status !== "open") {
		return failure("Working Draft is not open", 409);
	}
	const operation: FrameOperation = input.data.operation;
	const sources = new Map(context.sources);
	if (
		operation.type === "add-from-asset-version" ||
		operation.type === "replace"
	) {
		const read = await readSources(scope, [operation.assetVersionId]);
		if ("missing" in read) {
			return failure("Not found", 404);
		}
		for (const [id, raster] of read.sources) {
			sources.set(id, raster);
		}
	}
	try {
		const next = applyFrameOperation(structure, operation, sources);
		const cells = computeCells(next.slicing, loaded.applied);
		const rendering = { sheet: loaded.applied, sources };
		assertProtectedFramesUnchanged(
			structure,
			next,
			{ before: cells, after: cells },
			{ before: rendering, after: rendering }
		);
		renderFrames(next, cells, rendering);
		const result = await dependencies.pixelEditorStore.updateStructure(
			access.userId,
			access.projectId,
			loaded.draft.id,
			{
				expectedRevision: input.data.expectedRevision,
				structure: parseStructure(next),
			}
		);
		return updateFailure(result) ?? readStructureView(scope, draftId);
	} catch (error) {
		const mapped = structureFailure(error);
		if (mapped) {
			return mapped;
		}
		throw error;
	}
}

export async function previewFrame(
	scope: Scope,
	draftId: string,
	frameKeyInput: string
): Promise<Outcome<Uint8Array<ArrayBuffer>>> {
	const frameKey = frameKeySchema.safeParse(frameKeyInput);
	if (!frameKey.success) {
		return failure("Not found", 404);
	}
	const state = await loadStructure(scope, draftId);
	if (!state.ok) {
		return state;
	}
	const { context, loaded, structure } = state.value;
	try {
		const cells = computeCells(structure.slicing, loaded.applied);
		const entry = renderFrames(structure, cells, context).get(frameKey.data);
		if (!entry) {
			return failure("Not found", 404);
		}
		return success(await encodeRasterPng(entry.raster));
	} catch (error) {
		return structureFailure(error) ?? failure("Invalid frame operation", 422);
	}
}

type CommittedFrames = Map<
	string,
	{ assetVersionId: string; fingerprint: string; unitVersionId: string }
>;

interface PinnedFrames {
	committed: CommittedFrames;
	createdUnitVersionIds: string[];
	reusedUnitVersionIds: string[];
}

/**
 * Reuses the Unit Version of every unchanged frame and builds one Candidate
 * Version for each affected frame (ADR 0006: affected units are versioned
 * individually; the single Composite Version that pins them all is created by
 * the caller). Units are stored one at a time. A failure fails closed and
 * leaves only complete units; each unit's idempotency key holds draft, frame
 * and fingerprint, so the retry adopts the units an earlier attempt created
 * instead of building them again.
 */
async function pinFrames(
	loaded: DraftContext,
	structure: SheetStructure,
	rendered: ReturnType<typeof renderFrames>
): Promise<Outcome<PinnedFrames>> {
	const { draft, sourceFile } = loaded;
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
		const stored = await storePngCandidate(loaded, {
			assetFamilyId: draft.assetFamilyId,
			assetRecordId: draft.assetRecordId,
			baseFileName: sourceFile.fileName ?? null,
			fallbackName: "sheet",
			suffix: `-${frame.key}`,
			idempotencyKey: `pixel-editor-frame:${draft.id}:${frame.key}:${entry.fingerprint.slice(0, 32)}`,
			png: await encodeRasterPng(entry.raster),
			unitCorrection: {
				sourceAssetVersionId:
					frame.committed?.assetVersionId ?? draft.sourceAssetVersionId,
				unitType: "frame",
				unitKey: frame.key,
			},
		});
		if (!stored.ok) {
			return failure(
				"Frame structure commit failed",
				stored.status === 404 ? 409 : stored.status
			);
		}
		if (!stored.unitVersionId) {
			return failure("Frame structure commit failed", 409);
		}
		pinned.committed.set(frame.key, {
			assetVersionId: stored.assetVersionId,
			unitVersionId: stored.unitVersionId,
			fingerprint: entry.fingerprint,
		});
		pinned.createdUnitVersionIds.push(stored.unitVersionId);
	}
	return success(pinned);
}

export async function commitStructure(
	scope: Scope,
	draftId: string,
	body: unknown
): Promise<Outcome<FrameStructureCommitResponse>> {
	const { access, dependencies } = scope;
	const input = frameStructureCommitInputSchema.safeParse(body);
	if (!input.success) {
		return failure("Invalid Working Draft request", 400);
	}
	const state = await loadStructure(scope, draftId);
	if (!state.ok) {
		return state;
	}
	const { context, loaded, structure } = state.value;
	if (loaded.draft.status !== "open") {
		return failure("Working Draft is not open", 409);
	}
	if (loaded.draft.revision !== input.data.expectedRevision) {
		return failure("Working Draft revision conflict", 409);
	}
	let rendered: ReturnType<typeof renderFrames>;
	try {
		rendered = renderFrames(
			structure,
			computeCells(structure.slicing, loaded.applied),
			context
		);
	} catch (error) {
		return structureFailure(error) ?? failure("Invalid frame operation", 422);
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
		return failure("Frame structure has no changes", 400);
	}

	const pinResult = await pinFrames(loaded, structure, rendered);
	if (!pinResult.ok) {
		return pinResult;
	}
	const { committed, createdUnitVersionIds, reusedUnitVersionIds } =
		pinResult.value;
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
			return failure("Not found", 404);
		}
		if (composite.kind !== "created" && composite.kind !== "existing") {
			return failure("Frame structure commit failed", 409);
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
				structure: parseStructure(next),
			}
		);
		const updateError = updateFailure(result);
		if (updateError) {
			return updateError;
		}
		const view = await readStructureView(scope, draftId);
		if (!view.ok) {
			return view;
		}
		return success(
			frameStructureCommitResponseSchema.parse({
				structure: view.value,
				compositeVersionId: composite.compositeVersion.id,
				createdUnitVersionIds,
				reusedUnitVersionIds,
				created: composite.kind === "created",
			}),
			composite.kind === "created" ? 201 : 200
		);
	} catch {
		return failure("Frame structure commit failed", 503);
	}
}
