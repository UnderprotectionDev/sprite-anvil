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

export class PixelEditorApiError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "PixelEditorApiError";
		this.status = status;
	}
}

function draftsUrl(projectId: string) {
	const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlashPattern, "");
	return `${serverUrl}/api/projects/${encodeURIComponent(projectId)}/pixel-editor/drafts`;
}

export function pixelDraftPreviewUrl(draft: PixelDraft) {
	const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlashPattern, "");
	return `${serverUrl}${draft.previewUrl}?revision=${draft.revision}`;
}

export function pixelDraftSourceUrl(draft: PixelDraft) {
	const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlashPattern, "");
	return `${serverUrl}${draft.sourcePreviewUrl}`;
}

async function post(url: string, body: unknown) {
	const response = await fetch(url, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body ?? {}),
	});
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

export async function openPixelDraft(
	projectId: string,
	sourceAssetVersionId: string
) {
	return pixelDraftSchema.parse(
		await post(draftsUrl(projectId), { sourceAssetVersionId })
	);
}

export async function applyPixelOperation(
	projectId: string,
	draft: PixelDraft,
	operation: PixelOperation
) {
	return pixelDraftSchema.parse(
		await post(`${draftsUrl(projectId)}/${draft.id}/operations`, {
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
		await post(`${draftsUrl(projectId)}/${draft.id}/${direction}`, {
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
		await post(`${draftsUrl(projectId)}/${draftId}/color-replace-preview`, {
			from,
			to,
		})
	);
}

export async function commitPixelDraft(projectId: string, draftId: string) {
	return pixelDraftCommitResponseSchema.parse(
		await post(`${draftsUrl(projectId)}/${draftId}/commit`, {})
	);
}

export async function discardPixelDraft(projectId: string, draftId: string) {
	return pixelDraftSchema.parse(
		await post(`${draftsUrl(projectId)}/${draftId}/discard`, {})
	);
}
