import { expect, test } from "bun:test";
import {
	contextProposalSchema,
	contextRevisionSchema,
	narrowestScopeChain,
	previewContextProposalActivation,
	validateContextProposal,
} from "./project-context";

test("family scope follows its registered Visual World and can be activated as Context", () => {
	const projectId = "project";
	const catalog = {
		visualWorlds: [
			{
				id: "world",
				projectId,
				name: "World",
				description: "",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		],
		themes: [],
		assetFamilies: [{ id: "family", projectId, visualWorldId: "world" }],
		assetRecordFamilies: [{ assetRecordId: "record", assetFamilyId: "family" }],
	};
	const chain = narrowestScopeChain(
		projectId,
		{ id: "record", visualWorldId: "world" },
		catalog
	);
	expect(chain).toEqual([
		{ kind: "asset_family", id: "family" },
		{ kind: "visual_world", id: "world" },
		{ kind: "project", id: projectId },
	]);
	const revision = {
		id: crypto.randomUUID(),
		projectId,
		revisionNumber: 0,
		sourceProposalId: null,
		ruleContractVersion: "context-rule/1.0.0",
		isActive: true,
		rules: [],
		createdAt: "2026-01-01T00:00:00.000Z",
	} as const;
	const result = validateContextProposal(
		projectId,
		contextRevisionSchema.parse(revision),
		[
			{
				operation: "add",
				ruleId: "outline",
				scope: { kind: "asset_family", id: "family" },
				precedenceChain: chain,
				value: { type: "text", value: "dark" },
				rationale: "Decision",
				evidence: [{ kind: "user_decision", statement: "Keep" }],
			},
		],
		revision.createdAt,
		catalog
	);
	expect(result.conflicts).toEqual([]);
});

test("a family sharing a Theme must explicitly override its same rule", () => {
	const projectId = "project";
	const catalog = {
		visualWorlds: [
			{
				id: "world",
				projectId,
				name: "World",
				description: "",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		],
		themes: [
			{
				id: "theme",
				projectId,
				visualWorldId: "world",
				name: "Theme",
				description: "",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		],
		assetFamilies: [{ id: "family", projectId, visualWorldId: "world" }],
		assetRecordFamilies: [
			{ assetRecordId: "record", assetFamilyId: "family", themeId: "theme" },
		],
	};
	const familyScope = { kind: "asset_family", id: "family" } as const;
	const revision = {
		id: crypto.randomUUID(),
		projectId,
		revisionNumber: 1,
		sourceProposalId: null,
		ruleContractVersion: "context-rule/1.0.0",
		isActive: true,
		createdAt: "2026-01-01T00:00:00.000Z",
		rules: [
			{
				contractVersion: "context-rule/1.0.0",
				id: "outline",
				scope: { kind: "theme", id: "theme" },
				precedenceChain: [
					{ kind: "theme", id: "theme" },
					{ kind: "visual_world", id: "world" },
					{ kind: "project", id: projectId },
				],
				value: { type: "text", value: "thin" },
				rationale: "Decision",
				source: { kind: "project_setup" },
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		],
	} as const;
	const change = {
		operation: "add",
		ruleId: "outline",
		scope: familyScope,
		precedenceChain: [
			{ kind: "asset_family", id: "family" },
			{ kind: "visual_world", id: "world" },
			{ kind: "project", id: projectId },
		],
		value: { type: "text", value: "dark" },
		rationale: "Decision",
		evidence: [{ kind: "user_decision", statement: "Keep" }],
	} as const;
	const result = validateContextProposal(
		projectId,
		revision as never,
		[change as never],
		revision.createdAt,
		catalog
	);
	expect(result.conflicts.map((conflict) => conflict.code)).toContain(
		"missing_context_override"
	);
	const base = contextRevisionSchema.parse({
		...revision,
		id: crypto.randomUUID(),
		revisionNumber: 0,
		rules: [],
	});
	const current = contextRevisionSchema.parse(revision);
	const proposal = contextProposalSchema.parse({
		id: crypto.randomUUID(),
		projectId,
		baseContextRevisionId: base.id,
		contractVersion: "context-agent/1.0.0",
		ruleContractVersion: "context-rule/1.0.0",
		summary: "Proposal",
		source: {
			kind: "structured_control",
			controlId: "context-proposal-form",
			controlVersion: "1.0.0",
		},
		changes: [change],
		validation: { isValid: true, checkedAt: revision.createdAt, conflicts: [] },
		activationAllowed: false,
		createdAt: revision.createdAt,
	});
	const review = previewContextProposalActivation(
		proposal,
		base,
		current,
		new Set(),
		revision.createdAt,
		null,
		catalog
	);
	expect(review.conflicts.map((conflict) => conflict.code)).toContain(
		"stale_rule_conflict"
	);
});
