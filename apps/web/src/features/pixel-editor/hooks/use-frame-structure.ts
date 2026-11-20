import { ORPCError } from "@orpc/client";
import type { FrameOperation } from "@sprite-anvil/api/pixel-editor-structure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import {
	applyFrameOperation,
	frameStructureOptions,
} from "../lib/frame-structure-api";

function errorText(error: unknown) {
	return error instanceof Error ? error.message : "The request failed";
}

/** Frame and sprite sheet structure of one Working Draft, read from the persisted record. */
export function useFrameStructure(
	projectId: string,
	draftId: string,
	draftRevision: number
) {
	const queryClient = useQueryClient();
	const structureQuery = useQuery(
		frameStructureOptions(projectId, draftId, draftRevision)
	);
	const structure = structureQuery.data;
	// A 409 means the draft has no slicing yet, which is a normal empty state.
	const hasNoStructure =
		structureQuery.error instanceof ORPCError &&
		structureQuery.error.code === "CONFLICT";

	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: orpc.workingDrafts.key() });
	const onError = (error: unknown) => {
		toast.error(errorText(error));
		refresh();
	};

	const preview = useMutation(
		orpc.workingDrafts.previewSlicing.mutationOptions({
			onError: (error) => toast.error(errorText(error)),
		})
	);
	const slice = useMutation(
		orpc.workingDrafts.applySlicing.mutationOptions({
			onSuccess: refresh,
			onError,
		})
	);
	const edit = useMutation({
		mutationFn: async (operations: FrameOperation | FrameOperation[]) => {
			if (!structure) {
				throw new Error("The frame structure is not loaded yet");
			}
			// Each operation returns the next revision, so apply them in order.
			let view = structure;
			for (const operation of [operations].flat()) {
				// biome-ignore lint/performance/noAwaitInLoops: each operation needs the revision the previous one returned
				view = await applyFrameOperation(projectId, view, operation);
			}
			return view;
		},
		onSuccess: refresh,
		onError,
	});
	const commit = useMutation(
		orpc.workingDrafts.commitStructure.mutationOptions({
			onSuccess: async (result) => {
				await refresh();
				toast.success(
					`Composite Version created: ${result.createdUnitVersionIds.length} Unit Version(s) rebuilt, ${result.reusedUnitVersionIds.length} kept.`
				);
			},
			onError,
		})
	);

	return {
		commit,
		edit,
		hasNoStructure,
		isBusy:
			slice.isPending ||
			edit.isPending ||
			commit.isPending ||
			structureQuery.isFetching,
		preview,
		slice,
		structure,
		structureQuery,
	};
}
