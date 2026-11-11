import { createFileRoute } from "@tanstack/react-router";
import { RuntimeValidationView } from "@/features/runtime-validation/ui/views/runtime-validation-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/runtime-validation"
)({ component: ProjectRuntimeValidationRoute });

function ProjectRuntimeValidationRoute() {
	const { projectId } = Route.useParams();
	return <RuntimeValidationView projectId={projectId} />;
}
