import { createFileRoute } from "@tanstack/react-router";
import { ProductionExperimentsView } from "@/features/production-experiments/ui/views/production-experiments-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/production-experiments"
)({ component: ProductionExperimentsRoute });
function ProductionExperimentsRoute() {
	const { projectId } = Route.useParams();
	return <ProductionExperimentsView projectId={projectId} />;
}
