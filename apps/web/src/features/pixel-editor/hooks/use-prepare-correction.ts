import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { usePendingIdempotencyKey } from "@/utils/pending-idempotency-key";
import {
	buildCorrectionPackageInput,
	type CorrectionPackageValues,
	defaultPreservedUnitIds,
} from "../lib/correction-package";
import { readFrameStructure } from "../lib/frame-structure-api";

/** Creates a Production Package for a selective correction; never touches the draft. */
export function usePrepareCorrection(projectId: string, draft: PixelDraft) {
	const versions = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	// Same key as useFrameStructure, so the panel and this form share one read.
	const structure = useQuery({
		queryKey: [
			"pixel-editor",
			projectId,
			"structure",
			draft.id,
			draft.revision,
		],
		queryFn: () => readFrameStructure(projectId, draft.id),
		retry: false,
	});
	const units = (versions.data?.unitVersions ?? [])
		.filter((unit) => unit.assetRecordId === draft.assetRecordId)
		.map((unit) => ({
			id: unit.id,
			label: `${unit.unitType} ${unit.unitKey} v${unit.versionNumber}`,
		}));
	const pendingKey = usePendingIdempotencyKey();
	const mutation = useMutation(
		orpc.generationPackages.create.mutationOptions({
			meta: { suppressGlobalErrorToast: true },
		})
	);
	return {
		units,
		keptUnitIds: defaultPreservedUnitIds(structure.data),
		prepare: {
			error: mutation.error,
			isError: mutation.isError,
			isPending: mutation.isPending,
			mutateAsync: async (values: CorrectionPackageValues) => {
				const request = buildCorrectionPackageInput(draft, projectId, values);
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
