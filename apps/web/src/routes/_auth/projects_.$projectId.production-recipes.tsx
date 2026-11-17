import { createFileRoute } from "@tanstack/react-router";
import { ProductionRecipesView } from "@/features/production-recipes/ui/views/production-recipes-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/production-recipes"
)({ component: ProjectProductionRecipesRoute });
function ProjectProductionRecipesRoute() {
	const { projectId } = Route.useParams();
	return <ProductionRecipesView projectId={projectId} />;
}
