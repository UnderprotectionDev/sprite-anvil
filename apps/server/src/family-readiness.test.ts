import { expect, test } from "bun:test";
import {
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
				asset: readyAsset,
			},
			{
				id: "scene-transition",
				kind: "usage_test",
				disposition: "required",
				profileContractActive: true,
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
