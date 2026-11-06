import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

/**
 * Asks the server to cancel one operation, then re-reads the authoritative
 * record: the outcome shown is whatever the record says, never the request.
 */
export function useCancelBackgroundOperation(projectId: string) {
	const queryClient = useQueryClient();
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: orpc.backgroundOperations.list.queryOptions({
				input: { projectId },
			}).queryKey,
		});
	return useMutation({
		...orpc.backgroundOperations.cancel.mutationOptions(),
		onSettled: refresh,
	});
}
