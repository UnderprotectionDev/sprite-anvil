import { createHash } from "node:crypto";
import {
	checkOfflineConflictContractVersion,
	type OfflineConflictContent,
	type OfflineConflictEntry,
	type OfflineConflictList,
	type OfflineConflictResolutionRow,
	type OfflineConflictResolveResponse,
	type OfflineConflictView,
	type OfflineReconcileResponse,
	offlineConflictContractVersion,
	offlineConflictListSchema,
	offlineConflictResolveInputSchema,
	offlineConflictResolveResponseSchema,
	offlineConflictSides,
	offlineConflictViewSchema,
	offlineReconcileInputSchema,
	offlineReconcileResponseSchema,
	parseOfflineConflictContent,
} from "@sprite-anvil/api/offline-conflict";
import type { PixelOperation } from "@sprite-anvil/api/pixel-editor";
import { storePngCandidate } from "./candidate-store";
import {
	draftIdSchema,
	type Failure,
	failure,
	newId,
	type Outcome,
	readSourceRaster,
	type Scope,
	success,
} from "./pixel-editor-context";
import {
	PixelOperationError,
	type Raster,
	replayOperations,
} from "./pixel-operations";
import { encodeRasterPng } from "./pixel-raster-codec";

/**
 * Reconnect check and resolution of Offline Conflict Records. The cloud draft
 * is only ever read here: a record or its resolution never edits the cloud
 * draft, the base Asset Version or the stored record content.
 */

function appliedOperations(content: {
	appliedOperationCount: number;
	operations: PixelOperation[];
}) {
	return content.operations.slice(0, content.appliedOperationCount);
}

function localDigest(local: {
	appliedOperationCount: number;
	operations: PixelOperation[];
}) {
	return createHash("sha256")
		.update(
			JSON.stringify({
				operations: local.operations,
				appliedOperationCount: local.appliedOperationCount,
			})
		)
		.digest("hex");
}

function unsupported(message: string): Failure {
	return failure("Offline Conflict Record contract unsupported", 422, message);
}

interface ReadableEntry {
	content: OfflineConflictContent;
	entry: OfflineConflictEntry;
}

function readEntry(entry: OfflineConflictEntry): Outcome<ReadableEntry> {
	const parsed = parseOfflineConflictContent(entry.record.content);
	if (!parsed.ok) {
		return parsed.reason === "unsupported"
			? unsupported(parsed.message)
			: failure("Invalid Offline Conflict request", 422, parsed.message);
	}
	return success({ content: parsed.content, entry });
}

function resolutionView(resolution: OfflineConflictResolutionRow) {
	return {
		id: resolution.id,
		choice: resolution.choice,
		resolvedAt: resolution.resolvedAt.toISOString(),
		resolvedByUserId: resolution.resolvedByUserId,
		resultAssetVersionId: resolution.resultAssetVersionId,
		idempotencyKey: resolution.idempotencyKey,
	};
}

function buildView({ content, entry }: ReadableEntry): OfflineConflictView {
	const { record, resolution } = entry;
	return offlineConflictViewSchema.parse({
		id: record.id,
		projectId: record.projectId,
		draftId: record.draftId,
		contractVersion: content.contractVersion,
		createdAt: record.createdAt.toISOString(),
		base: content.base,
		cloud: content.cloud,
		local: content.local,
		localDigest: record.localDigest,
		resolution: resolution ? resolutionView(resolution) : null,
	});
}

