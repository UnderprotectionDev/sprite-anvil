import { expect, test } from "bun:test";
import {
	isAvailableQualityVersionTarget,
	readAssessmentQualityVersionTarget,
} from "./quality-version-targets";

const itemId = "item-result";

interface FixtureEvidenceRow {
	compositeVersionId: string | null;
	itemId: string;
	kind: string;
	unitVersionId: string | null;
}

function evidenceRow(input: {
	compositeVersionId?: string | null;
	itemId?: string;
	kind?: string;
	unitVersionId: string | null;
}): FixtureEvidenceRow {
	return {
		compositeVersionId: input.compositeVersionId ?? null,
		itemId: input.itemId ?? itemId,
		kind: input.kind ?? "quality",
		unitVersionId: input.unitVersionId,
	};
}

test("anchors currency to the newest measurement of the assessed exact version", () => {
	const anchor = readAssessmentQualityVersionTarget(
		[
			evidenceRow({ unitVersionId: "unit-replacement" }),
			evidenceRow({ unitVersionId: "unit-exact" }),
		],
		itemId,
		[{ kind: "unit", id: "unit-exact" }]
	);
	expect(anchor).toEqual({ kind: "unit", id: "unit-exact" });
});

test("reports no anchor when only measurements of other versions exist", () => {
	expect(
		readAssessmentQualityVersionTarget(
			[evidenceRow({ unitVersionId: "unit-replacement" })],
			itemId,
			[{ kind: "unit", id: "unit-exact" }]
		)
	).toBeNull();
});

test("skips evidence of other items and non-quality kinds", () => {
	expect(
		readAssessmentQualityVersionTarget(
			[
				evidenceRow({ itemId: "item-other", unitVersionId: "unit-exact" }),
				evidenceRow({ kind: "usage_test", unitVersionId: null }),
			],
			itemId,
			[{ kind: "unit", id: "unit-exact" }]
		)
	).toBeNull();
});

test("matches availability by target kind and id", () => {
	expect(
		isAvailableQualityVersionTarget({ kind: "composite", id: "composite-1" }, [
			{ kind: "unit", id: "unit-exact" },
			{ kind: "composite", id: "composite-1" },
		])
	).toBe(true);
	expect(
		isAvailableQualityVersionTarget({ kind: "unit", id: "unit-exact" }, [
			{ kind: "unit", id: "unit-replacement" },
		])
	).toBe(false);
	expect(
		isAvailableQualityVersionTarget(null, [{ kind: "unit", id: "unit-exact" }])
	).toBe(false);
});
