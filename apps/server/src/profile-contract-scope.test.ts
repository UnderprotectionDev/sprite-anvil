import { expect, test } from "bun:test";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	areContractPinsCompatible,
	type ProjectProfileContracts,
} from "./features/quality-evidence/server/profile-contract-scope";

test("a contract revision change preserves unchanged rule evidence and stales changed rules", () => {
	const definition = specializedProfileContractCatalog.find(
		(contract) => contract.profileId === "icon"
	);
	expect(definition).toBeDefined();
	if (!definition) {
		return;
	}
	const priorContract = structuredClone(definition);
	const activeContract = structuredClone(definition);
	activeContract.version = "1.0.1";
	const changedRule = activeContract.rules.find(
		(rule) => rule.class === "waivable_requirement"
	);
	if (!changedRule) {
		return;
	}
	changedRule.successResult =
		"A revised threshold is measured for this version.";
	const priorRevisionId = `${priorContract.profileId}@${priorContract.version}`;
	const activeRevisionId = `${activeContract.profileId}@${activeContract.version}`;
	const priorRevision = {
		contract: priorContract,
		profileId: priorContract.profileId,
		revisionId: priorRevisionId,
	};
	const activeRevision = {
		contract: activeContract,
		profileId: activeContract.profileId,
		revisionId: activeRevisionId,
	};
	const contracts: ProjectProfileContracts = {
		activeByProfile: new Map([[definition.profileId, activeRevision]]),
		byRevisionId: new Map([
			[priorRevision.revisionId, priorRevision],
			[activeRevision.revisionId, activeRevision],
		]),
	};
	const sharedInput = {
		activeRevisionIds: [activeRevision.revisionId],
		contracts,
		profileIds: [definition.profileId],
		pinnedRevisionIds: [priorRevision.revisionId],
	};

	expect(
		areContractPinsCompatible({
			...sharedInput,
			entryId: definition.rules[0]?.id ?? "",
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
			entryId: definition.usageTests[0]?.id ?? "",
			kind: "usage_test",
		})
	).toBe(true);
});
