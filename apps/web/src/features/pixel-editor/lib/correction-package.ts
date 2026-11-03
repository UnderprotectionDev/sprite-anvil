import type { GenerationPackageCreateInput } from "@sprite-anvil/api/generation-packages";
import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import type { SheetStructureView } from "@sprite-anvil/api/pixel-editor-structure";

export const defaultExpectedOutputStructure =
	"Redraw only the marked region and return one image at the target size.";
export const defaultPreserveConstraint =
	"Do not change pixels outside the redraw region.";

type Correction = NonNullable<GenerationPackageCreateInput["correction"]>;

export interface CorrectionPackageValues {
	annotations: Correction["annotations"];
	avoidConstraints: string;
	changeInstruction: string;
	expectedOutputStructure: string;
	issueNote: string;
	preserveConstraints: string;
	preservedUnitVersionIds: string[];
	redrawRegion: Correction["redrawRegion"];
	targetTask: string;
	targetUnitVersionId: string | null;
}

/** Unit Versions of frames marked keep; they are proposed as preserved units. */
export function defaultPreservedUnitIds(
	structure: SheetStructureView | undefined
) {
	return (structure?.frames ?? []).flatMap((frame) =>
		frame.keep && frame.unitVersionId ? [frame.unitVersionId] : []
	);
}

/** One constraint per line; blank lines and case-insensitive repeats are dropped. */
export function parseConstraintLines(text: string) {
	const seen = new Set<string>();
	const lines: string[] = [];
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		const key = line.toLocaleLowerCase("tr-TR");
		if (line && !seen.has(key)) {
			seen.add(key);
			lines.push(line);
		}
	}
	return lines;
}

/** The Production Package request for a correction; empty text fields fall back to the issue note or the defaults. */
export function buildCorrectionPackageInput(
	draft: Pick<
		PixelDraft,
		"assetRecordId" | "id" | "revision" | "size" | "sourceAssetVersionId"
	>,
	projectId: string,
	values: CorrectionPackageValues
): GenerationPackageCreateInput {
	const preserve = parseConstraintLines(values.preserveConstraints);
	return {
		assetRecordId: draft.assetRecordId,
		avoidConstraints: parseConstraintLines(values.avoidConstraints),
		changeConstraints: [values.changeInstruction.trim() || values.issueNote],
		correction: {
			annotations: values.annotations,
			draft: { id: draft.id, revision: draft.revision },
			issueNote: values.issueNote,
			redrawRegion: values.redrawRegion,
			sourceAssetVersionId: draft.sourceAssetVersionId,
			targetUnitVersionId: values.targetUnitVersionId,
		},
		expectedOutputStructure:
			values.expectedOutputStructure.trim() || defaultExpectedOutputStructure,
		lockedUnitVersionIds: values.preservedUnitVersionIds.filter(
			(id) => id !== values.targetUnitVersionId
		),
		preserveConstraints:
			preserve.length > 0 ? preserve : [defaultPreserveConstraint],
		projectId,
		targetDimensions: draft.size,
		targetTask: values.targetTask.trim() || values.issueNote,
	};
}
