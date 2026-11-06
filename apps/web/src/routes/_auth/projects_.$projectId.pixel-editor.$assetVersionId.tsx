import { createFileRoute } from "@tanstack/react-router";
import { StageWorkingDraftPanel } from "@/features/offline-staging/ui/components/stage-working-draft-panel";
import { PixelEditorView } from "@/features/pixel-editor/ui/views/pixel-editor-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/pixel-editor/$assetVersionId"
)({
	component: PixelEditorRoute,
});

function PixelEditorRoute() {
	const { assetVersionId, projectId } = Route.useParams();
	return (
		<>
			<PixelEditorView
				projectId={projectId}
				sourceAssetVersionId={assetVersionId}
			/>
			<StageWorkingDraftPanel
				projectId={projectId}
				sourceAssetVersionId={assetVersionId}
			/>
		</>
	);
}
