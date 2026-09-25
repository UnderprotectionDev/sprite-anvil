import { createFileRoute } from "@tanstack/react-router";
import { AssetFamiliesView } from "@/features/asset-families/ui/views/asset-families-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/asset-families"
)({
	component: AssetFamiliesRoute,
});

function AssetFamiliesRoute() {
	const { projectId } = Route.useParams();
	return <AssetFamiliesView projectId={projectId} />;
}
