import { createFileRoute, Link } from "@tanstack/react-router";
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
		<>
			<div className="mx-auto w-full max-w-3xl px-4 pt-6">
				<Link
					className="text-muted-foreground text-sm underline underline-offset-4"
					params={{ projectId }}
					to="/projects/$projectId/assets"
				>
					Varlık kayıtlarına dön
				</Link>
			</div>
			<AssetRecordDetailView
				assetRecordId={assetRecordId}
				focusVersionId={versionId}
				projectId={projectId}
			/>
		</>
	);
}
