import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { DeliveryTargetCatalog } from "@sprite-anvil/api/delivery-planning-outputs";
import type { DeliveryTargetStore } from "@sprite-anvil/api/delivery-planning-store";
import type { DependencyRevalidationStore } from "@sprite-anvil/api/dependency-revalidation";
import type {
	FamilyReadiness,
	FamilyReadinessStore,
} from "@sprite-anvil/api/family-readiness";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createReadinessPlanStore } from "../readiness-plan-store";
import { createMemoryReadinessPlanStorage } from "./memory-readiness-plan-storage";

const scorePattern = /score/i;
const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const targetId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d1001";
const draftOnlyTargetId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d1002";
const revisionId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d3001";
const knight = "family-knight";
const slime = "family-slime";

const approval = `${knight}:east-facing:approval`;
const quality = `${knight}:east-facing:quality`;
const usageTest = `${knight}:ground-scene:usage_test`;

const eastItem = {
	assetRecordIds: ["record-east"],
	disposition: "required",
	id: "east-facing",
	kind: "direction",
	name: "East facing",
};
const groundSceneItem = {
	assetRecordIds: ["record-east"],
	disposition: "required",
	id: "ground-scene",
	kind: "usage_test",
	name: "Ground scene",
	testId: "object.approved_character_ground_scene",
};
const idleItem = {
	assetRecordIds: ["record-idle"],
	disposition: "required",
	id: "idle",
	kind: "animation",
	name: "Idle",
};

function revisionScope(overrides: Record<string, unknown> = {}) {
	return {
		activatedAt: "2026-11-06T10:00:00.000Z",
		contextRevisionId: "context-1",
		contextRevisionNumber: 1,
		draftId: "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d2001",
		families: [
			{
				assetFamilyId: knight,
				assetFamilyName: "Knight",
				requiredItems: [eastItem],
				requiredSetRevisionId: "knight-set-1",
				requiredSetRevisionNumber: 1,
				usageTests: [groundSceneItem],
			},
			{
				assetFamilyId: slime,
				assetFamilyName: "Slime",
				requiredItems: [idleItem],
				requiredSetRevisionId: "slime-set-1",
				requiredSetRevisionNumber: 1,
				usageTests: [],
			},
		],
		id: revisionId,
		productionEvidencePolicy: {
			defaultRequirement: "advisory",
			familyRequirements: [],
		},
		revisionNumber: 1,
		rightsEvidencePolicy: {
			acceptableStates: ["documented"],
			requireRecordFor: [],
		},
		scopeDiff: null,
		...overrides,
	};
}

function catalogOf(
	revision: Record<string, unknown> | null
): DeliveryTargetCatalog {
	return {
		deliveryTargets: [
			{
				activeRevision: revision,
				drafts: [],
				id: targetId,
				name: "Demo",
				purpose: "demo",
				revisions: revision ? [revision] : [],
			},
			{
				activeRevision: null,
				drafts: [],
				id: draftOnlyTargetId,
				name: "Draft only",
				purpose: "chapter",
				revisions: [],
			},
		],
	} as unknown as DeliveryTargetCatalog;
}

interface ItemState {
	blockers: string[];
	id: string;
	unmetUsage?: boolean;
	versions: string[];
}

function readinessOf(
	assetFamilyId: string,
	activeRevisionId: string,
	items: Record<string, unknown>[],
	states: ItemState[]
) {
	return {
		activeRevision: { id: activeRevisionId },
		assetFamilyId,
		items: states.map((state) => ({
			blockers: state.blockers,
			currentAssetVersionIds: state.versions,
			humanReviewRequirements: [],
			item: items.find((item) => item.id === state.id),
			qualityRequirements:
				state.blockers.includes("quality") && state.id === "east-facing"
					? [
							{
								id: "pixel.palette",
								isCurrent: true,
								name: "Palette limit",
								result: "failed",
							},
						]
					: [],
			status: state.blockers.length === 0 ? "complete" : "incomplete",
			usageRequirements: state.unmetUsage
				? [
						{
							id: "object.approved_character_ground_scene",
							isCurrent: true,
							name: "Ground scene",
							result: "not_assessed",
						},
					]
				: [],
		})),
		projectId,
		status: "incomplete",
	} as unknown as FamilyReadiness;
}

