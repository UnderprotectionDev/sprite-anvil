import { createFileRoute } from "@tanstack/react-router";
import { PlatformEquivalenceReportView } from "@/features/platform-equivalence/ui/views/platform-equivalence-report-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/platform-equivalence"
)({ component: ProjectPlatformEquivalenceRoute });

function ProjectPlatformEquivalenceRoute() {
	const { projectId } = Route.useParams();
	return <PlatformEquivalenceReportView projectId={projectId} />;
}
