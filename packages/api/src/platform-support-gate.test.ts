import { expect, test } from "bun:test";
import { fixtureSource } from "../test-support/platform-equivalence-fixture";
import {
	compareScenarioRuns,
	fixtureScenarioRuns,
	fixtureSupportInput,
} from "../test-support/platform-support-fixture";
import {
	acceptanceScenarioIds,
	evaluatePlatformSupport,
	openValidationIds,
	summarizePlatformSupport,
} from "./platform-support-gate";

test("a combination with every scenario equivalent, accessibility passed and OV-08 to OV-11 published is supported", async () => {
	const result = evaluatePlatformSupport(await fixtureSupportInput());

	expect(result.status).toBe("supported");
	expect(result.blockers).toEqual([]);
});

test("a combination with no evidence is unmeasured and lists every missing piece", () => {
	const result = evaluatePlatformSupport({ combinationId: "none" });

	expect(result.status).toBe("unmeasured");
	const scenarios = result.blockers.filter(
		(blocker) => blocker.kind === "scenario"
	);
	expect(scenarios.map((blocker) => blocker.id)).toEqual([
		...acceptanceScenarioIds,
	]);
	expect(result.blockers).toContainEqual({
		kind: "delivery_refresh",
		part: "lock",
		reason: "not_evaluated",
	});
	expect(result.blockers).toContainEqual({
		kind: "delivery_refresh",
		part: "divergence",
		reason: "not_evaluated",
	});
	expect(result.blockers).toContainEqual({
		kind: "accessibility",
		reason: "not_measured",
		surface: "web",
	});
	expect(
		result.blockers
			.filter((blocker) => blocker.kind === "open_validation")
			.map((blocker) => blocker.id)
	).toEqual([...openValidationIds]);
});

test("one scenario that differs between the surfaces keeps the combination unmeasured", async () => {
	const source = await fixtureSource();
	const web = await fixtureScenarioRuns(source);
	const desktop = await fixtureScenarioRuns(source, {
		changedScenario: "RAS-03",
	});
	const input = await fixtureSupportInput();

	const result = evaluatePlatformSupport({
		...input,
		scenarioComparisons: compareScenarioRuns(web, desktop),
	});

	expect(result.status).toBe("unmeasured");
	expect(result.blockers).toEqual([
		{ id: "RAS-03", kind: "scenario", reason: "different" },
	]);
});

test("a scenario run on one surface only is a missing surface, not a pass", async () => {
	const source = await fixtureSource();
	const web = await fixtureScenarioRuns(source);
	const input = await fixtureSupportInput();

	const result = evaluatePlatformSupport({
		...input,
		scenarioComparisons: compareScenarioRuns(web, {}),
	});

	expect(result.status).toBe("unmeasured");
	expect(result.blockers.every((blocker) => blocker.kind === "scenario")).toBe(
		true
	);
	expect(result.blockers).toContainEqual({
		id: "8.1",
		kind: "scenario",
		reason: "missing_surface",
	});
});

test("a failed or unmeasured accessibility result on either surface blocks support", async () => {
	const input = await fixtureSupportInput();

	const failed = evaluatePlatformSupport({
		...input,
		accessibility: {
			desktop: { evidenceRef: "spec://desktop", result: "failed" },
			web: { evidenceRef: "spec://web", result: "passed" },
		},
	});
	const unmeasured = evaluatePlatformSupport({
		...input,
		accessibility: { web: { evidenceRef: "spec://web", result: "passed" } },
	});

	expect(failed.blockers).toEqual([
		{ kind: "accessibility", reason: "failed", surface: "desktop" },
	]);
	expect(unmeasured.blockers).toEqual([
		{ kind: "accessibility", reason: "not_measured", surface: "desktop" },
	]);
});

test("an open validation counts as published only with parameters and evidence", async () => {
	const input = await fixtureSupportInput();
	const published = input.openValidations?.["OV-10"];
	if (!published) {
		throw new Error("Fixture lacks OV-10.");
	}

	const emptyParameters = evaluatePlatformSupport({
		...input,
		openValidations: {
			...input.openValidations,
			"OV-10": { ...published, parameters: {} },
		},
	});
	const noEvidence = evaluatePlatformSupport({
		...input,
		openValidations: {
			...input.openValidations,
			"OV-10": { ...published, evidenceRef: "" },
		},
	});
	const missing = evaluatePlatformSupport({
		...input,
		openValidations: { ...input.openValidations, "OV-10": undefined },
	});

	for (const result of [emptyParameters, noEvidence, missing]) {
		expect(result.status).toBe("unmeasured");
		expect(result.blockers).toEqual([
			{ id: "OV-10", kind: "open_validation", reason: "not_published" },
		]);
	}
});

