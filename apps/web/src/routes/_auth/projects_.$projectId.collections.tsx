import { createFileRoute } from "@tanstack/react-router";
import { CollectionsView } from "@/features/collections/ui/views/collections-view";

export const Route = createFileRoute("/_auth/projects_/$projectId/collections")(
	{
		component: ProjectCollectionsRoute,
	}
);

function ProjectCollectionsRoute() {
	const { projectId } = Route.useParams();
	return <CollectionsView projectId={projectId} />;
}
