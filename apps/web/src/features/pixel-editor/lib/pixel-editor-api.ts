// conventions-exception: raw-fetch Working Draft routes are authenticated Hono project routes that render and store PNG bytes through the verifying Asset Version storage; the oRPC context carries no object storage.
import {
	type PixelColorReplacePreview,
	type PixelDraft,
	type PixelOperation,
	pixelColorReplacePreviewSchema,
	pixelDraftCommitResponseSchema,
	pixelDraftSchema,
	pixelEditorErrorSchema,
} from "@sprite-anvil/api/pixel-editor";
import { ENV } from "@/env";

const trailingSlashPattern = /\/$/;

/** Base URL of the API server without a trailing slash. */
export function pixelEditorServerUrl() {
	return ENV.VITE_SERVER_URL.replace(trailingSlashPattern, "");
}

export class PixelEditorApiError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "PixelEditorApiError";
		this.status = status;
	}
}

export function draftsUrl(projectId: string) {
	return `${pixelEditorServerUrl()}/api/projects/${encodeURIComponent(projectId)}/pixel-editor/drafts`;
}

export function pixelDraftPreviewUrl(draft: PixelDraft) {
	return `${pixelEditorServerUrl()}${draft.previewUrl}?revision=${draft.revision}`;
}

export function pixelDraftSourceUrl(draft: PixelDraft) {
	return `${pixelEditorServerUrl()}${draft.sourcePreviewUrl}`;
}

async function readJsonOrThrow(response: Response) {
	if (!response.ok) {
		const parsed = pixelEditorErrorSchema.safeParse(
			await response.json().catch(() => null)
		);
		const message = parsed.success
			? [parsed.data.error, parsed.data.detail].filter(Boolean).join(": ")
			: "The Working Draft request failed";
		throw new PixelEditorApiError(message, response.status);
	}
	return response.json() as Promise<unknown>;
}

export async function pixelEditorPost(url: string, body: unknown) {
	return readJsonOrThrow(
		await fetch(url, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body ?? {}),
		})
	);
}

export async function pixelEditorGetJson(url: string) {
	return readJsonOrThrow(await fetch(url, { credentials: "include" }));
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
