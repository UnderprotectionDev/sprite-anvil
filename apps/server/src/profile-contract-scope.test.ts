import { expect, test } from "bun:test";
import { specializedProfileContractTemplates } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	areContractPinsCompatible,
	type ProjectProfileContracts,
} from "./features/quality-evidence/server/profile-contract-scope";

test("a contract revision change preserves unchanged rule evidence and stales changed rules", () => {
	const [template] = specializedProfileContractTemplates;
	expect(template).toBeDefined();
	if (!template) {
		return;
	}
	const priorContract = structuredClone(template);
	const activeContract = structuredClone(template);
	activeContract.revisionNumber = 2;
	const changedRule = activeContract.rules.find(
		(rule) => rule.class === "waivable_requirement"
	);
	if (!changedRule) {
		return;
	}
	changedRule.successCondition =
		"A changed threshold is measured for this version.";
	const priorRevision = {
		contract: priorContract,
		profileId: template.profileId,
		revisionId: "profile-revision-1",
		revisionNumber: 1,
	};
	const activeRevision = {
		contract: activeContract,
		profileId: template.profileId,
		revisionId: "profile-revision-2",
		revisionNumber: 2,
	};
	const contracts: ProjectProfileContracts = {
		activeByProfile: new Map([[template.profileId, activeRevision]]),
		byRevisionId: new Map([
			[priorRevision.revisionId, priorRevision],
			[activeRevision.revisionId, activeRevision],
		]),
	};
	const sharedInput = {
		activeRevisionIds: [activeRevision.revisionId],
		contracts,
		profileIds: [template.profileId],
		pinnedRevisionIds: [priorRevision.revisionId],
	};

	expect(
		areContractPinsCompatible({
			...sharedInput,
			entryId: template.rules[0]?.id ?? "",
			kind: "quality",
		})
	).toBe(true);
	expect(
		areContractPinsCompatible({
			...sharedInput,
			entryId: changedRule.id,
			kind: "quality",
		})
	).toBe(false);
	expect(
		areContractPinsCompatible({
			...sharedInput,
			entryId: template.usageTests[0]?.id ?? "",
			kind: "usage_test",
		})
	).toBe(true);
});