test("a delivery refresh lock or divergence that differs or is not evaluated blocks support", async () => {
	const input = await fixtureSupportInput();

	const result = evaluatePlatformSupport({
		...input,
		deliveryRefresh: {
			divergence: { evidenceRef: "ref://divergence", result: "different" },
			lock: { evidenceRef: "ref://lock", result: "not_evaluated" },
		},
	});

	expect(result.blockers).toEqual([
		{ kind: "delivery_refresh", part: "lock", reason: "not_evaluated" },
		{ kind: "delivery_refresh", part: "divergence", reason: "different" },
	]);
});

test("a scenario comparison counts only for the scenario it is bound to", async () => {
	const input = await fixtureSupportInput();
	const ras01 = input.scenarioComparisons["RAS-01"];

	const result = evaluatePlatformSupport({
		...input,
		scenarioComparisons: {
			...input.scenarioComparisons,
			"RAS-02": ras01,
		},
	});

	expect(result.status).toBe("unmeasured");
	expect(result.blockers).toEqual([
		{ id: "RAS-02", kind: "scenario", reason: "not_bound_to_scenario" },
	]);
});

test("a Phase 3 interim comparison without a scenario id is never scenario evidence", async () => {
	const input = await fixtureSupportInput();
	const interim = {
		comparison: input.scenarioComparisons["RAS-01"]?.comparison,
	};
	const scenarioComparisons = Object.fromEntries(
		acceptanceScenarioIds.map((id) => [id, interim])
	) as unknown as typeof input.scenarioComparisons;

	const result = evaluatePlatformSupport({ ...input, scenarioComparisons });

	expect(result.status).toBe("unmeasured");
	expect(result.blockers).toEqual(
		acceptanceScenarioIds.map((id) => ({
			id,
			kind: "scenario",
			reason: "not_bound_to_scenario",
		}))
	);
});

test("an equivalent scenario, passed accessibility or same lock and divergence without an evidence reference stays blocked", async () => {
	const input = await fixtureSupportInput();
	const ras03 = input.scenarioComparisons["RAS-03"];
	if (!ras03) {
		throw new Error("Fixture lacks RAS-03.");
	}

	const result = evaluatePlatformSupport({
		...input,
		accessibility: {
			desktop: { evidenceRef: " ", result: "passed" },
			web: input.accessibility.web,
		},
		deliveryRefresh: {
			divergence: { evidenceRef: "", result: "same" },
			lock: input.deliveryRefresh.lock,
		},
		scenarioComparisons: {
			...input.scenarioComparisons,
			"RAS-03": { ...ras03, evidenceRef: "" },
		},
	});

	expect(result.blockers).toEqual([
		{ id: "RAS-03", kind: "scenario", reason: "no_evidence_ref" },
		{ kind: "delivery_refresh", part: "divergence", reason: "no_evidence_ref" },
		{ kind: "accessibility", reason: "no_evidence_ref", surface: "desktop" },
	]);
});

test("with no published Supported Platform Matrix nothing is supported and OV-08 to OV-11 are open", () => {
	const summary = summarizePlatformSupport({});

	expect(summary.combinations).toEqual([]);
	expect(summary.supportedCount).toBe(0);
	expect(summary.openValidations).toEqual(
		openValidationIds.map((id) => ({ id, state: "open" }))
	);
});

test("the summary counts a combination as supported only when the gate does", async () => {
	const input = await fixtureSupportInput();

	const summary = summarizePlatformSupport({
		combinations: [input, { combinationId: "unmeasured-one" }],
		openValidations: input.openValidations,
	});

	expect(summary.supportedCount).toBe(1);
	expect(summary.combinations.map((combination) => combination.status)).toEqual(
		["supported", "unmeasured"]
	);
	expect(
		summary.openValidations.every(
			(validation) => validation.state === "published"
		)
	).toBe(true);
});
