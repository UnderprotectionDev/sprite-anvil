import { expect, test } from "bun:test";
import {
	fixtureExportBundle as bundleOf,
	fixtureSource,
} from "../test-support/platform-equivalence-fixture";
import {
	compareEquivalenceEvidence,
	deriveEquivalenceEvidence,
	platformEquivalenceNotEvaluated,
} from "./platform-equivalence-comparison";

test("the same input produced on both surfaces compares as equivalent whatever the ids and times", async () => {
	const source = await fixtureSource();
	const web = await deriveEquivalenceEvidence(await bundleOf(source));
	const desktop = await deriveEquivalenceEvidence(
		await bundleOf(source, { createdAt: "2026-11-11T08:30:00.000Z" })
	);

	const result = compareEquivalenceEvidence(web, desktop);

	expect(result.outcome).toBe("equivalent");
	expect(result.sections.map((section) => section.result)).toEqual([
		"same",
		"same",
		"same",
	]);
});

test("a changed quality finding is reported as a difference of the quality section only", async () => {
	const source = await fixtureSource();
	const web = await deriveEquivalenceEvidence(await bundleOf(source));
	const desktop = await deriveEquivalenceEvidence(
		await bundleOf({
			...source,
			quality: [
				{
					assetFamilyId: "fam-1",
					assetVersionIds: ["av-1"],
					evidenceId: "ev-1",
					itemId: "idle",
					kind: "automated_check",
					observedValue: "12",
					rationale: "",
					result: "passed",
					ruleClass: null,
					ruleId: null,
					versionTarget: null,
				},
			],
		})
	);

	const result = compareEquivalenceEvidence(web, desktop);

	expect(result.outcome).toBe("different");
	const byName = Object.fromEntries(
		result.sections.map((section) => [section.section, section])
	);
	expect(byName.quality_evidence?.result).toBe("different");
	expect(byName.quality_evidence?.differences).toEqual(["qualityEvidence"]);
	expect(byName.authoritative_record?.result).toBe("same");
});

test("runs made from different inputs are not compared section by section", async () => {
	const source = await fixtureSource();
	const web = await deriveEquivalenceEvidence(await bundleOf(source));
	const desktop = await deriveEquivalenceEvidence(
		await bundleOf({
			...source,
			context: { revisionId: "ctx-2", revisionNumber: 5 },
		})
	);

	const result = compareEquivalenceEvidence(web, desktop);

	expect(result.outcome).toBe("inputs_differ");
	expect(result.sections.every((s) => s.result === "not_compared")).toBe(true);
});

test("a missing surface run names the missing surface and compares nothing", async () => {
	const web = await deriveEquivalenceEvidence(
		await bundleOf(await fixtureSource())
	);

	const result = compareEquivalenceEvidence(web, null);

	expect(result.outcome).toBe("missing_surface");
	expect(result.missingSurfaces).toEqual(["desktop"]);
	expect(compareEquivalenceEvidence(null, null).missingSurfaces).toEqual([
		"web",
		"desktop",
	]);
});

test("delivery lock, divergence and acceptance scenarios are listed as not evaluated", () => {
	expect(platformEquivalenceNotEvaluated).toEqual([
		"delivery_refresh_lock",
		"divergence",
		"reference_acceptance_scenarios",
		"extended_acceptance_scenarios",
	]);
});
