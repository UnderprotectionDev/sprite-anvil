import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AssetRecordDetailView } from "@/features/asset-records/ui/views/asset-records-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/assets_/$assetRecordId"
)({
	validateSearch: z
		.object({ versionId: z.string().uuid().optional() })
		.catch({}),
	component: AssetRecordDetailRoute,
});

function AssetRecordDetailRoute() {
	const { assetRecordId, projectId } = Route.useParams();
	const { versionId } = Route.useSearch();
	return (
		<AssetRecordDetailView
			assetRecordId={assetRecordId}
			focusVersionId={versionId}
			projectId={projectId}
		/>
	);
}
