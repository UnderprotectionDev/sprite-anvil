import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationMeta } from "@/utils/mutation-meta";
import { useOnlineStatus } from "../../hooks/use-online-status";
import { fetchWorkingDraftForStaging } from "../../lib/offline-staging-api";
import { offlineStagingQueryKey } from "../../lib/offline-staging-query-key";
import { getOfflineStagingStore } from "../../lib/offline-staging-store";

/** Keeps a recoverable copy of the open Working Draft in this browser, pinned to its base. */
export function StageWorkingDraftPanel({
	projectId,
	sourceAssetVersionId,
	userId,
}: {
	projectId: string;
	sourceAssetVersionId: string;
	userId: string;
}) {
	const online = useOnlineStatus();
	const queryClient = useQueryClient();
	const stage = useMutation({
		...mutationMeta,
		networkMode: "always",
		mutationFn: async () => {
			const draft = await fetchWorkingDraftForStaging(
				projectId,
				sourceAssetVersionId
			);
			const result =
				await getOfflineStagingStore(userId).stageWorkingDraft(draft);
			return { result, revision: draft.revision };
		},
		onSuccess: async ({ result }) => {
			if (result === "staged") {
				await queryClient.invalidateQueries({
					queryKey: offlineStagingQueryKey(userId, projectId),
					refetchType: "all",
				});
			}
		},
	});
	let message: string | undefined;
	if (stage.isError) {
		message = stage.error.message || "Staging the draft failed.";
	} else if (stage.data) {
		message =
			stage.data.result === "kept-existing"
				? "An earlier staged copy of this Working Draft is kept so its pinned base stays consistent. Check it against the cloud before staging again."
				: `Working Draft saved offline at revision ${stage.data.revision}. The cloud stays authoritative.`;
	}

	return (
		<section
			aria-label="Offline staging"
			className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center gap-3 px-4 pb-6"
		>
			<Button
				disabled={!online || stage.isPending}
				onClick={() => stage.mutate()}
				type="button"
				variant="outline"
			>
				Stage Working Draft for offline
			</Button>
			{message ? <p role="status">{message}</p> : null}
		</section>
	);
}
