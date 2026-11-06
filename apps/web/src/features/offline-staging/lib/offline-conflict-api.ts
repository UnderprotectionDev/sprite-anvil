import {
	type OfflineConflictChoice,
	type OfflineReconcileInput,
	offlineAbandonConfirmationSchema,
	offlineConflictContractVersion,
	offlineConflictListSchema,
	offlineConflictResolveResponseSchema,
	offlineReconcileResponseSchema,
} from "@sprite-anvil/api/offline-conflict";
import { pixelDraftCommitResponseSchema } from "@sprite-anvil/api/pixel-editor";
import { honoGetJson, honoPostJson, projectApiUrl } from "@/utils/hono-api";

function conflictsUrl(projectId: string) {
	return `${projectApiUrl(projectId)}/pixel-editor/offline-conflicts`;
}

function conflictUrl(projectId: string, conflictId: string) {
	return `${conflictsUrl(projectId)}/${encodeURIComponent(conflictId)}`;
}

/** Reconnect check of one staged Working Draft: finalize normally or open a record. */
export function reconcileStagedDraft(projectId: string) {
	return async (request: OfflineReconcileInput) =>
		offlineReconcileResponseSchema.parse(
			await honoPostJson(
				`${conflictsUrl(projectId)}/reconcile`,
				request,
				"The reconnect check could not run"
			)
		);
}

export async function listOfflineConflicts(projectId: string) {
	return offlineConflictListSchema.parse(
		await honoGetJson(
			conflictsUrl(projectId),
			"The conflict records could not be read"
		)
	);
}

/** Serves the local content an abandon would discard, with the token that confirms it. */
export async function requestAbandonConfirmation(
	projectId: string,
	conflictId: string
) {
	return offlineAbandonConfirmationSchema.parse(
		await honoPostJson(
			`${conflictUrl(projectId, conflictId)}/abandon-confirmation`,
			{},
			"The local content could not be read"
		)
	);
}

export async function resolveOfflineConflict(
	projectId: string,
	conflictId: string,
	input: {
		choice: OfflineConflictChoice;
		confirmAbandon?: boolean;
		confirmationToken?: string;
		idempotencyKey: string;
	}
) {
	return offlineConflictResolveResponseSchema.parse(
		await honoPostJson(
			`${conflictUrl(projectId, conflictId)}/resolve`,
			{ contractVersion: offlineConflictContractVersion, ...input },
			"The resolution failed"
		)
	);
}

/** The existing Working Draft commit path, used when the pinned base is still current. */
export async function finalizeStagedDraft(
	projectId: string,
	draftId: string,
	expectedRevision: number
) {
	return pixelDraftCommitResponseSchema.parse(
		await honoPostJson(
			`${projectApiUrl(projectId)}/pixel-editor/drafts/${encodeURIComponent(draftId)}/commit`,
			{ expectedRevision },
			"The commit failed"
		)
	);
}

export function conflictPreviewUrl(
	projectId: string,
	conflictId: string,
	side: "base" | "cloud" | "local"
) {
	return `${conflictUrl(projectId, conflictId)}/preview/${side}`;
}
