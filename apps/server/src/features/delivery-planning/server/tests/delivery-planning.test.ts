import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type {
	ProductionEvidencePolicy,
	RightsEvidencePolicy,
} from "@sprite-anvil/api/delivery-planning-inputs";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import { createDeliveryTargetStore } from "../delivery-target-store";
import { createMemoryDeliveryPlanningStorage } from "./memory-delivery-planning-storage";

const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const targetId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d1001";
const draftId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d2001";
const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
const secondDraftId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d2002";
const revisionId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d3001";
const secondRevisionId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d3002";

const assetVersionPattern = /assetVersion/i;
const knightFamily = "family-knight";
const slimeFamily = "family-slime";

const knightItems = [
	{
		assetRecordIds: ["record-knight-east"],
		disposition: "required",
		id: "east-facing",
		kind: "direction",
		name: "East facing",
	},
	{
		assetRecordIds: ["record-knight-east"],
		disposition: "required",
		id: "ground-scene",
		kind: "usage_test",
		name: "Ground scene",
		testId: "object.approved_character_ground_scene",
	},
];
const slimeWalkItem = {
	assetRecordIds: ["record-slime-walk"],
	disposition: "required",
	id: "walk",
	kind: "animation",
	name: "Walk",
};
const slimeItems = [
	{
		assetRecordIds: ["record-slime-idle"],
		disposition: "required",
		id: "idle",
		kind: "animation",
		name: "Idle",
	},
];

const productionEvidencePolicy: ProductionEvidencePolicy = {
	defaultRequirement: "legacy_asset_attestation_acceptable",
	familyRequirements: [
		{
			assetFamilyId: knightFamily,
			requirement: "full_generation_package_history",
		},
	],
};
const rightsEvidencePolicy: RightsEvidencePolicy = {
	acceptableStates: ["documented", "assertion_only"],
	requireRecordFor: ["references", "results"],
};

function seed() {
	return {
		contextRevisions: [
			{ id: "context-1", revisionNumber: 1 },
			{ id: "context-2", revisionNumber: 2 },
		],
		requiredSetRevisions: [
			{
				assetFamilyId: knightFamily,
				assetFamilyName: "Knight",
				id: "knight-set-1",
				items: knightItems,
				revisionNumber: 1,
			},
			{
				assetFamilyId: slimeFamily,
				assetFamilyName: "Slime",
				id: "slime-set-1",
				items: slimeItems,
				revisionNumber: 1,
			},
			{
				assetFamilyId: "family-orc",
				assetFamilyName: "Orc",
				id: "orc-set-1",
				items: slimeItems,
				revisionNumber: 1,
			},
			{
				assetFamilyId: slimeFamily,
				assetFamilyName: "Slime",
				id: "slime-set-2",
				items: [slimeWalkItem],
				revisionNumber: 2,
			},
		],
	};
}

function setup(options: { hasAccess?: boolean; session?: boolean } = {}) {
	const seeded = seed();
	const memory = createMemoryDeliveryPlanningStorage(seeded);
	const context = {
		deliveryTargetStore: createDeliveryTargetStore(
			{} as Database,
			memory.storage,
			{
				getProjectForUser: (_userId, requestedProjectId) =>
					Promise.resolve(
						(options.hasAccess ?? true) &&
							[projectId, otherProjectId].includes(requestedProjectId)
							? { id: requestedProjectId }
							: null
					),
				now: () => new Date("2026-11-06T10:00:00.000Z"),
			}
		),
		session: options.session === false ? null : { user: { id: userId } },
	} as unknown as Context;
	return {
		failNextRevisionInserts: memory.failNextRevisionInserts,
		activate: (input: { draftId: string; id: string }) =>
			call(
				appRouter.deliveryPlanning.activate,
				{ ...input, projectId },
				{ context }
			),
		list: () =>
			call(appRouter.deliveryPlanning.list, { projectId }, { context }),
		saveDraft: (overrides: Record<string, unknown> = {}) =>
			call(
				appRouter.deliveryPlanning.saveDraft,
				{
					contextRevisionId: "context-1",
					deliveryTargetId: targetId,
					families: [
						{
							assetFamilyId: knightFamily,
							requiredSetRevisionId: "knight-set-1",
						},
						{
							assetFamilyId: slimeFamily,
							requiredSetRevisionId: "slime-set-1",
						},
					],
					id: draftId,
					name: "Chapter 1 demo",
					productionEvidencePolicy,
					projectId,
					purpose: "demo",
					rightsEvidencePolicy,
					...overrides,
				} as never,
				{ context }
			),
		seeded,
	};
}

