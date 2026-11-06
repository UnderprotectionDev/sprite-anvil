import {
	type PixelColorReplacePreview,
	type PixelDraft,
	type PixelOperation,
	pixelColorReplacePreviewSchema,
	pixelDraftCommitResponseSchema,
	pixelDraftSchema,
} from "@sprite-anvil/api/pixel-editor";
import {
	honoGetJson,
	honoPostJson,
	projectApiUrl,
	serverUrl,
} from "@/utils/hono-api";

const requestFailed = "The Working Draft request failed";

/** Base URL of the API server without a trailing slash. */
export function pixelEditorServerUrl() {
	return serverUrl();
}

export function draftsUrl(projectId: string) {
	return `${projectApiUrl(projectId)}/pixel-editor/drafts`;
}

export function pixelDraftPreviewUrl(draft: PixelDraft) {
	return `${pixelEditorServerUrl()}${draft.previewUrl}?revision=${draft.revision}`;
}

export function pixelDraftSourceUrl(draft: PixelDraft) {
	return `${pixelEditorServerUrl()}${draft.sourcePreviewUrl}`;
}

export function pixelEditorPost(url: string, body: unknown) {
	return honoPostJson(url, body, requestFailed);
}

export function pixelEditorGetJson(url: string) {
	return honoGetJson(url, requestFailed);
}

export async function openPixelDraft(
	projectId: string,
	sourceAssetVersionId: string
) {
	return pixelDraftSchema.parse(
		await pixelEditorPost(draftsUrl(projectId), { sourceAssetVersionId })
	);
}

export async function applyPixelOperation(
	projectId: string,
	draft: PixelDraft,
	operation: PixelOperation
) {
	return pixelDraftSchema.parse(
		await pixelEditorPost(`${draftsUrl(projectId)}/${draft.id}/operations`, {
			expectedRevision: draft.revision,
			operation,
		})
	);
}

export async function movePixelDraftHistory(
	projectId: string,
	draft: PixelDraft,
	direction: "undo" | "redo"
) {
	return pixelDraftSchema.parse(
		await pixelEditorPost(`${draftsUrl(projectId)}/${draft.id}/${direction}`, {
			expectedRevision: draft.revision,
		})
	);
}

export async function previewPixelColorReplace(
	projectId: string,
	draftId: string,
	from: string,
	to: string
): Promise<PixelColorReplacePreview> {
	return pixelColorReplacePreviewSchema.parse(
		await pixelEditorPost(
			`${draftsUrl(projectId)}/${draftId}/color-replace-preview`,
			{
				from,
				to,
			}
		)
	);
}

export async function commitPixelDraft(projectId: string, draft: PixelDraft) {
	return pixelDraftCommitResponseSchema.parse(
		await pixelEditorPost(`${draftsUrl(projectId)}/${draft.id}/commit`, {
			expectedRevision: draft.revision,
		})
	);
}

export async function discardPixelDraft(projectId: string, draftId: string) {
	return pixelDraftSchema.parse(
		await pixelEditorPost(`${draftsUrl(projectId)}/${draftId}/discard`, {})
	);
}
