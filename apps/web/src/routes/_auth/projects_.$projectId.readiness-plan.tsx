import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ReadinessPlanView } from "@/features/readiness-plans/ui/views/readiness-plan-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/readiness-plan"
)({
	component: ProjectReadinessPlanRoute,
	validateSearch: z.object({ deliveryTargetId: z.string().optional() }),
});

function ProjectReadinessPlanRoute() {
	const { projectId } = Route.useParams();
	const { deliveryTargetId } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	return (
		<ReadinessPlanView
			deliveryTargetId={deliveryTargetId}
			onSelectTarget={(id) =>
				void navigate({ search: { deliveryTargetId: id } })
			}
			projectId={projectId}
		/>
	);
}
