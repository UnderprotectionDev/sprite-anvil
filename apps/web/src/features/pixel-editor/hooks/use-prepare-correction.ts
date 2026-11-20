import type { GenerationPackageCreateInput } from "@sprite-anvil/api/generation-packages";
import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { usePendingIdempotencyKey } from "@/utils/pending-idempotency-key";
import { defaultPreservedUnitIds } from "../lib/correction-package";
import { frameStructureOptions } from "../lib/frame-structure-api";

/** Creates a Production Package for a selective correction; never touches the draft. */
export function usePrepareCorrection(projectId: string, draft: PixelDraft) {
	const versions = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	// Same key as useFrameStructure, so the panel and this form share one read.
	const structure = useQuery(
		frameStructureOptions(projectId, draft.id, draft.revision)
	);
	const units = (versions.data?.unitVersions ?? [])
		.filter((unit) => unit.assetRecordId === draft.assetRecordId)
		.map((unit) => ({
			id: unit.id,
			label: `${unit.unitType} ${unit.unitKey} v${unit.versionNumber}`,
		}));
	const pendingKey = usePendingIdempotencyKey();
	const mutation = useMutation(
		orpc.generationPackages.create.mutationOptions({
			meta: { errorPresentation: "inline" },
		})
	);
	return {
		units,
		keptUnitIds: defaultPreservedUnitIds(structure.data),
		prepare: {
			data: mutation.data,
			error: mutation.error,
			isError: mutation.isError,
			isPending: mutation.isPending,
			mutateAsync: async (request: GenerationPackageCreateInput) => {
				// A retry of the same correction reuses the key, so a lost response cannot add a second package.
				const result = await mutation.mutateAsync({
					...request,
					idempotencyKey: pendingKey.keyFor(JSON.stringify(request)),
				});
				pendingKey.clear();
				return result;
			},
		},
	};
}
