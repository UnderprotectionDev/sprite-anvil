import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { assetRecordSearchDraftSchema } from "@/features/asset-discovery/schemas";
import { AssetRecordsView } from "@/features/asset-records/ui/views/asset-records-view";

export const Route = createFileRoute("/_auth/projects_/$projectId/assets")({
	validateSearch: z.object({
		filters: assetRecordSearchDraftSchema.optional().catch(undefined),
		offset: z.number().int().nonnegative().optional().catch(undefined),
	}),
	component: ProjectAssetRecordsRoute,
});

function ProjectAssetRecordsRoute() {
	const { projectId } = Route.useParams();
	const navigate = useNavigate();
	const { filters, offset } = Route.useSearch();
	const navigateSearch = Route.useNavigate();
	return (
		<AssetRecordsView
			filters={filters}
			key={projectId}
			onChangeSearch={(nextFilters, nextOffset) =>
				void navigateSearch({
					search: { filters: nextFilters, offset: nextOffset || undefined },
				})
			}
			onOpenRecord={(assetRecordId, versionId) =>
				void navigate({
					to: "/projects/$projectId/assets/$assetRecordId",
					params: { assetRecordId, projectId },
					search: versionId ? { versionId } : {},
				})
			}
			projectId={projectId}
			searchOffset={offset ?? 0}
		/>
	);
}
