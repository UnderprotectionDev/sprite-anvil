import { createFileRoute } from "@tanstack/react-router";
import { OfflineStagingView } from "@/features/offline-staging/ui/views/offline-staging-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/offline-staging"
)({
	component: OfflineStagingRoute,
});

function OfflineStagingRoute() {
	const { projectId } = Route.useParams();
	return <OfflineStagingView projectId={projectId} />;
}
