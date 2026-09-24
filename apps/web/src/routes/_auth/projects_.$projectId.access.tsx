import { createFileRoute } from "@tanstack/react-router";
import { ProjectAccessScreen } from "@/features/projects/ui/views/project-access-view";

export const Route = createFileRoute("/_auth/projects_/$projectId/access")({
	component: ProjectAccessRoute,
});

function ProjectAccessRoute() {
	const { projectId } = Route.useParams();
	return <ProjectAccessScreen projectId={projectId} />;
}
