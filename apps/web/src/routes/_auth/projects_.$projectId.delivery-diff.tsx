import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { DeliveryDiffView } from "@/features/delivery-fulfilment/ui/views/delivery-diff-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/delivery-diff"
)({
	component: ProjectDeliveryDiffRoute,
	validateSearch: z.object({ deliveryTargetId: z.string().optional() }),
});

function ProjectDeliveryDiffRoute() {
	const { projectId } = Route.useParams();
	const { deliveryTargetId } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	return (
		<DeliveryDiffView
			deliveryTargetId={deliveryTargetId}
			onSelectTarget={(id) =>
				void navigate({ search: { deliveryTargetId: id } })
			}
			projectId={projectId}
		/>
	);
}
