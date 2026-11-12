import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { FulfilmentMappingView } from "@/features/delivery-fulfilment/ui/views/fulfilment-mapping-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/fulfilment-mapping"
)({
	component: ProjectFulfilmentMappingRoute,
	validateSearch: z.object({ deliveryTargetId: z.string().optional() }),
});

function ProjectFulfilmentMappingRoute() {
	const { projectId } = Route.useParams();
	const { deliveryTargetId } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	return (
		<FulfilmentMappingView
			deliveryTargetId={deliveryTargetId}
			onSelectTarget={(id) =>
				void navigate({ search: { deliveryTargetId: id } })
			}
			projectId={projectId}
		/>
	);
}
