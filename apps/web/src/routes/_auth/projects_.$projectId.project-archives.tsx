import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProjectArchivesView } from "@/features/project-archives/ui/views/project-archives-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/project-archives"
)({
	validateSearch: z.object({
		task: z.enum(["create", "upload", "restore"]).optional().catch(undefined),
		archiveId: z.string().optional().catch(undefined),
		operationId: z.string().optional().catch(undefined),
	}),
	component: ProjectArchivesRoute,
});
function ProjectArchivesRoute() {
	const { projectId } = Route.useParams();
	const { task, archiveId, operationId } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<ProjectArchivesView
			archiveId={archiveId}
			key={`${projectId}:${task ?? ""}:${archiveId ?? ""}`}
			onOperationAccepted={(id, acceptedTask) =>
				void navigate({
					search: {
						task: acceptedTask ?? task,
						archiveId: acceptedTask === "upload" ? undefined : archiveId,
						operationId: id,
					},
					replace: true,
				})
			}
			operationId={operationId}
			projectId={projectId}
			task={task}
		/>
	);
}
