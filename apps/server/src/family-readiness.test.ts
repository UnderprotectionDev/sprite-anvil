import { expect, test } from "bun:test";
import {
	assessGeneralAssetSupport,
	evaluateFamilyReadiness,
	isReadinessEvidenceCurrent,
} from "@sprite-anvil/api/family-readiness";

const readyAsset = {
	applicability: "applicable",
	integrityVerified: true,
	qualityReadiness: "export_ready",
	reviewDisposition: "approved",
} as const;

test("a family is complete only when active required items have current evidence", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-2",
		items: [
			{
				id: "east-facing",
				kind: "direction",
				disposition: "required",
				profileContractActive: true,
				asset: readyAsset,
			},
			{
				id: "scene-transition",
				kind: "usage_test",
				disposition: "required",
				profileContractActive: true,
				asset: readyAsset,
				usageTestStatus: "passed",
			},
		],
	});

	expect(result.status).toBe("complete");
});

test("stale applicability and missing quality evidence keep a required item incomplete", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-2",
		items: [
			{
				id: "east-facing",
				kind: "direction",
				disposition: "required",
				asset: {
					...readyAsset,
					applicability: "revalidation_required",
					qualityReadiness: "not_assessed",
				},
			},
		],
	});

	expect(result.status).toBe("incomplete");
	expect(result.items[0]?.blockers).toEqual(
		expect.arrayContaining(["applicability", "quality"])
	);
	expect(result.items[0]?.blockers).toContain("quality_contract");
});

test("optional and inapplicable entries do not block family completion", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-2",
		items: [
			{
				id: "north-facing",
				kind: "direction",
				disposition: "optional",
				asset: null,
			},
			{
				id: "damaged-state",
				kind: "state",
				disposition: "inapplicable",
				asset: null,
			},
		],
	});

	expect(result.status).toBe("complete");
});

test("approval and integrity alone cannot complete a required item or usage test", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-3",
		items: [
			{
				id: "east-facing",
				kind: "direction",
				disposition: "required",
				asset: {
					applicability: "not_assessed",
					integrityVerified: true,
					qualityReadiness: "not_assessed",
					reviewDisposition: "approved",
				},
			},
			{
				id: "combat-scene",
				kind: "usage_test",
				disposition: "required",
				profileContractActive: false,
				usageTestStatus: "not_assessed",
			},
			{
				id: "combat-scene-passed",
				kind: "usage_test",
				disposition: "required",
				profileContractActive: false,
				usageTestStatus: "passed",
			},
		],
	});

	expect(result.status).toBe("incomplete");
	expect(result.items[0]?.blockers).toEqual(
		expect.arrayContaining(["applicability", "quality", "quality_contract"])
	);
	expect(result.items[1]?.blockers).toContain("usage_test");
	expect(result.items[2]?.blockers).toContain("quality_contract");
});

test("a Specialized Profile Contract is required even when quality evidence passed", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-4",
		items: [
			{
				id: "east-facing",
				kind: "direction",
				disposition: "required",
				profileContractActive: false,
				asset: readyAsset,
			},
		],
	});

	expect(result.status).toBe("incomplete");
	expect(result.items[0]?.blockers).toContain("quality_contract");
});

test("a required usage test blocks Specialized Profile readiness until it passes", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-5",
		items: [
			{
				id: "east-facing",
				kind: "direction",
				disposition: "required",
				profileContractActive: true,
				profileUsageTestsComplete: false,
				asset: {
					...readyAsset,
					qualityReadiness: "blocked",
				},
			},
		],
	});

	expect(result.status).toBe("incomplete");
	expect(result.items[0]?.blockers).toEqual(
		expect.arrayContaining(["quality", "profile_contract_usage_test"])
	);
});

test("a passing required usage test still needs its asset to be current and export-ready", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-7",
		items: [
			{
				id: "scene-transition",
				kind: "usage_test",
				disposition: "required",
				profileContractActive: true,
				profileContractUsageTest: true,
				profileUsageTestsComplete: true,
				usageTestStatus: "passed",
				asset: {
					applicability: "not_assessed",
					integrityVerified: false,
					qualityReadiness: "blocked",
					reviewDisposition: "candidate",
				},
			},
		],
	});

	expect(result.status).toBe("incomplete");
	expect(result.items[0]?.blockers).toEqual(
		expect.arrayContaining([
			"approval",
			"integrity",
			"applicability",
			"quality",
		])
	);
});

