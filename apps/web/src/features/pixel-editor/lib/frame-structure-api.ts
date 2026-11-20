import type {
	FrameOperation,
	SheetStructureView,
} from "@sprite-anvil/api/pixel-editor-structure";
import { serverUrl } from "@/utils/hono-api";
import { client, orpc } from "@/utils/orpc";

export function frameImageUrl(
	view: SheetStructureView,
	frame: SheetStructureView["frames"][number]
) {
	return `${serverUrl()}${frame.previewUrl}?revision=${view.draftRevision}`;
}

export function frameStructureOptions(
	projectId: string,
	draftId: string,
	draftRevision: number
) {
	const options = orpc.workingDrafts.readStructure.queryOptions({
		input: { projectId, draftId },
		retry: false,
	});
	return { ...options, queryKey: [...options.queryKey, draftRevision] };
}

export function applyFrameOperation(
	projectId: string,
	view: SheetStructureView,
	operation: FrameOperation
) {
	return client.workingDrafts.applyFrameOperation({
		projectId,
		draftId: view.draftId,
		expectedRevision: view.draftRevision,
		operation,
	});
}