function setup(
	options: {
		hasAccess?: boolean;
		revision?: Record<string, unknown> | null;
		session?: boolean;
	} = {}
) {
	const writes: string[] = [];
	const state = {
		knight: [
			{
				blockers: ["approval", "quality"],
				id: "east-facing",
				versions: ["version-east"],
			},
			{
				blockers: ["usage_test"],
				id: "ground-scene",
				unmetUsage: true,
				versions: ["version-east"],
			},
		] as ItemState[],
		knightActiveRevisionId: "knight-set-1",
		/** Runs while a family's readiness is being read, to change the world mid-computation. */
		accessLost: false,
		/** Family ids whose readiness cannot be read. */
		unreadableFamilies: [] as string[],
		/** The dependency catalog is unavailable to the user. */
		dependenciesUnavailable: false,
		onFamilyRead: undefined as (() => void) | undefined,
		revalidationRequired: ["version-east"],
	};
	const catalog = catalogOf(
		options.revision === undefined ? revisionScope() : options.revision
	);
	const deliveryTargets = {
		activate: () => {
			writes.push("delivery-target-activate");
			return Promise.reject(new Error("never"));
		},
		list: (_user, requestedProjectId) =>
			Promise.resolve(
				(options.hasAccess ?? true) &&
					!state.accessLost &&
					requestedProjectId === projectId
					? catalog
					: null
			),
		saveDraft: () => {
			writes.push("delivery-target-save-draft");
			return Promise.reject(new Error("never"));
		},
	} satisfies DeliveryTargetStore;
	const familyReadiness = {
		activate: () => {
			writes.push("required-set-activate");
			return Promise.reject(new Error("never"));
		},
		list: (_user, _project, assetFamilyId) => {
			state.onFamilyRead?.();
			if (state.unreadableFamilies.includes(assetFamilyId)) {
				return Promise.resolve(null);
			}
			return Promise.resolve(
				assetFamilyId === knight
					? readinessOf(
							knight,
							state.knightActiveRevisionId,
							[eastItem, groundSceneItem],
							state.knight
						)
					: readinessOf(
							slime,
							"slime-set-1",
							[idleItem],
							[{ blockers: [], id: "idle", versions: ["version-idle"] }]
						)
			);
		},
		recordEvidence: () => {
			writes.push("record-evidence");
			return Promise.reject(new Error("never"));
		},
		saveDraft: () => {
			writes.push("required-set-save-draft");
			return Promise.reject(new Error("never"));
		},
	} satisfies FamilyReadinessStore;
	const dependencies = {
		list: () =>
			Promise.resolve(
				state.dependenciesUnavailable
					? null
					: {
							changeImpacts: [],
							dependencyLinks: [
								{
									createdAt: "2026-11-06T10:00:00.000Z",
									facets: ["palette"],
									id: "link-1",
									projectId,
									source: { id: "version-east", kind: "asset_version" },
									targetAssetVersionId: "version-derived",
								},
							],
							revalidationRequiredVersionIds: state.revalidationRequired,
						}
			),
	} as unknown as DependencyRevalidationStore;
	const memory = createMemoryReadinessPlanStorage(
		(deliveryTargetId) =>
			(
				catalog.deliveryTargets.find((target) => target.id === deliveryTargetId)
					?.activeRevision as { id: string } | null
			)?.id ?? null
	);
	const context = {
		readinessPlanStore: createReadinessPlanStore({
			deliveryTargets,
			dependencies,
			familyReadiness,
			storage: memory.storage,
		}),
		session: options.session === false ? null : { user: { id: userId } },
	} as unknown as Context;
	return {
		catalog,
		get: (input: { deliveryTargetId?: string } = {}) =>
			call(
				appRouter.readinessPlans.get,
				{ deliveryTargetId: targetId, projectId, ...input },
				{ context }
			),
		reorder: (orderedWorkIds: string[], overrides = {}) =>
			call(
				appRouter.readinessPlans.reorder,
				{
					deliveryTargetId: targetId,
					orderedWorkIds,
					projectId,
					revisionId,
					...overrides,
				},
				{ context }
			),
		state,
		writes,
	};
}

