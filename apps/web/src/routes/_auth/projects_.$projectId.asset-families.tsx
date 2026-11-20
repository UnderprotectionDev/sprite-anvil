import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AssetFamiliesView } from "@/features/asset-families/ui/views/asset-families-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/asset-families"
)({
	validateSearch: z.object({ familyId: z.uuid().optional().catch(undefined) }),
	component: AssetFamiliesRoute,
});

function AssetFamiliesRoute() {
	const { projectId } = Route.useParams();
	const { familyId } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<AssetFamiliesView
			familyId={familyId}
			onSelectFamily={(nextId) =>
				void navigate({ search: { familyId: nextId } })
			}
			projectId={projectId}
		/>
	);
}
