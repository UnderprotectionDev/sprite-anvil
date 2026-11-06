import { createFileRoute } from "@tanstack/react-router";
import { BackgroundOperationsView } from "@/features/background-operations/ui/views/background-operations-view";

export const Route = createFileRoute("/_auth/projects_/$projectId/operations")({
	component: ProjectOperationsRoute,
});

function ProjectOperationsRoute() {
	const { projectId } = Route.useParams();
	return <BackgroundOperationsView projectId={projectId} />;
}
