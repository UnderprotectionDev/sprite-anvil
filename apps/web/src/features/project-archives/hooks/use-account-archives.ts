import { useQueries, useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import type { AccountArchive } from "../lib/archive-summary";
export function useAccountArchives() {
	const projects = useQuery(orpc.projects.list.queryOptions());
	const catalogs = useQueries({
		queries: (projects.data ?? []).map((project) => ({
			...orpc.projectArchives.list.queryOptions({
				input: { projectId: project.id },
			}),
			meta: { errorPresentation: "inline" },
		})),
	});
	const sources: AccountArchive[] = (projects.data ?? [])
		.flatMap((project, index) =>
			(catalogs[index]?.data?.archives ?? []).map((archive) => ({
				...archive,
				project,
				projectName: project.name,
				previewAssetVersionId: project.previewAssetVersionId,
				hasPreview: project.hasPreview,
			}))
		)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	return {
		projects,
		catalogs,
		sources,
		loading: projects.isPending || catalogs.some((query) => query.isPending),
		failed: projects.isError || catalogs.some((query) => query.isError),
	};
}
