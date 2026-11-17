import { createFileRoute } from "@tanstack/react-router";
import { ProjectArchivesView } from "@/features/project-archives/ui/views/project-archives-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/project-archives"
)({ component: ProjectArchivesRoute });
function ProjectArchivesRoute() {
	const { projectId } = Route.useParams();
	return <ProjectArchivesView key={projectId} projectId={projectId} />;
}
