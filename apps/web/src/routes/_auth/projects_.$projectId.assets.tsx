import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AssetRecordsView } from "@/features/asset-records/ui/views/asset-records-view";

export const Route = createFileRoute("/_auth/projects_/$projectId/assets")({
	component: ProjectAssetRecordsRoute,
});

function ProjectAssetRecordsRoute() {
	const { projectId } = Route.useParams();
	const navigate = useNavigate();
	return (
		<AssetRecordsView
			onOpenRecord={(assetRecordId) =>
				void navigate({
					to: "/projects/$projectId/assets/$assetRecordId",
					params: { assetRecordId, projectId },
				})
			}
			projectId={projectId}
		/>
	);
}
