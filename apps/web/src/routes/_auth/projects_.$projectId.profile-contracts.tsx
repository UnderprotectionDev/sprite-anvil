import { createFileRoute } from "@tanstack/react-router";
import { SpecializedProfileContractsView } from "@/features/quality-evidence/ui/views/specialized-profile-contracts-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/profile-contracts"
)({
	component: SpecializedProfileContractsRoute,
});

function SpecializedProfileContractsRoute() {
	const { projectId } = Route.useParams();
	return <SpecializedProfileContractsView projectId={projectId} />;
}
