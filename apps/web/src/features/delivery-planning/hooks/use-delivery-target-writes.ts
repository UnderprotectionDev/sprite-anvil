import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

/** The catalog is the source of truth: a write only invalidates it so the screen shows the re-read record. */
function useRefreshCatalog(projectId: string) {
	const queryClient = useQueryClient();
	return () =>
		queryClient.invalidateQueries({
			queryKey: orpc.deliveryPlanning.list.queryOptions({
				input: { projectId },
			}).queryKey,
		});
}

export function useSaveDeliveryTargetDraft(projectId: string) {
	return useMutation({
		...orpc.deliveryPlanning.saveDraft.mutationOptions(mutationMeta),
		onSuccess: useRefreshCatalog(projectId),
	});
}

export function useActivateDeliveryTarget(projectId: string) {
	return useMutation({
		...orpc.deliveryPlanning.activate.mutationOptions(mutationMeta),
		onSuccess: useRefreshCatalog(projectId),
	});
}