test("a passing required usage test cannot stand in for its missing asset version", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-8",
		items: [
			{
				id: "scene-transition",
				kind: "usage_test",
				disposition: "required",
				profileContractActive: true,
				profileContractUsageTest: true,
				profileUsageTestsComplete: true,
				usageTestStatus: "passed",
				asset: null,
			},
		],
	});

	expect(result.status).toBe("incomplete");
	expect(result.items[0]?.blockers).toEqual(
		expect.arrayContaining(["asset_version", "applicability", "quality"])
	);
});

test("a passing general usage test cannot create export-ready quality", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-9",
		items: [
			{
				id: "general-usage",
				kind: "usage_test",
				disposition: "required",
				profileContractActive: true,
				profileContractUsageTest: true,
				usageTestStatus: "passed",
				asset: {
					...readyAsset,
					qualityReadiness: "not_assessed",
				},
			},
		],
	});

	expect(result.status).toBe("incomplete");
	expect(result.items[0]?.blockers).toContain("quality");
});

test("required profile usage tests still block a passing Required Set usage test", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-10",
		items: [
			{
				id: "scene-transition",
				kind: "usage_test",
				disposition: "required",
				profileContractActive: true,
				profileContractUsageTest: true,
				profileUsageTestsComplete: false,
				usageTestStatus: "passed",
				asset: readyAsset,
			},
		],
	});

	expect(result.status).toBe("incomplete");
	expect(result.items[0]?.blockers).toContain("profile_contract_usage_test");
});

test("an eligible waiver preserves exception status without completing a family", () => {
	const result = evaluateFamilyReadiness({
		activeRequiredSetRevisionId: "required-set-6",
		items: [
			{
				id: "east-facing",
				kind: "direction",
				disposition: "required",
				profileContractActive: true,
				profileUsageTestsComplete: true,
				asset: {
					...readyAsset,
					qualityReadiness: "exceptions_ready",
				},
			},
		],
	});

	expect(result.status).toBe("incomplete");
	expect(result.items[0]?.blockers).toContain("quality");
	expect(result.items[0]?.status).toBe("incomplete");
});

test("General Asset Support evidence never creates export readiness", () => {
	const assessment = assessGeneralAssetSupport({
		isCurrent: true,
		result: "passed",
	});
	expect(assessment.qualityReadiness).toBe("not_assessed");
	expect(assessment.qualityRequirements).toEqual([
		expect.objectContaining({
			class: "general_asset_support",
			isCurrent: true,
			required: false,
			result: "passed",
		}),
	]);
});

test("readiness evidence becomes stale when its version, context, or canonical design changes", () => {
	const pinnedScope = {
		assetVersionIds: ["asset-version-1"],
		contextRevisionId: "context-revision-1",
		visualWorldId: "visual-world-1",
		useContext: "combat",
		canonicalDesignVersionId: "canonical-version-1",
	};

	expect(isReadinessEvidenceCurrent(pinnedScope, pinnedScope)).toBe(true);
	expect(
		isReadinessEvidenceCurrent(pinnedScope, {
			...pinnedScope,
			assetVersionIds: ["asset-version-2"],
		})
	).toBe(false);
	expect(
		isReadinessEvidenceCurrent(pinnedScope, {
			...pinnedScope,
			contextRevisionId: "context-revision-2",
		})
	).toBe(false);
	expect(
		isReadinessEvidenceCurrent(pinnedScope, {
			...pinnedScope,
			canonicalDesignVersionId: null,
		})
	).toBe(false);
});

test("readiness evidence remains current when no canonical design is selected", () => {
	const scopeWithoutCanonicalDesign = {
		assetVersionIds: ["asset-version-1"],
		contextRevisionId: "context-revision-1",
		visualWorldId: "visual-world-1",
		useContext: "combat",
		canonicalDesignVersionId: null,
	};

	expect(
		isReadinessEvidenceCurrent(
			scopeWithoutCanonicalDesign,
			scopeWithoutCanonicalDesign
		)
	).toBe(true);
});

test("profile-bound evidence becomes stale when its contract revision changes", () => {
	const pinnedScope = {
		assetVersionIds: ["asset-version-1"],
		profileContractRevisionIds: ["profile-contract-1"],
		contextRevisionId: "context-revision-1",
		visualWorldId: "visual-world-1",
		useContext: "combat",
		canonicalDesignVersionId: null,
	};

	expect(isReadinessEvidenceCurrent(pinnedScope, pinnedScope)).toBe(true);
	expect(
		isReadinessEvidenceCurrent(pinnedScope, {
			...pinnedScope,
			profileContractRevisionIds: ["profile-contract-2"],
		})
	).toBe(false);
});
