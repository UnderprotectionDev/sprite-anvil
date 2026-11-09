import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

/**
 * Saves the user's order of dependent work. The plan the server returns is the
 * result shown; a failed save leaves the plan on screen untouched.
 */
export function useReorderReadinessPlan() {
	const queryClient = useQueryClient();
	return useMutation({
		...orpc.readinessPlans.reorder.mutationOptions(mutationMeta),
		onSuccess: (plan, input) => {
			queryClient.setQueryData(
				orpc.readinessPlans.get.queryOptions({
					input: {
						deliveryTargetId: input.deliveryTargetId,
						projectId: input.projectId,
					},
				}).queryKey,
				plan
			);
		},
	});
}