test("a blocked target shows each blocker, its dependent work and four separate rationales", async () => {
	const { get } = setup();

	const plan = await get();

	expect(plan.targetReadiness).toBe("blocked");
	expect(plan.deliveryStatus).toBe("not_delivered");
	expect(plan.revisionId).toBe(revisionId);
	expect(
		plan.blockers.map((blocker) => [blocker.itemId, blocker.blockerCodes])
	).toEqual([
		["east-facing", ["approval", "quality"]],
		["ground-scene", ["usage_test"]],
	]);
	expect(plan.blockers[0]?.unmetRequirements).toEqual([
		{
			id: "pixel.palette",
			isCurrent: true,
			kind: "quality",
			name: "Palette limit",
			result: "failed",
		},
	]);
	expect(plan.blockers[1]?.unmetRequirements[0]).toMatchObject({
		kind: "usage_test",
		result: "not_assessed",
	});
	expect(plan.workItems.map((work) => work.id)).toEqual([
		approval,
		quality,
		usageTest,
	]);
	const [approvalWork, qualityWork, usageWork] = plan.workItems;
	expect(qualityWork?.dependsOnWorkIds).toEqual([approval]);
	expect(usageWork?.dependsOnWorkIds).toEqual([approval, quality]);
	expect(approvalWork?.opensWorkIds).toEqual([quality, usageTest]);
	expect(approvalWork?.rationales).toEqual({
		revalidationImpact: {
			derivativeVersionIds: ["version-derived"],
			requiredNowVersionIds: ["version-east"],
		},
		targetRequirement: {
			itemId: "east-facing",
			requiredSetRevisionId: "knight-set-1",
			requiredSetRevisionNumber: 1,
			source: "required_items_list",
		},
		unlocksDependentWork: { count: 2 },
		userPriority: { position: null },
	});
	expect(plan.workItems.every((work) => work.orderSource === "suggested")).toBe(
		true
	);
	expect(plan.recommendedNext).toEqual({
		basis: "suggested_order",
		workId: approval,
	});
	expect(JSON.stringify(plan)).not.toMatch(scorePattern);
});

test("the user's reorder is persisted, re-read, and flagged where it precedes a prerequisite", async () => {
	const { get, reorder, writes } = setup();
	const before = await get();

	const saved = await reorder([usageTest, approval, quality]);
	const reread = await get();

	expect(reread).toEqual(saved);
	expect(reread.workItems.map((work) => work.id)).toEqual([
		usageTest,
		approval,
		quality,
	]);
	expect(reread.workItems.map((work) => work.orderSource)).toEqual([
		"user",
		"user",
		"user",
	]);
	expect(reread.workItems[0]?.rationales.userPriority).toEqual({
		position: 1,
	});
	expect(reread.orderWarnings).toEqual([
		{ prerequisiteWorkId: approval, workId: usageTest },
		{ prerequisiteWorkId: quality, workId: usageTest },
	]);
	// The user's order stands, and the system recommends only what can start now.
	expect(reread.recommendedNext).toEqual({
		basis: "user_order",
		workId: approval,
	});
	// Ordering changes neither the blockers nor the target's readiness.
	expect(reread.blockers).toEqual(before.blockers);
	expect(reread.targetReadiness).toBe(before.targetReadiness);
	expect(writes).toEqual([]);
});

test("a rejected reorder leaves the saved order unchanged", async () => {
	const { get, reorder } = setup();
	await reorder([quality, approval, usageTest]);

	await expect(
		reorder([approval, quality, usageTest, "family-knight:ghost:quality"])
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(reorder([approval, quality])).rejects.toMatchObject({
		code: "CONFLICT",
	});
	await expect(
		reorder([approval, quality, usageTest], {
			revisionId: "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d3999",
		})
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(reorder([approval, approval, usageTest])).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});

	expect((await get()).workItems.map((work) => work.id)).toEqual([
		quality,
		approval,
		usageTest,
	]);
});

test("work that is done drops out of the saved order and new work follows it", async () => {
	const { get, reorder, state } = setup();
	await reorder([usageTest, quality, approval]);

	state.knight[0] = {
		blockers: ["quality", "integrity"],
		id: "east-facing",
		versions: ["version-east"],
	};
	const plan = await get();

	expect(plan.workItems.map((work) => [work.id, work.orderSource])).toEqual([
		[usageTest, "user"],
		[quality, "user"],
		[`${knight}:east-facing:integrity`, "suggested"],
	]);
});

test("a target whose every condition is met is Ready, still not Delivered, and has nothing to do", async () => {
	const { get, state } = setup();
	state.knight = [
		{ blockers: [], id: "east-facing", versions: ["version-east"] },
		{ blockers: [], id: "ground-scene", versions: ["version-east"] },
	];

	const plan = await get();

	expect(plan.targetReadiness).toBe("ready");
	expect(plan.deliveryStatus).toBe("not_delivered");
	expect(plan.blockers).toEqual([]);
	expect(plan.workItems).toEqual([]);
	expect(plan.recommendedNext).toBeNull();
});

