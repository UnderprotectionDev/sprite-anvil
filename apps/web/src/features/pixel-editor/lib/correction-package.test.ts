import type { SheetStructureView } from "@sprite-anvil/api/pixel-editor-structure";
import { expect, test } from "vitest";
import {
	buildCorrectionPackageInput,
	type CorrectionPackageValues,
	defaultExpectedOutputStructure,
	defaultPreserveConstraint,
	defaultPreservedUnitIds,
	parseConstraintLines,
} from "./correction-package";

const draft = {
	assetRecordId: "11111111-1111-4111-8111-111111111111",
	id: "22222222-2222-4222-8222-222222222222",
	revision: 7,
	size: { height: 16, width: 32 },
	sourceAssetVersionId: "33333333-3333-4333-8333-333333333333",
};

const values: CorrectionPackageValues = {
	annotations: [],
	avoidConstraints: "",
	changeInstruction: "",
	expectedOutputStructure: "",
	issueNote: "Sword tip is clipped",
	preserveConstraints: "",
	preservedUnitVersionIds: ["unit-a", "unit-b"],
	redrawRegion: { height: 4, width: 4, x: 1, y: 1 },
	targetTask: "",
	targetUnitVersionId: null,
};

test("frames marked keep are proposed as preserved units", () => {
	const frame = (keep: boolean, unitVersionId: string | null) => ({
		keep,
		unitVersionId,
	});
	const structure = {
		frames: [frame(true, "unit-a"), frame(false, "unit-b"), frame(true, null)],
	} as unknown as SheetStructureView;
	expect(defaultPreservedUnitIds(structure)).toEqual(["unit-a"]);
	expect(defaultPreservedUnitIds(undefined)).toEqual([]);
});

test("constraint text is read one per line without blanks or repeats", () => {
	expect(
		parseConstraintLines(" Keep outline \n\nKEEP outline\nNo blue")
	).toEqual(["Keep outline", "No blue"]);
});

test("empty instruction fields fall back to sensible defaults and the issue note", () => {
	const input = buildCorrectionPackageInput(draft, "project-1", values);
	expect(input).toMatchObject({
		changeConstraints: ["Sword tip is clipped"],
		expectedOutputStructure: defaultExpectedOutputStructure,
		preserveConstraints: [defaultPreserveConstraint],
		avoidConstraints: [],
		targetTask: "Sword tip is clipped",
		targetDimensions: { height: 16, width: 32 },
		correction: { draft: { id: draft.id, revision: 7 } },
	});
});

test("written instructions replace the defaults and the target unit is never also preserved", () => {
	const input = buildCorrectionPackageInput(draft, "project-1", {
		...values,
		avoidConstraints: "No blue palette",
		changeInstruction: "Lengthen the blade",
		expectedOutputStructure: "Four-frame strip",
		preserveConstraints: "Keep the hilt\nKeep the outline",
		targetTask: "Fix the attack frame",
		targetUnitVersionId: "unit-b",
	});
	expect(input).toMatchObject({
		avoidConstraints: ["No blue palette"],
		changeConstraints: ["Lengthen the blade"],
		expectedOutputStructure: "Four-frame strip",
		lockedUnitVersionIds: ["unit-a"],
		preserveConstraints: ["Keep the hilt", "Keep the outline"],
		targetTask: "Fix the attack frame",
	});
});
