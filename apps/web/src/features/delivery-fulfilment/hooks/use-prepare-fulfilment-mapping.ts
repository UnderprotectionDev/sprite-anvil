import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

/** The list is the source of truth: a prepare only invalidates it so the screen shows the re-read draft. */
export function usePrepareFulfilmentMapping() {
	const queryClient = useQueryClient();
	return useMutation({
		...orpc.deliveryFulfilment.prepareMapping.mutationOptions(mutationMeta),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: orpc.deliveryFulfilment.listMappings.key(),
			}),
	});
}
