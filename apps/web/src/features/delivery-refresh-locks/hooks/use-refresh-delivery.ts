import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

/** A refresh makes a new lock; the lock list is re-read so the screen shows the persisted record. */
export function useRefreshDelivery(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		...orpc.deliveryRefreshLocks.refresh.mutationOptions(mutationMeta),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: orpc.deliveryRefreshLocks.list.queryOptions({
					input: { projectId },
				}).queryKey,
			}),
	});
}
