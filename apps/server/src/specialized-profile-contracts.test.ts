import { expect, test } from "bun:test";
import {
	readinessEvidenceInputSchema,
	requiredSetItemSchema,
} from "@sprite-anvil/api/family-readiness";
import {
	assessProfileQualityReadiness,
	isProfileQualityEvidenceValid,
	specializedProfileContractTemplates,
} from "@sprite-anvil/api/specialized-profile-contracts";

test("publishes an immutable Specialized Profile Contract template for all eight profiles", () => {
	expect(specializedProfileContractTemplates).toHaveLength(8);
	for (const contract of specializedProfileContractTemplates) {
		expect(contract.revisionNumber).toBe(1);
		expect(contract.rules.map((rule) => rule.class)).toEqual(
			expect.arrayContaining([
				"integrity_gate",
				"waivable_requirement",
				"quality_advisory",
				"human_review",
			])
		);
		expect(contract.usageTests.length).toBeGreaterThan(0);
		expect(contract.exportMappings.length).toBeGreaterThan(0);
	}
});

test("only current passing evidence for every required contract rule yields Export Ready", () => {
	const [contract] = specializedProfileContractTemplates;
	expect(contract).toBeDefined();
	if (!contract) {
		return;
	}
	const requiredRules = contract.rules.filter(
		(rule) => rule.required && rule.class !== "quality_advisory"
	);
	const results = new Map<
		string,
		"passed" | "failed" | "inconclusive" | "waived"
	>(requiredRules.map((rule) => [rule.id, "passed"]));
	const usageTests = new Map(
		contract.usageTests
			.filter((usageTest) => usageTest.required)
			.map((usageTest) => [usageTest.id, "passed" as const])
	);

	expect(
		assessProfileQualityReadiness(contract, results, usageTests).status
	).toBe("export_ready");
	const integrityRule = requiredRules.find(
		(rule) => rule.class === "integrity_gate"
	);
	if (!integrityRule) {
		return;
	}
	results.delete(integrityRule.id);
	expect(
		assessProfileQualityReadiness(contract, results, usageTests).status
	).toBe("blocked");
	expect(
		assessProfileQualityReadiness(contract, results, usageTests)
			.outstandingRuleIds
	).toContain(integrityRule.id);
	results.set(integrityRule.id, "failed");
	expect(
		assessProfileQualityReadiness(contract, results, usageTests).status
	).toBe("blocked");
});

test("quality advisories do not block readiness and waivers are only eligible on measurable requirements", () => {
	for (const contract of specializedProfileContractTemplates) {
		const advisory = contract.rules.find(
			(rule) => rule.class === "quality_advisory"
		);
		const waivable = contract.rules.find(
			(rule) => rule.class === "waivable_requirement"
		);
		expect(advisory?.required).toBe(false);
		expect(advisory?.waiverEligible).toBe(false);
		expect(waivable?.waiverEligible).toBe(true);
	}
});

test("measurable rule evidence requires an observed value for every result", () => {
	const [contract] = specializedProfileContractTemplates;
	if (!contract) {
		return;
	}
	const measuredRule = contract.rules.find(
		(rule) => rule.class === "waivable_requirement"
	);
	const integrityRule = contract.rules.find(
		(rule) => rule.class === "integrity_gate"
	);
	const reviewRule = contract.rules.find(
		(rule) => rule.class === "human_review"
	);
	if (!(measuredRule && integrityRule && reviewRule)) {
		return;
	}

	expect(
		isProfileQualityEvidenceValid({ rule: measuredRule, result: "passed" })
	).toBe(false);
	expect(
		isProfileQualityEvidenceValid({
			rule: measuredRule,
			result: "passed",
			observedValue: "32 milliseconds",
		})
	).toBe(true);
	expect(
		isProfileQualityEvidenceValid({
			rule: integrityRule,
			result: "waived",
		})
	).toBe(false);
	expect(
		isProfileQualityEvidenceValid({
			rule: integrityRule,
			result: "passed",
			observedValue: "verified",
		})
	).toBe(true);
	expect(
		isProfileQualityEvidenceValid({
			rule: reviewRule,
			result: "waived",
			observedValue: "review deferred",
		})
	).toBe(false);
});

test("only a passed eligible measurement waiver yields Exceptions Ready", () => {
	const [contract] = specializedProfileContractTemplates;
	expect(contract).toBeDefined();
	if (!contract) {
		return;
	}
	const results = new Map<
		string,
		"passed" | "failed" | "inconclusive" | "waived"
	>();
	for (const rule of contract.rules) {
		if (rule.required && rule.class !== "quality_advisory") {
			results.set(
				rule.id,
				rule.class === "waivable_requirement" ? "waived" : "passed"
			);
		}
	}
	const usageTests = new Map(
		contract.usageTests
			.filter((usageTest) => usageTest.required)
			.map((usageTest) => [usageTest.id, "passed" as const])
	);
	expect(
		assessProfileQualityReadiness(contract, results, usageTests).status
	).toBe("exceptions_ready");
	usageTests.delete(contract.usageTests[0]?.id ?? "");
	expect(
		assessProfileQualityReadiness(contract, results, usageTests).status
	).toBe("blocked");
});

test("required usage evidence identifies its test and a waiver records its observed value", () => {
	const usageItem = {
		id: "scene-transition",
		kind: "usage_test" as const,
		name: "Scene transition",
		disposition: "required" as const,
		assetRecordIds: ["asset-record-1"],
	};
	expect(requiredSetItemSchema.safeParse(usageItem).success).toBe(false);
	expect(
		requiredSetItemSchema.safeParse({
			...usageItem,
			testId: "character_creature_animation.scene_transition",
		}).success
	).toBe(true);

	const waiver = {
		projectId: "project-1",
		assetFamilyId: "family-1",
		revisionId: "required-set-1",
		itemId: "east-facing",
		kind: "quality" as const,
		result: "waived" as const,
		ruleId: "icon.measurable-tolerance",
		method: "Measured at native size.",
		rationale: "The small offset is accepted for this exact version.",
	};
	expect(readinessEvidenceInputSchema.safeParse(waiver).success).toBe(false);
	expect(
		readinessEvidenceInputSchema.safeParse({
			...waiver,
			observedValue: "1.5 px",
		}).success
	).toBe(true);
});
