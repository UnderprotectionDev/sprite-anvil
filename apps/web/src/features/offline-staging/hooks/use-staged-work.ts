import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { orpc } from "@/utils/orpc";
import {
	getOfflineStagingStore,
	hasUnassignedOfflineStorage,
} from "../lib/offline-staging-store";
import { cachedProjectSchema } from "../schemas";

/**
 * Everything staged in this browser for one project, read from the persisted
 * store, plus the project itself while online. A visit while online refreshes
 * the cached project that offline viewing reads.
 */
export function useStagedWork(projectId: string, userId: string) {
	const store = getOfflineStagingStore(userId);
	const queryClient = useQueryClient();

	const projectQuery = useQuery({
		...orpc.projects.get.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
		retry: false,
	});
	const staged = useQuery({
		queryKey: ["offline-staging", userId, projectId],
		queryFn: async () => ({
			cachedProject: await store.readCachedProject(projectId),
			drafts: await store.listStagedDrafts(projectId),
			files: await store.listStagedFiles(projectId),
			unassignedStorage: await hasUnassignedOfflineStorage().catch(() => false),
		}),
		networkMode: "always",
		staleTime: 0,
	});

	const refresh = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: ["offline-staging", userId, projectId],
			}),
		[queryClient, userId, projectId]
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
