import { createFileRoute } from "@tanstack/react-router";
import { ImportInboxView } from "@/features/imports/ui/views/import-inbox-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/import-inbox"
)({
	component: ProjectImportInboxRoute,
});

function ProjectImportInboxRoute() {
	const { projectId } = Route.useParams();
	return <ImportInboxView projectId={projectId} />;
}
