import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

function errorText(error: unknown) {
	return error instanceof Error ? error.message : "The request failed";
}

/** Opens (or recovers) the Working Draft for a source Asset Version and exposes its edits. */
export function usePixelDraft(projectId: string, sourceAssetVersionId: string) {
	const queryClient = useQueryClient();
	const options = orpc.workingDrafts.open.queryOptions({
		input: { projectId, sourceAssetVersionId },
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
		retry: false,
	});
	const draftQuery = useQuery(options);
	const remember = (next: PixelDraft) =>
		queryClient.setQueryData(options.queryKey, next);
	const draft = draftQuery.data;
	const onError = (error: unknown) => {
		toast.error(errorText(error));
		return queryClient.invalidateQueries({ queryKey: options.queryKey });
	};

	const operation = useMutation(
		orpc.workingDrafts.apply.mutationOptions({ onSuccess: remember, onError })
	);
	const history = useMutation(
		orpc.workingDrafts.moveHistory.mutationOptions({
			onSuccess: remember,
			onError,
		})
	);
	const commit = useMutation(
		orpc.workingDrafts.commit.mutationOptions({
			onSuccess: (result) => {
				remember(result.draft);
				toast.success("Candidate Version created from the Working Draft.");
			},
			onError,
		})
	);
	const discard = useMutation(
		orpc.workingDrafts.discard.mutationOptions({
			onSuccess: (result) => {
				remember(result);
				toast.success("Working Draft discarded. The source is unchanged.");
			},
			onError,
		})
	);

	return {
		commit,
		discard,
		draft,
		draftQuery,
		history,
		isBusy:
			operation.isPending ||
			history.isPending ||
			commit.isPending ||
			discard.isPending,
		operation,
	};
}

export function useColorReplacePreview(
	projectId: string,
	draft: PixelDraft | undefined,
	from: string,
	to: string
) {
	const options = orpc.workingDrafts.previewColorReplace.queryOptions({
		input: { projectId, draftId: draft?.id ?? "", from, to },
		enabled: Boolean(draft && from && to && from !== to),
	});
	return useQuery({
		...options,
		queryKey: [...options.queryKey, draft?.revision],
	});
}
