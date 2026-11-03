import type { PixelDraftCoordinateSpace } from "@sprite-anvil/api/generation-packages";
import { type DraftDependencies, loadDraft } from "./pixel-editor-context";

/**
 * Reads the size and revision of a Working Draft from the persisted operations,
 * so a Production Package never trusts a client-reported size. Null when the
 * draft is not the user's in this project or its source image is unavailable.
 */
export function createDraftCoordinateSpaceReader(
	dependencies: DraftDependencies
) {
	return async (
		userId: string,
		projectId: string,
		draftId: string
	): Promise<PixelDraftCoordinateSpace | null> => {
		const loaded = await loadDraft(
			{ access: { projectId, userId }, dependencies },
			draftId
		);
		if (!loaded.ok) {
			return null;
		}
		const { applied, draft } = loaded.value;
		return {
			assetRecordId: draft.assetRecordId,
			draftId: draft.id,
			draftRevision: draft.revision,
			height: applied.height,
			sourceAssetVersionId: draft.sourceAssetVersionId,
			width: applied.width,
		};
	};
}
