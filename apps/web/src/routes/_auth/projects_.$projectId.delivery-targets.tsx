import { createFileRoute } from "@tanstack/react-router";
import { DeliveryTargetsView } from "@/features/delivery-planning/ui/views/delivery-targets-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/delivery-targets"
)({ component: ProjectDeliveryTargetsRoute });

function ProjectDeliveryTargetsRoute() {
	const { projectId } = Route.useParams();
	return <DeliveryTargetsView projectId={projectId} />;
}