/** Reconnect check: finalize normally while the base is current, else open a record. */
export async function reconcileStagedDraft(
	scope: Scope,
	body: unknown
): Promise<Outcome<OfflineReconcileResponse>> {
	const { access, dependencies } = scope;
	const declared =
		typeof body === "object" && body !== null
			? (body as { contractVersion?: unknown }).contractVersion
			: undefined;
	const version = checkOfflineConflictContractVersion(declared);
	if (!version.ok) {
		return version.reason === "unsupported"
			? unsupported(version.message)
			: failure("Invalid Offline Conflict request", 400, version.message);
	}
	const input = offlineReconcileInputSchema.safeParse(body);
	if (!input.success) {
		return failure("Invalid Offline Conflict request", 400);
	}
	const { base, draftId, local } = input.data;
	const cloud = await dependencies.pixelEditorStore.getDraft(
		access.userId,
		access.projectId,
		draftId
	);
	if (!cloud) {
		return failure("Not found", 404);
	}
	const baseCurrent =
		cloud.revision === base.revision &&
		cloud.sourceAssetVersionId === base.sourceAssetVersionId;
	// An unchanged cloud draft that differs from the local one must not be finalized
	// over the local work either: that would silently discard it.
	const localMatchesCloud =
		JSON.stringify(appliedOperations(local)) ===
		JSON.stringify(appliedOperations(cloud));
	if (baseCurrent && localMatchesCloud) {
		return success(
			offlineReconcileResponseSchema.parse({
				outcome: "base-current",
				draft: {
					id: cloud.id,
					revision: cloud.revision,
					sourceAssetVersionId: cloud.sourceAssetVersionId,
				},
			}) as OfflineReconcileResponse
		);
	}
	const content = {
		contractVersion: offlineConflictContractVersion,
		requires: [],
		base: {
			revision: base.revision,
			sourceAssetVersionId: base.sourceAssetVersionId,
		},
		cloud: {
			revision: cloud.revision,
			status: cloud.status,
			sourceAssetVersionId: cloud.sourceAssetVersionId,
			committedAssetVersionId: cloud.committedAssetVersionId,
			operations: cloud.operations,
			appliedOperationCount: cloud.appliedOperationCount,
		},
		local: {
			operations: local.operations,
			appliedOperationCount: local.appliedOperationCount,
		},
	};
	const stored = await dependencies.offlineConflictStore.createRecord(
		access.userId,
		{
			id: newId(dependencies),
			projectId: access.projectId,
			draftId,
			contractVersion: offlineConflictContractVersion,
			baseRevision: base.revision,
			cloudRevision: cloud.revision,
			localDigest: localDigest(local),
			content,
		}
	);
	const readable = readEntry(stored.entry);
	if (!readable.ok) {
		return readable;
	}
	return success(
		offlineReconcileResponseSchema.parse({
			outcome: "conflict",
			conflict: buildView(readable.value),
		}) as OfflineReconcileResponse,
		stored.kind === "created" ? 201 : 200
	);
}

async function loadEntry(
	scope: Scope,
	conflictId: string
): Promise<Outcome<ReadableEntry>> {
	const { access, dependencies } = scope;
	const id = draftIdSchema.safeParse(conflictId);
	if (!id.success) {
		return failure("Not found", 404);
	}
	const entry = await dependencies.offlineConflictStore.getEntry(
		access.userId,
		access.projectId,
		id.data
	);
	return entry ? readEntry(entry) : failure("Not found", 404);
}

export async function readOfflineConflict(
	scope: Scope,
	conflictId: string
): Promise<Outcome<OfflineConflictView>> {
	const loaded = await loadEntry(scope, conflictId);
	return loaded.ok ? success(buildView(loaded.value)) : loaded;
}

export async function listOfflineConflicts(
	scope: Scope
): Promise<Outcome<OfflineConflictList>> {
	const { access, dependencies } = scope;
	const entries = await dependencies.offlineConflictStore.listEntries(
		access.userId,
		access.projectId
	);
	const conflicts: OfflineConflictView[] = [];
	const unreadable: OfflineConflictList["unreadable"] = [];
	for (const entry of entries) {
		const readable = readEntry(entry);
		if (readable.ok) {
			conflicts.push(buildView(readable.value));
		} else {
			unreadable.push({
				id: entry.record.id,
				contractVersion: entry.record.contractVersion,
				message: readable.detail ?? readable.error,
			});
		}
	}
	return success(offlineConflictListSchema.parse({ conflicts, unreadable }));
}

async function renderVersion(
	scope: Scope,
	sourceAssetVersionId: string,
	operations: PixelOperation[]
): Promise<
	Outcome<{
		png: Uint8Array<ArrayBuffer>;
		sourceFile: NonNullable<
			Awaited<
				ReturnType<Scope["dependencies"]["assetVersionStore"]["getFileRecord"]>
			>
		>;
	}>
> {
	const { access, dependencies } = scope;
	const sourceFile = await dependencies.assetVersionStore.getFileRecord(
		access.userId,
		access.projectId,
		sourceAssetVersionId
	);
	const source: Raster | null = sourceFile
		? await readSourceRaster(dependencies, sourceFile)
		: null;
	if (!(sourceFile && source)) {
		return failure("Source Asset Version image unavailable", 502);
	}
	try {
		const { raster } = replayOperations(source, operations);
		return success({ png: await encodeRasterPng(raster), sourceFile });
	} catch (error) {
		if (error instanceof PixelOperationError) {
			return failure("Invalid pixel operation", 422, error.message);
		}
		throw error;
	}
}

function previewTarget(
	content: OfflineConflictContent,
	side: string
): { operations: PixelOperation[]; sourceId: string } {
	if (side === "cloud") {
		return {
			sourceId: content.cloud.sourceAssetVersionId,
			operations: appliedOperations(content.cloud),
		};
	}
	return {
		sourceId: content.base.sourceAssetVersionId,
		operations: side === "base" ? [] : appliedOperations(content.local),
	};
}

