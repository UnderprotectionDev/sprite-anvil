import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

/** The list and the Readiness Plan are the sources of truth: a finalize only invalidates them so the screen shows the re-read records. */
export function useFinalizeFulfilment() {
	const queryClient = useQueryClient();
	return useMutation({
		...orpc.deliveryFulfilment.finalize.mutationOptions(mutationMeta),
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.deliveryFulfilment.listFulfilments.key(),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.readinessPlans.get.key(),
				}),
			]),
	});
}
