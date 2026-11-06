import {
	type OfflineReconcileResponse,
	offlineConflictContractVersion,
	offlineReconcileInputSchema,
	offlineReconcileResponseSchema,
} from "@sprite-anvil/api/offline-conflict";
import type { PixelDraftRecord } from "@sprite-anvil/api/pixel-editor";
import {
	appliedOperations,
	buildView,
	checkRequestContractVersion,
	localDigest,
	type OperationHistory,
	readEntry,
} from "./offline-conflict-content";
import { replayOverSource } from "./offline-conflict-render";
import {
	failure,
	newId,
	type Outcome,
	type Scope,
	success,
	updateFailure,
} from "./pixel-editor-context";

/**
 * Reconnect check of a staged Working Draft (PLT-02). While the cloud draft is
 * unchanged since the pinned base, the staged local operations are written over
 * it and the draft goes to normal finalization. A record opens only when the
 * cloud revision or source advanced. The cloud draft is never edited otherwise.
 */

function baseCurrentResponse(draft: {
	id: string;
	revision: number;
	sourceAssetVersionId: string;
}) {
	return success(
		offlineReconcileResponseSchema.parse({
			outcome: "base-current",
			draft: {
				id: draft.id,
				revision: draft.revision,
				sourceAssetVersionId: draft.sourceAssetVersionId,
			},
		}) as OfflineReconcileResponse
	);
}

function sameApplied(a: OperationHistory, b: OperationHistory) {
	return (
		JSON.stringify(appliedOperations(a)) ===
		JSON.stringify(appliedOperations(b))
	);
}

/** Writes the staged operations over the unchanged cloud draft in one revision-checked update. */
async function writeLocalOverCloud(
	scope: Scope,
	cloud: PixelDraftRecord,
	local: OperationHistory
): Promise<Outcome<OfflineReconcileResponse>> {
	const { access, dependencies } = scope;
	if (cloud.structure) {
		return failure(
			"Invalid pixel operation",
			422,
			"A Working Draft with a frame structure cannot take operations staged offline."
		);
	}
	const replayed = await replayOverSource(
		scope,
		cloud.sourceAssetVersionId,
		local.operations.slice(0, local.appliedOperationCount)
	);
	if (!replayed.ok) {
		return replayed;
	}
	const result = await dependencies.pixelEditorStore.updateOperations(
		access.userId,
		access.projectId,
		cloud.id,
		{
			expectedRevision: cloud.revision,
			operations: local.operations,
			appliedOperationCount: local.appliedOperationCount,
		}
	);
	const failed = updateFailure(result);
	if (failed) {
		return failed;
	}
	return baseCurrentResponse(result?.kind === "updated" ? result.draft : cloud);
}

export async function reconcileStagedDraft(
	scope: Scope,
	body: unknown
): Promise<Outcome<OfflineReconcileResponse>> {
	const { access, dependencies } = scope;
	const versionFailure = checkRequestContractVersion(body);
	if (versionFailure) {
		return versionFailure;
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
	const sameSource = cloud.sourceAssetVersionId === base.sourceAssetVersionId;
	const baseCurrent = sameSource && cloud.revision === base.revision;
	const holdsLocal = sameSource && sameApplied(local, cloud);
	if (baseCurrent && cloud.status === "open") {
		return holdsLocal
			? baseCurrentResponse(cloud)
			: await writeLocalOverCloud(scope, cloud, local);
	}
	// A repeated check after the write above: the cloud already holds exactly the
	// staged operations, so nothing is at risk and there is nothing to resolve.
	if (holdsLocal && cloud.status !== "discarded") {
		return baseCurrentResponse(cloud);
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
