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
		accessibility: { desktop: "failed", web: "passed" },
	});
	const unmeasured = evaluatePlatformSupport({
		...input,
		accessibility: { web: "passed" },
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
		deliveryRefresh: { divergence: "different", lock: "not_evaluated" },
	});

	expect(result.blockers).toEqual([
		{ kind: "delivery_refresh", part: "lock", reason: "not_evaluated" },
		{ kind: "delivery_refresh", part: "divergence", reason: "different" },
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