/** PNG of one of the three versions: base, cloud as recorded, or the local draft. */
export async function readOfflineConflictPreview(
	scope: Scope,
	conflictId: string,
	side: string
): Promise<Outcome<Uint8Array<ArrayBuffer>>> {
	if (!(offlineConflictSides as readonly string[]).includes(side)) {
		return failure("Not found", 404);
	}
	const loaded = await loadEntry(scope, conflictId);
	if (!loaded.ok) {
		return loaded;
	}
	const { content } = loaded.value;
	const target = previewTarget(content, side);
	const rendered = await renderVersion(
		scope,
		target.sourceId,
		target.operations
	);
	return rendered.ok ? success(rendered.value.png) : rendered;
}

function abandonConfirmed(
	input: { confirmAbandon?: boolean; shownLocalDigest?: string },
	digest: string
) {
	return input.confirmAbandon === true && input.shownLocalDigest === digest;
}

function resolveResponse(
	readable: ReadableEntry,
	resolution: OfflineConflictResolutionRow,
	created: boolean
): Outcome<OfflineConflictResolveResponse> {
	return success(
		offlineConflictResolveResponseSchema.parse({
			conflict: buildView({
				...readable,
				entry: { ...readable.entry, resolution },
			}),
			created,
		}),
		created ? 201 : 200
	);
}

/** Replays the stored resolution, or refuses a second one with a different key or choice. */
function replayResolution(
	readable: ReadableEntry,
	resolution: OfflineConflictResolutionRow,
	input: { choice: string; idempotencyKey: string }
): Outcome<OfflineConflictResolveResponse> {
	if (resolution.idempotencyKey !== input.idempotencyKey) {
		return failure(
			"Offline Conflict Record already resolved",
			409,
			`Resolved as ${resolution.choice}.`
		);
	}
	if (resolution.choice !== input.choice) {
		return failure(
			"Offline Conflict resolution key reused",
			409,
			`This key already resolved the record as ${resolution.choice}.`
		);
	}
	return resolveResponse(readable, resolution, false);
}

export async function resolveOfflineConflict(
	scope: Scope,
	conflictId: string,
	body: unknown
): Promise<Outcome<OfflineConflictResolveResponse>> {
	const { access, dependencies } = scope;
	const input = offlineConflictResolveInputSchema.safeParse(body);
	if (!input.success) {
		return failure("Invalid Offline Conflict request", 400);
	}
	const loaded = await loadEntry(scope, conflictId);
	if (!loaded.ok) {
		return loaded;
	}
	const readable = loaded.value;
	const { record, resolution } = readable.entry;
	if (resolution) {
		return replayResolution(readable, resolution, input.data);
	}
	if (
		input.data.choice === "abandon" &&
		!abandonConfirmed(input.data, record.localDigest)
	) {
		return failure(
			"Abandoning a local Working Draft needs confirmation",
			400,
			"Show the local Working Draft, then send confirmAbandon: true with its shownLocalDigest."
		);
	}

	let resultAssetVersionId: string | null = null;
	if (input.data.choice === "create-candidate") {
		const { content } = readable;
		const rendered = await renderVersion(
			scope,
			content.base.sourceAssetVersionId,
			appliedOperations(content.local)
		);
		if (!rendered.ok) {
			return rendered;
		}
		if (appliedOperations(content.local).length === 0) {
			return failure(
				"Invalid Offline Conflict request",
				400,
				"The local Working Draft has no changes to turn into a Candidate Version."
			);
		}
		const { png, sourceFile } = rendered.value;
		const stored = await storePngCandidate(scope, {
			assetFamilyId: sourceFile.assetFamilyId,
			assetRecordId: sourceFile.assetRecordId,
			baseFileName: sourceFile.fileName ?? null,
			fallbackName: "pixel-edit",
			// One Candidate Version per record, whatever resolution key retries use.
			idempotencyKey: `offline-conflict:${record.id}`,
			png,
			suffix: sourceFile.fileName ? "-offline-draft" : "",
		});
		if (!stored.ok) {
			return failure(
				stored.error === "Not found"
					? "Not found"
					: "Working Draft commit failed",
				stored.status
			);
		}
		resultAssetVersionId = stored.assetVersionId;
	}

	const saved = await dependencies.offlineConflictStore.createResolution(
		access.userId,
		{
			id: newId(dependencies),
			conflictId: record.id,
			projectId: access.projectId,
			choice: input.data.choice,
			idempotencyKey: input.data.idempotencyKey,
			resultAssetVersionId,
		}
	);
	if (!saved) {
		return failure("Not found", 404);
	}
	// A concurrent resolution may have won; the stored one is authoritative.
	return saved.kind === "created"
		? resolveResponse(readable, saved.resolution, true)
		: replayResolution(readable, saved.resolution, input.data);
}
