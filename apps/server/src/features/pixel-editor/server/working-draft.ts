import {
	type PixelColorReplacePreview,
	type PixelDraft,
	type PixelDraftCommitResponse,
	type PixelDraftRecord,
	type PixelOperation,
	pixelColorReplacePreviewInputSchema,
	pixelColorReplacePreviewSchema,
	pixelDraftCommitInputSchema,
	pixelDraftCommitResponseSchema,
	pixelDraftHistoryInputSchema,
	pixelDraftOpenInputSchema,
	pixelDraftSchema,
	pixelEditorMaxOperations,
	pixelOperationSchema,
} from "@sprite-anvil/api/pixel-editor";
import z from "zod";
import { storePngCandidate } from "./candidate-store";
import { structureForSheetEdit } from "./frame-structure";
import {
	type DraftContext,
	draftIdSchema,
	failure,
	loadDraft,
	newId,
	type Outcome,
	readSourceRaster,
	type Scope,
	success,
	updateFailure,
} from "./pixel-editor-context";
import type { Raster } from "./pixel-operations";
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

export function buildDraftView({
	applied,
	draft,
	source,
}: Pick<DraftContext, "applied" | "draft" | "source">): PixelDraft {
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

/** Loads a draft and returns its view. */
export async function readDraftView(
	scope: Scope,
	draftId: string,
	status: 200 | 201 = 200
): Promise<Outcome<PixelDraft>> {
	const loaded = await loadDraft(scope, draftId);
	if (!loaded.ok) {
		return loaded;
	}
	return success(buildDraftView(loaded.value), status);
}

export async function readDraftPreview(
	scope: Scope,
	draftId: string
): Promise<Outcome<Uint8Array<ArrayBuffer>>> {
	const loaded = await loadDraft(scope, draftId);
	if (!loaded.ok) {
		return loaded;
	}
	return success(await encodeRasterPng(loaded.value.applied));
}

export async function openDraft(
	scope: Scope,
	body: unknown
): Promise<Outcome<PixelDraft>> {
	const { access, dependencies } = scope;
	const input = pixelDraftOpenInputSchema.safeParse(body);
	if (!input.success) {
		return failure("Invalid Working Draft request", 400);
	}
	const sourceFile = await dependencies.assetVersionStore.getFileRecord(
		access.userId,
		access.projectId,
		input.data.sourceAssetVersionId
	);
	if (!sourceFile || sourceFile.projectId !== access.projectId) {
		return failure("Not found", 404);
	}
	const source = await readSourceRaster(dependencies, sourceFile);
	if (!source) {
		return failure("Source Asset Version image unavailable", 502);
	}
	const result = await dependencies.pixelEditorStore.createDraft(
		access.userId,
		{
			id: newId(dependencies),
			projectId: access.projectId,
			assetFamilyId: sourceFile.assetFamilyId,
			assetRecordId: sourceFile.assetRecordId,
			sourceAssetVersionId: sourceFile.id,
		}
	);
	if (!result) {
		return failure("Not found", 404);
	}
	return readDraftView(
		scope,
		result.draft.id,
		result.kind === "created" ? 201 : 200
	);
}

export async function applyDraftOperation(
	scope: Scope,
	draftId: string,
	body: unknown
): Promise<Outcome<PixelDraft>> {
	const { access, dependencies } = scope;
	const input = body as {
		expectedRevision?: unknown;
		operation?: unknown;
	} | null;
	const revision = expectedRevisionSchema.safeParse(input?.expectedRevision);
	if (!revision.success) {
		return failure("Invalid Working Draft request", 400);
	}
	const operation = pixelOperationSchema.safeParse(input?.operation);
	if (!operation.success) {
		return failure("Invalid pixel operation", 400);
	}
	const loaded = await loadDraft(scope, draftId);
	if (!loaded.ok) {
		return loaded;
	}
	const context = loaded.value;
	const { draft } = context;
	if (draft.status !== "open") {
		return failure("Working Draft is not open", 409);
	}
	if (draft.appliedOperationCount >= pixelEditorMaxOperations) {
		return failure(
			"Invalid pixel operation",
			422,
			"Working Draft reached the operation limit; commit before editing further"
		);
	}
	let nextRaster: Raster;
	try {
		nextRaster = applyOperationToState(
			{ raster: context.applied, clipboard: context.clipboard },
			operation.data
		).raster;
	} catch (error) {
		if (error instanceof PixelOperationError) {
			return failure("Invalid pixel operation", 422, error.message);
		}
		throw error;
	}
	const structure = await structureForSheetEdit(
		context,
		operation.data,
		{ before: context.applied, after: nextRaster },
		"forward"
	);
	if (!structure.ok) {
		return structure;
	}
	const operations: PixelOperation[] = [
		...draft.operations.slice(0, draft.appliedOperationCount),
		operation.data,
	];
	const result = await dependencies.pixelEditorStore.updateOperations(
		access.userId,
		access.projectId,
		draft.id,
		{
			expectedRevision: revision.data,
			operations,
			appliedOperationCount: operations.length,
			...(structure.value ? { structure: structure.value } : {}),
		}
	);
	return updateFailure(result) ?? readDraftView(scope, draft.id);
}

export async function moveHistory(
	scope: Scope,
	draftId: string,
	body: unknown,
	direction: "undo" | "redo"
): Promise<Outcome<PixelDraft>> {
	const { access, dependencies } = scope;
	const input = pixelDraftHistoryInputSchema.safeParse(body);
	if (!input.success) {
		return failure("Invalid Working Draft request", 400);
	}
	const loaded = await loadDraft(scope, draftId);
	if (!loaded.ok) {
		return loaded;
	}
	const context = loaded.value;
	const { draft } = context;
	if (draft.status !== "open") {
		return failure("Working Draft is not open", 409);
	}
	if (direction === "undo" && draft.appliedOperationCount === 0) {
		return failure("Nothing to undo", 409);
	}
	if (
		direction === "redo" &&
		draft.appliedOperationCount >= draft.operations.length
	) {
		return failure("Nothing to redo", 409);
	}
	const appliedOperationCount =
		draft.appliedOperationCount + (direction === "undo" ? -1 : 1);
	const target = applyOperations(
		context.source,
		draft.operations.slice(0, appliedOperationCount)
	);
	// The edit that moves: the last applied one for undo, the next one for redo.
	const moved =
		draft.operations[
			direction === "undo" ? appliedOperationCount : draft.appliedOperationCount
		];
	const structure = moved
		? await structureForSheetEdit(
				context,
				moved,
				{
					before: direction === "undo" ? target : context.applied,
					after: direction === "undo" ? context.applied : target,
				},
				direction === "undo" ? "inverse" : "forward"
			)
		: success(null);
	if (!structure.ok) {
		return structure;
	}
	const result = await dependencies.pixelEditorStore.updateOperations(
		access.userId,
		access.projectId,
		draft.id,
		{
			expectedRevision: input.data.expectedRevision,
			operations: draft.operations,
			appliedOperationCount,
			...(structure.value ? { structure: structure.value } : {}),
		}
	);
	return updateFailure(result) ?? readDraftView(scope, draft.id);
}

export async function commitDraft(
	scope: Scope,
	draftId: string,
	body: unknown
): Promise<Outcome<PixelDraftCommitResponse>> {
	const { access, dependencies } = scope;
	const input = pixelDraftCommitInputSchema.safeParse(body);
	if (!input.success) {
		return failure("Invalid Working Draft request", 400);
	}
	const loaded = await loadDraft(scope, draftId);
	if (!loaded.ok) {
		return loaded;
	}
	const context = loaded.value;
	const { draft, applied } = context;
	if (draft.status === "committed" && draft.committedAssetVersionId) {
		return success(
			pixelDraftCommitResponseSchema.parse({
				draft: buildDraftView(context),
				assetVersionId: draft.committedAssetVersionId,
				created: false,
			})
		);
	}
	if (draft.status !== "open") {
		return failure("Working Draft is not open", 409);
	}
	if (draft.revision !== input.data.expectedRevision) {
		return failure("Working Draft revision conflict", 409);
	}
	if (draft.appliedOperationCount === 0) {
		return failure("Working Draft has no changes", 400);
	}

	const stored = await storePngCandidate(scope, {
		assetFamilyId: draft.assetFamilyId,
		assetRecordId: draft.assetRecordId,
		baseFileName: context.sourceFile.fileName ?? null,
		fallbackName: "pixel-edit",
		idempotencyKey: `pixel-editor-draft:${draft.id}`,
		png: await encodeRasterPng(applied),
		suffix: context.sourceFile.fileName ? "-pixel-edit" : "",
	});
	if (!stored.ok) {
		return failure(stored.error, stored.status);
	}
	const marked = await dependencies.pixelEditorStore.markCommitted(
		access.userId,
		access.projectId,
		draft.id,
		stored.assetVersionId
	);
	if (!marked) {
		return failure("Not found", 404);
	}
	// A concurrent commit may have won; the stored link is authoritative.
	const reread = await loadDraft(scope, draft.id);
	if (!reread.ok) {
		return reread;
	}
	return success(
		pixelDraftCommitResponseSchema.parse({
			draft: buildDraftView(reread.value),
			assetVersionId:
				reread.value.draft.committedAssetVersionId ?? stored.assetVersionId,
			created: stored.created,
		}),
		stored.created ? 201 : 200
	);
}

export async function previewColorReplace(
	scope: Scope,
	draftId: string,
	body: unknown
): Promise<Outcome<PixelColorReplacePreview>> {
	const input = pixelColorReplacePreviewInputSchema.safeParse(body);
	if (!input.success) {
		return failure("Invalid Working Draft request", 400);
	}
	const loaded = await loadDraft(scope, draftId);
	if (!loaded.ok) {
		return loaded;
	}
	const { applied, source } = loaded.value;
	const palette = new Set(countColors(source).keys());
	const [r, g, b, a] = parseColor(input.data.to);
	const target = colorToHex(r, g, b, a);
	return success(
		pixelColorReplacePreviewSchema.parse({
			from: input.data.from,
			to: input.data.to,
			affectedPixelCount: countColor(applied, input.data.from),
			resultIsInPalette: a === 0 || palette.has(target),
		})
	);
}

export async function discardDraft(
	scope: Scope,
	draftId: string
): Promise<Outcome<PixelDraft>> {
	const { access, dependencies } = scope;
	const id = draftIdSchema.safeParse(draftId);
	if (!id.success) {
		return failure("Not found", 404);
	}
	const result = await dependencies.pixelEditorStore.discardDraft(
		access.userId,
		access.projectId,
		id.data
	);
	return updateFailure(result) ?? readDraftView(scope, id.data);
}
