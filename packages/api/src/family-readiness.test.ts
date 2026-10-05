import { expect, test } from "bun:test";
import type { ReadinessEvidenceInput } from "./family-readiness";
import {
	objectSceneUsageTestId,
	readinessEvidenceInputSchema,
	readinessEvidenceSchema,
} from "./family-readiness";
import { specializedProfileContractCatalog } from "./specialized-profile-contracts";

test("shares the object scene usage test id with the object profile contract", () => {
	const objectProfile = specializedProfileContractCatalog.find(
		(contract) => contract.profileId === "object_weapon_equipment_states"
	);
	expect(
		objectProfile?.usageTests.some(
			(usage) => usage.id === objectSceneUsageTestId
		)
	).toBe(true);
});

test("requires project grid cell dimensions for every usage test evidence input", () => {
	const input = {
		projectId: "project-1",
		assetFamilyId: "icon-family-1",
		revisionId: "revision-1",
		itemId: "target-size-backgrounds",
		kind: "usage_test",
		result: "passed",
		testId: "icon.light_dark_target_size",
		method: "Reviewed the icon at target sizes.",
		rationale: "The icon remains readable.",
	};

	expect(readinessEvidenceInputSchema.safeParse(input).success).toBe(false);
	expect(
		readinessEvidenceInputSchema.safeParse({
			...input,
			usageTestContext: {
				cellDimensions: { width: 32, height: 32 },
			},
		}).success
	).toBe(true);
});

test("pins the object placement test scene context in its usage evidence input", () => {
	const input: Extract<ReadinessEvidenceInput, { kind: "usage_test" }> = {
		projectId: "project-1",
		assetFamilyId: "object-family-1",
		revisionId: "revision-1",
		itemId: "placement-test",
		kind: "usage_test",
		result: "passed",
		testId: "object.approved_character_ground_scene",
		method: "Placed the object beside the approved character on both grounds.",
		rationale: "The object keeps its declared scale and ground contact.",
		usageTestContext: {
			cellDimensions: { width: 32, height: 48 },
			approvedCharacterVersionId: "character-version-1",
			targetGroundVersionIds: ["grass-version-1", "stone-version-1"],
		},
	};

	expect(readinessEvidenceInputSchema.parse(input)).toEqual(input);
	expect(
		readinessEvidenceSchema.parse({
			id: "evidence-1",
			projectId: input.projectId,
			assetFamilyId: input.assetFamilyId,
			revisionId: input.revisionId,
			itemId: input.itemId,
			kind: input.kind,
			result: input.result,
			assetVersionIds: ["object-version-1"],
			profileContractRevisionIds: ["object@1"],
			contextRevisionId: "context-1",
			visualWorldId: "world-1",
			useContext: "combat",
			canonicalDesignVersionId: null,
			ruleId: null,
			ruleClass: null,
			testId: input.testId,
			usageTestContext: input.usageTestContext,
			observedValue: null,
			versionTarget: null,
			method: input.method,
			rationale: input.rationale,
			createdAt: "2026-10-05T09:00:00.000Z",
			createdByUserId: "user-1",
			isCurrent: true,
		}).usageTestContext
	).toEqual(input.usageTestContext);
});

test("requires the complete scene context only for the object scene test", () => {
	const usageTest = {
		projectId: "project-1",
		assetFamilyId: "family-1",
		revisionId: "revision-1",
		itemId: "placement-test",
		kind: "usage_test",
		result: "passed",
		testId: "icon.light_dark_target_size",
		method: "Reviewed the icon at target sizes.",
		rationale: "The icon remains readable.",
		usageTestContext: {
			cellDimensions: { width: 32, height: 32 },
		},
	} as const;

	expect(
		readinessEvidenceInputSchema.safeParse({
			...usageTest,
			usageTestContext: {
				...usageTest.usageTestContext,
				approvedCharacterVersionId: "character-version-1",
			},
		}).success
	).toBe(false);
	expect(
		readinessEvidenceInputSchema.safeParse({
			...usageTest,
			testId: "object.approved_character_ground_scene",
			usageTestContext: {
				...usageTest.usageTestContext,
				approvedCharacterVersionId: "character-version-1",
			},
		}).success
	).toBe(false);
	expect(
		readinessEvidenceInputSchema.safeParse({
			...usageTest,
			usageTestContext: {
				...usageTest.usageTestContext,
				targetGroundVersionIds: ["grass-version-1", "grass-version-1"],
			},
		}).success
	).toBe(false);
});

test("reads historical usage test evidence without pinned context as out of date", () => {
	const evidence = readinessEvidenceSchema.parse({
		id: "historical-evidence-1",
		projectId: "project-1",
		assetFamilyId: "family-1",
		revisionId: "revision-1",
		itemId: "old-usage-test",
		kind: "usage_test",
		result: "passed",
		assetVersionIds: ["asset-version-1"],
		profileContractRevisionIds: [],
		contextRevisionId: "context-1",
		visualWorldId: "world-1",
		useContext: "combat",
		canonicalDesignVersionId: null,
		ruleId: null,
		ruleClass: null,
		testId: "icon.light_dark_target_size",
		observedValue: null,
		versionTarget: null,
		method: "Reviewed the icon at target sizes.",
		rationale: "The icon remains readable.",
		createdAt: "2026-10-05T09:00:00.000Z",
		createdByUserId: "user-1",
		isCurrent: false,
	});

	expect(evidence.usageTestContext).toBeNull();
});
