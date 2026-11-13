/**
 * Test fixture and harness for the platform support gate. Each surface runs
 * every acceptance scenario against one exact input; the harness compares the
 * two surfaces' evidence per scenario with the Phase 3 comparison contract.
 * The scenario inputs here are synthetic stand-ins built from the Export
 * Bundle fixture, not the RAS/YAS scenario data. Never imported by product code.
 */
import {
	compareEquivalenceEvidence,
	deriveEquivalenceEvidence,
	type PlatformEquivalenceEvidence,
} from "../src/platform-equivalence-comparison";
import {
	type AcceptanceScenarioId,
	acceptanceScenarioIds,
	ops04EvidenceSources,
	type PlatformSupportInput,
} from "../src/platform-support-gate";
import {
	fixtureExportBundle,
	fixtureSource,
} from "./platform-equivalence-fixture";

type ExportBundleSource = Awaited<ReturnType<typeof fixtureSource>>;

export type ScenarioRuns = Partial<
	Record<AcceptanceScenarioId, PlatformEquivalenceEvidence>
>;

/** One surface's evidence for every scenario; `changedScenario` gets one extra quality finding. */
export async function fixtureScenarioRuns(
	source: ExportBundleSource,
	options: { changedScenario?: AcceptanceScenarioId } = {}
): Promise<ScenarioRuns> {
	const entries = await Promise.all(
		acceptanceScenarioIds.map(async (id) => {
			const scenarioSource: ExportBundleSource =
				id === options.changedScenario
					? {
							...source,
							quality: [
								{
									assetFamilyId: "fam-1",
									assetVersionIds: ["av-1"],
									evidenceId: "ev-changed",
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
						}
					: source;
			const evidence = await deriveEquivalenceEvidence(
				await fixtureExportBundle(scenarioSource)
			);
			return [id, evidence] as const;
		})
	);
	return Object.fromEntries(entries);
}

/** Compares the two surfaces scenario by scenario; each result is bound to its scenario and carries an evidence reference. A scenario run on neither surface is left out. */
export function compareScenarioRuns(
	web: ScenarioRuns,
	desktop: ScenarioRuns
): NonNullable<PlatformSupportInput["scenarioComparisons"]> {
	const comparisons: NonNullable<PlatformSupportInput["scenarioComparisons"]> =
		{};
	for (const id of acceptanceScenarioIds) {
		const left = web[id] ?? null;
		const right = desktop[id] ?? null;
		if (left || right) {
			comparisons[id] = {
				comparison: compareEquivalenceEvidence(left, right),
				evidenceRef: `fixture://scenario/${id}`,
				scenarioId: id,
			};
		}
	}
	return comparisons;
}

const publishedAt = "2026-11-13T09:00:00.000Z";

/**
 * A synthetic combination whose every gate input passes. The OV parameters are
 * placeholders for the test only; they are not proposed limits.
 */
export async function fixtureSupportInput(): Promise<
	Required<PlatformSupportInput>
> {
	const source = await fixtureSource();
	const [web, desktop] = await Promise.all([
		fixtureScenarioRuns(source),
		fixtureScenarioRuns(source),
	]);
	const published = (name: string) => ({
		evidenceRef: `fixture://${name}`,
		parameters: { fixture: name },
		publishedAt,
	});
	return {
		accessibility: {
			desktop: {
				evidenceRef: ops04EvidenceSources.desktop,
				result: "passed",
			},
			web: { evidenceRef: ops04EvidenceSources.web, result: "passed" },
		},
		combinationId: "fixture-combination",
		deliveryRefresh: {
			divergence: { evidenceRef: "fixture://divergence", result: "same" },
			lock: { evidenceRef: "fixture://lock", result: "same" },
		},
		openValidations: {
			"OV-08": published("ov-08"),
			"OV-09": published("ov-09"),
			"OV-10": published("ov-10"),
			"OV-11": published("ov-11"),
		},
		scenarioComparisons: compareScenarioRuns(web, desktop),
	};
}
