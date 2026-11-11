import { createFileRoute } from "@tanstack/react-router";
import { DeliveryRefreshView } from "@/features/delivery-refresh-locks/ui/views/delivery-refresh-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/delivery-refresh"
)({ component: ProjectDeliveryRefreshRoute });

function ProjectDeliveryRefreshRoute() {
	const { projectId } = Route.useParams();
	return <DeliveryRefreshView projectId={projectId} />;
}
