import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

/** The overview is the source of truth: a write only invalidates it so the screen shows the re-read records. */
function useRefreshOverview() {
	const queryClient = useQueryClient();
	return () =>
		queryClient.invalidateQueries({
			queryKey: orpc.platformEquivalence.overview.key(),
		});
}

export function useRecordPlatformEquivalenceRun() {
	return useMutation({
		...orpc.platformEquivalence.recordRun.mutationOptions(mutationMeta),
		onSuccess: useRefreshOverview(),
	});
}

export function useCreatePlatformEquivalenceReport() {
	return useMutation({
		...orpc.platformEquivalence.createReport.mutationOptions(mutationMeta),
		onSuccess: useRefreshOverview(),
	});
}
