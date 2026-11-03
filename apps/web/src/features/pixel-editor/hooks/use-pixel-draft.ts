import type {
	PixelDraft,
	PixelOperation,
} from "@sprite-anvil/api/pixel-editor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	applyPixelOperation,
	commitPixelDraft,
	discardPixelDraft,
	movePixelDraftHistory,
	openPixelDraft,
	previewPixelColorReplace,
} from "../lib/pixel-editor-api";

function draftKey(projectId: string, sourceAssetVersionId: string) {
	return ["pixel-editor", projectId, "draft", sourceAssetVersionId] as const;
}

function errorText(error: unknown) {
	return error instanceof Error ? error.message : "The request failed";
}

/** Opens (or recovers) the Working Draft for a source Asset Version and exposes its edits. */
export function usePixelDraft(projectId: string, sourceAssetVersionId: string) {
	const queryClient = useQueryClient();
	const key = draftKey(projectId, sourceAssetVersionId);
	const draftQuery = useQuery({
		queryKey: key,
		queryFn: () => openPixelDraft(projectId, sourceAssetVersionId),
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
		retry: false,
	});
	const remember = (next: PixelDraft) => queryClient.setQueryData(key, next);
	const draft = draftQuery.data;
	const onError = (error: unknown) => {
		toast.error(errorText(error));
		// A stale revision or closed draft means the cache is behind the record.
		queryClient.invalidateQueries({ queryKey: key });
	};

	const operation = useMutation({
		mutationFn: (next: PixelOperation) => {
			if (!draft) {
				throw new Error("The Working Draft is not loaded yet");
			}
			return applyPixelOperation(projectId, draft, next);
		},
		onSuccess: remember,
		onError,
	});
	const history = useMutation({
		mutationFn: (direction: "undo" | "redo") => {
			if (!draft) {
				throw new Error("The Working Draft is not loaded yet");
			}
			return movePixelDraftHistory(projectId, draft, direction);
		},
		onSuccess: remember,
		onError,
	});
	const commit = useMutation({
		mutationFn: () => {
			if (!draft) {
				throw new Error("The Working Draft is not loaded yet");
			}
			return commitPixelDraft(projectId, draft);
		},
		onSuccess: (result) => {
			remember(result.draft);
			toast.success("Candidate Version created from the Working Draft.");
		},
		onError,
	});
	const discard = useMutation({
		mutationFn: () => {
			if (!draft) {
				throw new Error("The Working Draft is not loaded yet");
			}
			return discardPixelDraft(projectId, draft.id);
		},
		onSuccess: (result) => {
			remember(result);
			toast.success("Working Draft discarded. The source is unchanged.");
		},
		onError,
	});

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
	return useQuery({
		enabled: Boolean(draft && from && to && from !== to),
		queryKey: [
			"pixel-editor",
			projectId,
			"color-replace",
			draft?.id,
			draft?.revision,
			from,
			to,
		],
		queryFn: () => {
			if (!draft) {
				throw new Error("The Working Draft is not loaded yet");
			}
			return previewPixelColorReplace(projectId, draft.id, from, to);
		},
	});
}
