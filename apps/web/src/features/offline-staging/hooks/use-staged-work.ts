import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { orpc } from "@/utils/orpc";
import { getDefaultOfflineStagingStore } from "../lib/offline-staging-store";
import { cachedProjectSchema } from "../schemas";

/**
 * Everything staged in this browser for one project, read from the persisted
 * store, plus the project itself while online. A visit while online refreshes
 * the cached project that offline viewing reads.
 */
export function useStagedWork(projectId: string) {
	const store = getDefaultOfflineStagingStore();
	const queryClient = useQueryClient();
	const stagedKey = useMemo(() => ["offline-staging", projectId], [projectId]);

	const projectQuery = useQuery({
		...orpc.projects.get.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline", suppressGlobalErrorToast: true },
		retry: false,
	});
	const staged = useQuery({
		queryKey: stagedKey,
		queryFn: async () => ({
			cachedProject: await store.readCachedProject(projectId),
			drafts: await store.listStagedDrafts(projectId),
			files: await store.listStagedFiles(projectId),
		}),
		networkMode: "always",
		staleTime: 0,
	});

	const refresh = useCallback(
		() => queryClient.invalidateQueries({ queryKey: stagedKey }),
		[queryClient, stagedKey]
	);

	useEffect(() => {
		const project = cachedProjectSchema.safeParse(projectQuery.data);
		if (project.success) {
			store
				.cacheProject(projectId, project.data)
				.then(refresh)
				.catch(() => undefined);
		}
	}, [projectQuery.data, projectId, refresh, store]);

	return { projectQuery, refresh, staged, store };
}
