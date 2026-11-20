import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import { serverUrl } from "@/utils/hono-api";

export function pixelDraftPreviewUrl(draft: PixelDraft) {
	return `${serverUrl()}${draft.previewUrl}?revision=${draft.revision}`;
}

export function pixelDraftSourceUrl(draft: PixelDraft) {
	return `${serverUrl()}${draft.sourcePreviewUrl}`;
}
