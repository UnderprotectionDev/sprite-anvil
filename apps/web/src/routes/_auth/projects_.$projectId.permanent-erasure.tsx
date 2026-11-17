import { createFileRoute } from "@tanstack/react-router";
import { DeletionJobHistory } from "@/features/permanent-erasure/ui/components/deletion-job-history";
import { PermanentErasureView } from "@/features/permanent-erasure/ui/views/permanent-erasure-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/permanent-erasure"
)({ component: PermanentErasureRoute });
function PermanentErasureRoute() {
	const { projectId } = Route.useParams();
	return (
		<>
			<PermanentErasureView projectId={projectId} />
			<DeletionJobHistory key={projectId} projectId={projectId} />
		</>
	);
}
