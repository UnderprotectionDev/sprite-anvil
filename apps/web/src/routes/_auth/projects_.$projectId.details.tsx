import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetailsView } from "@/features/projects/ui/views/project-details-view";

export const Route = createFileRoute("/_auth/projects_/$projectId/details")({
	component: DetailsRoute,
});

function DetailsRoute() {
	const { projectId } = Route.useParams();
	return <ProjectDetailsView key={projectId} projectId={projectId} />;
}
