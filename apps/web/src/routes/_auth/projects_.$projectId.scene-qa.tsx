import { createFileRoute } from "@tanstack/react-router";
import { SceneQaView } from "@/features/scene-qa-playground/ui/views/scene-qa-view";
export const Route = createFileRoute("/_auth/projects_/$projectId/scene-qa")({
	component: SceneQaRoute,
});
function SceneQaRoute() {
	const { projectId } = Route.useParams();
	return <SceneQaView projectId={projectId} />;
}