test("a saved draft is reviewable with its pinned scope and changes nothing official", async () => {
	const { list, saveDraft, seeded } = setup();
	const before = structuredClone(seeded);

	const saved = await saveDraft();
	const catalog = await list();

	expect(saved.id).toBe(draftId);
	expect(catalog.deliveryTargets).toHaveLength(1);
	const [target] = catalog.deliveryTargets;
	expect(target).toMatchObject({
		activeRevision: null,
		id: targetId,
		name: "Chapter 1 demo",
		purpose: "demo",
		revisions: [],
	});
	expect(target?.drafts).toEqual([saved]);
	expect(saved).toMatchObject({
		activatedRevisionId: null,
		contextRevisionId: "context-1",
		contextRevisionNumber: 1,
	});
	expect(saved.families.map((family) => family.assetFamilyName)).toEqual([
		"Knight",
		"Slime",
	]);
	expect(saved.families[0]?.usageTests.map((item) => item.id)).toEqual([
		"ground-scene",
	]);
	expect(saved.families[1]?.usageTests).toEqual([]);
	expect(saved.families[0]?.requiredSetRevisionNumber).toBe(1);
	// The draft does not replace or alter the family-level Required Items Lists.
	expect(seeded).toEqual(before);
});

test("activating a draft creates a revision that is reread from storage", async () => {
	const { activate, list, saveDraft, seeded } = setup();
	const before = structuredClone(seeded);
	const draft = await saveDraft();

	const revision = await activate({ draftId, id: revisionId });
	const [target] = (await list()).deliveryTargets;

	expect(revision).toMatchObject({
		activatedAt: "2026-11-06T10:00:00.000Z",
		contextRevisionId: "context-1",
		draftId,
		id: revisionId,
		revisionNumber: 1,
	});
	expect(revision.families).toEqual(draft.families);
	expect(target?.activeRevision).toEqual(revision);
	expect(target?.revisions).toEqual([revision]);
	expect(target?.drafts[0]?.activatedRevisionId).toBe(revisionId);
	expect(seeded).toEqual(before);
});

test("activating the same draft again returns the existing revision", async () => {
	const { activate, list, saveDraft } = setup();
	await saveDraft();

	const first = await activate({ draftId, id: revisionId });
	const second = await activate({ draftId, id: secondRevisionId });

	expect(second).toEqual(first);
	expect((await list()).deliveryTargets[0]?.revisions).toHaveLength(1);
});

test("a later activation adds a revision and leaves the earlier one unchanged", async () => {
	const { activate, list, saveDraft } = setup();
	await saveDraft();
	const first = await activate({ draftId, id: revisionId });
	await saveDraft({ contextRevisionId: "context-2", id: secondDraftId });

	const second = await activate({
		draftId: secondDraftId,
		id: secondRevisionId,
	});
	const [target] = (await list()).deliveryTargets;

	expect(second).toMatchObject({
		contextRevisionId: "context-2",
		revisionNumber: 2,
	});
	expect(target?.activeRevision).toEqual(second);
	expect(target?.revisions).toEqual([first, second]);
	expect(first.contextRevisionId).toBe("context-1");
});

test("saving the same draft id again with the same content returns the stored draft", async () => {
	const { list, saveDraft } = setup();
	const first = await saveDraft();

	const second = await saveDraft({
		rightsEvidencePolicy: {
			acceptableStates: ["assertion_only", "documented"],
			requireRecordFor: ["results", "references"],
		},
	});

	expect(second).toEqual(first);
	expect((await list()).deliveryTargets[0]?.drafts).toHaveLength(1);
});

