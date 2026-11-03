import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export type CorrectionAnnotation = NonNullable<
	GenerationPackage["correction"]
>["annotations"][number];

export interface PrepareCorrectionValues {
	annotations: CorrectionAnnotation[];
	issueNote: string;
	preservedUnitVersionIds: string[];
	redrawRegion: { height: number; width: number; x: number; y: number };
	targetUnitVersionId: string | null;
}

/** Creates a Production Package for a selective correction; never touches the draft. */
export function usePrepareCorrection(projectId: string, draft: PixelDraft) {
	const versions = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	const units = (versions.data?.unitVersions ?? [])
		.filter((unit) => unit.assetRecordId === draft.assetRecordId)
		.map((unit) => ({
			id: unit.id,
			label: `${unit.unitType} ${unit.unitKey} v${unit.versionNumber}`,
		}));
	const mutation = useMutation(
		orpc.generationPackages.create.mutationOptions({
			meta: { suppressGlobalErrorToast: true },
		})
	);
	return {
		units,
		prepare: {
			error: mutation.error,
			isError: mutation.isError,
			isPending: mutation.isPending,
			mutateAsync: (values: PrepareCorrectionValues) =>
				mutation.mutateAsync({
					assetRecordId: draft.assetRecordId,
					avoidConstraints: [],
					changeConstraints: [values.issueNote],
					correction: {
						annotations: values.annotations,
						issueNote: values.issueNote,
						redrawRegion: values.redrawRegion,
						sourceAssetVersionId: draft.sourceAssetVersionId,
						targetUnitVersionId: values.targetUnitVersionId,
					},
					expectedOutputStructure:
						"Redraw only the marked region and return one image at the target size.",
					lockedUnitVersionIds: values.preservedUnitVersionIds,
					preserveConstraints: [
						"Do not change pixels outside the redraw region.",
					],
					projectId,
					targetDimensions: draft.size,
					targetTask: values.issueNote,
				}),
		},
	};
}
