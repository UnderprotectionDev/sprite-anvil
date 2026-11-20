import { createFileRoute } from "@tanstack/react-router";
import { OfflineStagingView } from "@/features/offline-staging/ui/views/offline-staging-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/offline-staging"
)({
	component: OfflineStagingRoute,
});

function OfflineStagingRoute() {
	const { projectId } = Route.useParams();
	const { session } = Route.useRouteContext();
	return (
		<OfflineStagingView
			key={JSON.stringify([session.user.id, projectId])}
			projectId={projectId}
			userId={session.user.id}
		/>
	);
}