test("saving an existing draft id with different content is a conflict and keeps the stored draft", async () => {
	const { list, saveDraft } = setup();
	const first = await saveDraft();

	await expect(saveDraft({ name: "Renamed" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	await expect(
		saveDraft({ contextRevisionId: "context-2" })
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		saveDraft({
			rightsEvidencePolicy: {
				acceptableStates: ["documented"],
				requireRecordFor: [],
			},
		})
	).rejects.toMatchObject({ code: "CONFLICT" });

	expect((await list()).deliveryTargets[0]?.drafts).toEqual([first]);
});

test("a target id already used by another project is a clean rejection", async () => {
	const { list, saveDraft } = setup();
	await saveDraft();

	await expect(
		saveDraft({ id: secondDraftId, projectId: otherProjectId })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });

	expect((await list()).deliveryTargets[0]?.drafts).toHaveLength(1);
});

test("an activation that keeps losing the revision number race is a conflict", async () => {
	const { activate, failNextRevisionInserts, list, saveDraft } = setup();
	await saveDraft();
	failNextRevisionInserts(10);

	await expect(activate({ draftId, id: revisionId })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	expect((await list()).deliveryTargets[0]?.revisions).toEqual([]);
});

test("an activation retries after losing the revision number race", async () => {
	const { activate, failNextRevisionInserts, saveDraft } = setup();
	await saveDraft();
	failNextRevisionInserts(2);

	const revision = await activate({ draftId, id: revisionId });

	expect(revision.revisionNumber).toBe(1);
});

test("reordering set-like policy entries is not a policy change", async () => {
	const { activate, saveDraft } = setup();
	const requirements = [
		{
			assetFamilyId: knightFamily,
			requirement: "full_generation_package_history",
		},
		{ assetFamilyId: slimeFamily, requirement: "advisory" },
	];
	await saveDraft({
		productionEvidencePolicy: {
			defaultRequirement: "advisory",
			familyRequirements: requirements,
		},
	});
	await activate({ draftId, id: revisionId });
	await saveDraft({
		id: secondDraftId,
		productionEvidencePolicy: {
			defaultRequirement: "advisory",
			familyRequirements: [...requirements].reverse(),
		},
		rightsEvidencePolicy: {
			acceptableStates: ["assertion_only", "documented"],
			requireRecordFor: ["results", "references"],
		},
	});

	const second = await activate({
		draftId: secondDraftId,
		id: secondRevisionId,
	});

	expect(second.scopeDiff?.productionEvidencePolicyChanged).toBe(false);
	expect(second.scopeDiff?.rightsEvidencePolicyChanged).toBe(false);
});

test("a draft with an unknown or mismatched pin is rejected and stores nothing", async () => {
	const { list, saveDraft } = setup();
	const rejected = (overrides: Record<string, unknown>) =>
		expect(saveDraft(overrides)).rejects.toMatchObject({ code: "BAD_REQUEST" });

	await rejected({ contextRevisionId: "context-missing" });
	await rejected({
		families: [
			{ assetFamilyId: knightFamily, requiredSetRevisionId: "knight-set-1" },
			{ assetFamilyId: slimeFamily, requiredSetRevisionId: "missing-set" },
		],
	});
	// A list revision pinned under a different family is not that family's list.
	await rejected({
		families: [
			{ assetFamilyId: knightFamily, requiredSetRevisionId: "knight-set-1" },
			{ assetFamilyId: slimeFamily, requiredSetRevisionId: "knight-set-1" },
		],
	});

	expect((await list()).deliveryTargets).toEqual([]);
});

test("a target must cover at least two distinct Asset Families", async () => {
	const { saveDraft } = setup();
	const pin = {
		assetFamilyId: knightFamily,
		requiredSetRevisionId: "knight-set-1",
	};

	await expect(saveDraft({ families: [pin] })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	await expect(saveDraft({ families: [pin, pin] })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

test("activating an unknown draft is not found and creates no revision", async () => {
	const { activate, list, saveDraft } = setup();
	await saveDraft();

	await expect(
		activate({ draftId: secondDraftId, id: revisionId })
	).rejects.toMatchObject({ code: "NOT_FOUND" });

	expect((await list()).deliveryTargets[0]?.revisions).toEqual([]);
});

test("planning requires a session and project access", async () => {
	const anonymous = setup({ session: false });
	await expect(anonymous.list()).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});

	const outsider = setup({ hasAccess: false });
	await expect(outsider.list()).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(outsider.saveDraft()).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(
		outsider.activate({ draftId, id: revisionId })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("pinned evidence policies are saved on the draft and reread from the activated revision", async () => {
	const { activate, list, saveDraft } = setup();

	const draft = await saveDraft();
	const revision = await activate({ draftId, id: revisionId });
	const [target] = (await list()).deliveryTargets;

	expect(draft.productionEvidencePolicy).toEqual(productionEvidencePolicy);
	expect(draft.rightsEvidencePolicy).toEqual(rightsEvidencePolicy);
	expect(revision.productionEvidencePolicy).toEqual(productionEvidencePolicy);
	expect(revision.rightsEvidencePolicy).toEqual(rightsEvidencePolicy);
	expect(target?.activeRevision).toEqual(revision);
	expect(revision.scopeDiff).toBeNull();
});

const runtimeValidationCriterion = {
	environments: [
		{
			adapterVersion: "godot-adapter-1.2.0",
			engineVersion: "Godot 4.4.1",
			gameBuild: "build-2026.11.11",
		},
	],
	freshness: "not_superseded" as const,
};

test("a target without the runtime validation criterion keeps working and reads it as null", async () => {
	const { activate, saveDraft } = setup();
	const draft = await saveDraft();
	const revision = await activate({ draftId, id: revisionId });
	expect(draft.runtimeValidationCriterion).toBeNull();
	expect(revision.runtimeValidationCriterion).toBeNull();
});

test("the runtime validation criterion is pinned on the draft, reread from the revision, and a change is a visible diff", async () => {
	const { activate, saveDraft } = setup();
	const draft = await saveDraft({ runtimeValidationCriterion });
	const first = await activate({ draftId, id: revisionId });
	expect(draft.runtimeValidationCriterion).toEqual(runtimeValidationCriterion);
	expect(first.runtimeValidationCriterion).toEqual(runtimeValidationCriterion);

	await saveDraft({ id: secondDraftId, runtimeValidationCriterion: null });
	const second = await activate({
		draftId: secondDraftId,
		id: secondRevisionId,
	});
	expect(second.scopeDiff?.runtimeValidationCriterionChanged).toBe(true);
	expect(second.runtimeValidationCriterion).toBeNull();
	// the earlier revision is not rewritten
	expect(first.runtimeValidationCriterion).toEqual(runtimeValidationCriterion);
});

test("an invalid criterion is rejected and stores nothing", async () => {
	const { list, saveDraft } = setup();
	const [environment] = runtimeValidationCriterion.environments;
	await Promise.all(
		[
			{ ...runtimeValidationCriterion, environments: [] },
			{
				...runtimeValidationCriterion,
				environments: [environment, { ...environment }],
			},
			{
				...runtimeValidationCriterion,
				environments: [{ ...environment, gameBuild: "  " }],
			},
			{ ...runtimeValidationCriterion, freshness: "whenever" },
		].map((bad) =>
			expect(
				saveDraft({ runtimeValidationCriterion: bad })
			).rejects.toMatchObject({ code: "BAD_REQUEST" })
		)
	);
	expect((await list()).deliveryTargets).toEqual([]);
});

test("moving to a new base adds a revision with a scope diff and leaves the earlier revision unchanged", async () => {
	const { activate, list, saveDraft, seeded } = setup();
	const before = structuredClone(seeded);
	await saveDraft();
	const first = await activate({ draftId, id: revisionId });
	const firstSnapshot = JSON.stringify(first);
	const newRights: RightsEvidencePolicy = {
		acceptableStates: ["documented"],
		requireRecordFor: ["results"],
	};
	await saveDraft({
		contextRevisionId: "context-2",
		families: [
			{ assetFamilyId: knightFamily, requiredSetRevisionId: "knight-set-1" },
			{ assetFamilyId: slimeFamily, requiredSetRevisionId: "slime-set-2" },
		],
		id: secondDraftId,
		rightsEvidencePolicy: newRights,
	});

	const second = await activate({
		draftId: secondDraftId,
		id: secondRevisionId,
	});
	const [target] = (await list()).deliveryTargets;

	expect(second.revisionNumber).toBe(2);
	expect(second.rightsEvidencePolicy).toEqual(newRights);
	expect(second.scopeDiff).toMatchObject({
		contextChange: {
			fromRevisionId: "context-1",
			fromRevisionNumber: 1,
			toRevisionId: "context-2",
			toRevisionNumber: 2,
		},
		familiesAdded: [],
		familiesRemoved: [],
		previousRevisionId: revisionId,
		previousRevisionNumber: 1,
		productionEvidencePolicyChanged: false,
		requiredSetChanges: [
			{
				assetFamilyId: slimeFamily,
				assetFamilyName: "Slime",
				fromRevisionId: "slime-set-1",
				fromRevisionNumber: 1,
				itemsAdded: [slimeWalkItem],
				itemsRemoved: [slimeItems[0]],
				toRevisionId: "slime-set-2",
				toRevisionNumber: 2,
			},
		],
		rightsEvidencePolicyChanged: true,
	});
	expect(target?.revisions).toHaveLength(2);
	expect(JSON.stringify(target?.revisions[0])).toBe(firstSnapshot);
	expect(target?.revisions[0]?.productionEvidencePolicy).toEqual(
		productionEvidencePolicy
	);
	expect(target?.activeRevision).toEqual(second);
	expect(seeded).toEqual(before);
});

test("a revision pinning identical scope and policies shows an empty diff", async () => {
	const { activate, saveDraft } = setup();
	await saveDraft();
	await activate({ draftId, id: revisionId });
	await saveDraft({ id: secondDraftId });

	const second = await activate({
		draftId: secondDraftId,
		id: secondRevisionId,
	});

	expect(second.scopeDiff).toEqual({
		contextChange: null,
		familiesAdded: [],
		familiesRemoved: [],
		previousRevisionId: revisionId,
		previousRevisionNumber: 1,
		productionEvidencePolicyChanged: false,
		requiredSetChanges: [],
		rightsEvidencePolicyChanged: false,
		runtimeValidationCriterionChanged: false,
	});
});

test("a diff names families added to or removed from the target", async () => {
	const { activate, saveDraft } = setup();
	await saveDraft();
	await activate({ draftId, id: revisionId });
	await saveDraft({
		families: [
			{ assetFamilyId: slimeFamily, requiredSetRevisionId: "slime-set-1" },
			{ assetFamilyId: "family-orc", requiredSetRevisionId: "orc-set-1" },
		],
		id: secondDraftId,
		productionEvidencePolicy: {
			defaultRequirement: "advisory",
			familyRequirements: [],
		},
	});

	const second = await activate({
		draftId: secondDraftId,
		id: secondRevisionId,
	});

	expect(second.scopeDiff?.familiesAdded).toEqual([
		{ assetFamilyId: "family-orc", assetFamilyName: "Orc" },
	]);
	expect(second.scopeDiff?.familiesRemoved).toEqual([
		{ assetFamilyId: knightFamily, assetFamilyName: "Knight" },
	]);
	expect(second.scopeDiff?.productionEvidencePolicyChanged).toBe(true);
});

test("an invalid or missing evidence policy is rejected and stores nothing", async () => {
	const { list, saveDraft } = setup();
	const rejected = (overrides: Record<string, unknown>) =>
		expect(saveDraft(overrides)).rejects.toMatchObject({ code: "BAD_REQUEST" });

	await rejected({
		productionEvidencePolicy: {
			defaultRequirement: "trust_me",
			familyRequirements: [],
		},
	});
	await rejected({
		productionEvidencePolicy: {
			defaultRequirement: "advisory",
			familyRequirements: [
				{ assetFamilyId: knightFamily, requirement: "advisory" },
				{ assetFamilyId: knightFamily, requirement: "advisory" },
			],
		},
	});
	// A family requirement for a family the target does not pin.
	await rejected({
		productionEvidencePolicy: {
			defaultRequirement: "advisory",
			familyRequirements: [
				{ assetFamilyId: "family-orc", requirement: "advisory" },
			],
		},
	});
	await rejected({
		rightsEvidencePolicy: { acceptableStates: [], requireRecordFor: [] },
	});
	await rejected({
		rightsEvidencePolicy: {
			acceptableStates: ["legally_valid"],
			requireRecordFor: [],
		},
	});
	await rejected({
		rightsEvidencePolicy: {
			acceptableStates: ["documented", "documented"],
			requireRecordFor: [],
		},
	});
	await rejected({ productionEvidencePolicy: undefined });
	await rejected({ rightsEvidencePolicy: undefined });

	expect((await list()).deliveryTargets).toEqual([]);
});

test("only an authenticated user activates and a caller cannot name another actor", async () => {
	const anonymous = setup({ session: false });
	await expect(
		anonymous.activate({ draftId, id: revisionId })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });

	const { activate, list, saveDraft } = setup();
	await saveDraft();
	await expect(
		activate({
			activatedByUserId: "agent-1",
			draftId,
			id: revisionId,
		} as never)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	// Saving a draft, even a complete one, never activates it.
	expect((await list()).deliveryTargets[0]?.revisions).toEqual([]);
});

test("a revision pins Context and Required Items List revisions, never Asset Versions", async () => {
	const { activate, saveDraft } = setup();
	await saveDraft();
	const revision = await activate({ draftId, id: revisionId });

	expect(JSON.stringify(revision)).not.toMatch(assetVersionPattern);
	expect(Object.keys(revision.families[0] ?? {})).not.toContain(
		"assetVersionId"
	);
});