test("a pinned Required Items List that is no longer active blocks instead of silently following the new list", async () => {
	const { get, state } = setup();
	state.knightActiveRevisionId = "knight-set-2";
	state.knight = [
		{ blockers: [], id: "east-facing", versions: ["version-east"] },
		{ blockers: [], id: "ground-scene", versions: ["version-east"] },
	];

	const plan = await get();

	expect(plan.targetReadiness).toBe("blocked");
	expect(plan.blockers).toMatchObject([
		{
			assetFamilyId: knight,
			kind: "pinned_required_list_not_active",
			itemId: null,
		},
	]);
});

test("an evidence policy the plan cannot yet evaluate blocks rather than reporting Ready", async () => {
	const { get, state } = setup({
		revision: revisionScope({
			productionEvidencePolicy: {
				defaultRequirement: "advisory",
				familyRequirements: [
					{
						assetFamilyId: slime,
						requirement: "full_generation_package_history",
					},
				],
			},
			rightsEvidencePolicy: {
				acceptableStates: ["documented"],
				requireRecordFor: ["references"],
			},
		}),
	});
	state.knight = [
		{ blockers: [], id: "east-facing", versions: [] },
		{ blockers: [], id: "ground-scene", versions: [] },
	];

	const plan = await get();

	expect(plan.targetReadiness).toBe("blocked");
	expect(plan.blockers.map((blocker) => blocker.kind).sort()).toEqual([
		"production_evidence_policy_not_evaluated",
		"rights_evidence_policy_not_evaluated",
	]);
	expect(
		plan.workItems
			.map((work) => work.rationales.targetRequirement.source)
			.sort()
	).toEqual(["production_evidence_policy", "rights_evidence_policy"]);
});

test("reading or ordering a plan starts no decision and leaves the target scope alone", async () => {
	const { catalog, get, reorder, writes } = setup();
	const catalogBefore = structuredClone(catalog);

	await get();
	await reorder([approval, quality, usageTest]);
	await get();

	expect(writes).toEqual([]);
	expect(catalog).toEqual(catalogBefore);
});

test("a target without an activated revision has no plan, even when it has drafts", async () => {
	const { get, reorder } = setup();

	await expect(
		get({ deliveryTargetId: draftOnlyTargetId })
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		reorder([], { deliveryTargetId: draftOnlyTargetId })
	).rejects.toMatchObject({ code: "CONFLICT" });
});

test("an unknown target, an inaccessible project and a missing session are refused", async () => {
	await expect(
		setup().get({ deliveryTargetId: "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d1999" })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(setup({ hasAccess: false }).get()).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(setup({ hasAccess: false }).reorder([])).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(setup({ session: false }).get()).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
});

test("a newer revision activated while a reorder is computed is not overwritten by the stale plan", async () => {
	const { catalog, get, reorder, state } = setup();
	await reorder([quality, approval, usageTest]);
	const target = catalog.deliveryTargets[0] as unknown as {
		activeRevision: Record<string, unknown>;
	};
	const staleRevision = target.activeRevision;
	state.onFamilyRead = () => {
		state.onFamilyRead = undefined;
		target.activeRevision = {
			...staleRevision,
			id: "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d4999",
			revisionNumber: 2,
		};
	};

	await expect(reorder([usageTest, approval, quality])).rejects.toMatchObject({
		code: "CONFLICT",
	});

	target.activeRevision = staleRevision;
	expect((await get()).workItems.map((work) => work.id)).toEqual([
		quality,
		approval,
		usageTest,
	]);
});

test("a family whose readiness is unavailable blocks, but losing project access is an error and not a blocker", async () => {
	const unavailable = setup();
	unavailable.state.unreadableFamilies = [slime];

	const plan = await unavailable.get();

	expect(plan.targetReadiness).toBe("blocked");
	expect(plan.blockers.map((blocker) => blocker.kind)).toContain(
		"family_readiness_unavailable"
	);

	const unauthorized = setup();
	unauthorized.state.unreadableFamilies = [slime];
	unauthorized.state.onFamilyRead = () => {
		unauthorized.state.accessLost = true;
	};
	await expect(unauthorized.get()).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(unauthorized.reorder([])).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

test("an unavailable dependency catalog is an error and not an empty one", async () => {
	const { get, reorder, state } = setup();
	state.dependenciesUnavailable = true;

	await expect(get()).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(reorder([approval, quality, usageTest])).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});
