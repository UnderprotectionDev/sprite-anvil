import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { DeliveryTarget } from "@sprite-anvil/api/delivery-planning-outputs";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDeliveryFulfilmentStore } from "../delivery-fulfilment-store";
import { createFulfilmentMappingStore } from "../fulfilment-mapping-store";
import { createMemoryDeliveryFulfilmentStorage } from "./memory-delivery-fulfilment-storage";
import { createMemoryFulfilmentMappingStorage } from "./memory-fulfilment-mapping-storage";

const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
const targetId = "3a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2d01";
const otherTargetId = "3a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2d02";
const revisionId = "4a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2e01";
const newerRevisionId = "4a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2e09";
const bundleA = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b01";
const bundleB = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b02";
const bundleC = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b03";
const unknownId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b99";

const notReadyText = /Ready/;
const missingText = /no Export Bundle/;
const conflictText = /conflicting/;
const staleText = /no longer the active revision/;
const noActiveText = /no activated revision/;
const invalidSelectionText = /selection/i;
const idempotencyText = /idempotency/i;
const noRequirementsText = /no requirements/i;

const item = (id: string, kind = "state") => ({
	assetRecordIds: ["rec-1"],
	disposition: "required",
	id,
	kind,
	name: id,
});

function makeRevision(id: string, revisionNumber: number) {
	return {
		activatedAt: "2026-11-11T09:00:00.000Z",
		contextRevisionId: "ctx",
		contextRevisionNumber: 1,
		draftId: "4a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2e02",
		families: [
			{
				assetFamilyId: "fam-a",
				assetFamilyName: "Hero",
				requiredItems: [item("idle"), item("run")],
				requiredSetRevisionId: "rs-1",
				requiredSetRevisionNumber: 1,
				usageTests: [{ ...item("ut-1", "usage_test"), testId: "t1" }],
			},
		],
		id,
		revisionNumber,
		runtimeValidationCriterion: null,
		scopeDiff: null,
	};
}

type Files = { assetVersionId: string; itemId: string }[];

function fullBundle(
	id: string,
	createdAt: string,
	files: Files,
	forRevision = revisionId
) {
	return {
		createdAt,
		deliveryTargetRevisionId: forRevision,
		id,
		manifest: {
			files: files.map((file) => ({ ...file, assetFamilyId: "fam-a" })),
			requiredSets: [{ assetFamilyId: "fam-a", revisionId: "rs-1" }],
		},
		manifestDigest: id.slice(-2).repeat(32),
	};
}

const bundleAFiles: Files = [
	{ assetVersionId: "v-idle", itemId: "idle" },
	{ assetVersionId: "v-run", itemId: "run" },
	{ assetVersionId: "v-ut", itemId: "ut-1" },
];

const cleanBundles = () => [
	fullBundle(bundleA, "2026-11-11T10:00:00.000Z", bundleAFiles),
];

const conflictingBundles = () => [
	fullBundle(bundleA, "2026-11-11T10:00:00.000Z", bundleAFiles),
	fullBundle(bundleB, "2026-11-12T10:00:00.000Z", [
		{ assetVersionId: "v-idle-2", itemId: "idle" },
		{ assetVersionId: "v-run", itemId: "run" },
	]),
];

function setup(
	options: {
		bundles?: ReturnType<typeof fullBundle>[];
		hasAccess?: boolean;
	} = {}
) {
	const state = {
		activeRevision: makeRevision(revisionId, 1) as ReturnType<
			typeof makeRevision
		> | null,
		bundles: options.bundles ?? cleanBundles(),
		hasAccess: options.hasAccess ?? true,
		ready: true,
	};
	let tick = 0;
	const now = () => {
		tick += 1;
		return new Date(Date.UTC(2026, 10, 11, 12, 0, tick));
	};
	const deliveryTargets = {
		list: (_user: string, requestedProject: string) => {
			const target = {
				activeRevision: state.activeRevision,
				drafts: [],
				id: targetId,
				name: "Demo",
				purpose: "demo",
				revisions: state.activeRevision ? [state.activeRevision] : [],
			} as unknown as DeliveryTarget;
			const other = { ...target, id: otherTargetId } as DeliveryTarget;
			return Promise.resolve(
				state.hasAccess && requestedProject === projectId
					? { deliveryTargets: [target, other] }
					: null
			);
		},
	};
	const readinessPlans = {
		get: () =>
			Promise.resolve({
				plan: {
					revisionId: state.activeRevision?.id,
					targetReadiness: state.ready ? "ready" : "blocked",
				} as never,
				status: "found" as const,
			}),
	};
	const mappingStorage = createMemoryFulfilmentMappingStorage();
	const mappingStore = createFulfilmentMappingStore({
		bundles: {
			get: (_user, requestedProject, bundleId) =>
				Promise.resolve(
					requestedProject === projectId
						? ((state.bundles.find(
								(entry) => entry.id === bundleId
							) as never) ?? null)
						: null
				),
			list: (_user, requestedProject) =>
				Promise.resolve(
					requestedProject === projectId
						? ({
								bundles: state.bundles as never,
								latestBundleId: state.bundles.at(-1)?.id ?? null,
							} as never)
						: null
				),
		},
		deliveryTargets,
		now,
		readinessPlans,
		runtimeValidation: { list: () => Promise.resolve({ records: [] }) },
		storage: mappingStorage,
	});
	const storage = createMemoryDeliveryFulfilmentStorage();
	const store = createDeliveryFulfilmentStore({
		deliveryTargets,
		drafts: mappingStorage,
		now,
		readinessPlans,
		storage,
	});
	const context = () =>
		({
			deliveryFulfilmentStore: store,
			fulfilmentMappingStore: mappingStore,
			session: { user: { id: userId } },
		}) as unknown as Context;
	const prepare = (key = "prep-1") =>
		call(
			appRouter.deliveryFulfilment.prepareMapping,
			{ deliveryTargetId: targetId, idempotencyKey: key, projectId },
			{ context: context() }
		);
	return {
		finalize: (input: Record<string, unknown>) =>
			call(
				appRouter.deliveryFulfilment.finalize,
				{
					deliveryTargetId: targetId,
					idempotencyKey: "fin-1",
					projectId,
					selections: [],
					...input,
				} as never,
				{ context: context() }
			),
		get: (fulfilmentId: string, project = projectId) =>
			call(
				appRouter.deliveryFulfilment.getFulfilment,
				{ fulfilmentId, projectId: project },
				{ context: context() }
			),
		list: (deliveryTargetId = targetId) =>
			call(
				appRouter.deliveryFulfilment.listFulfilments,
				{ deliveryTargetId, projectId },
				{ context: context() }
			),
		mappingStorage,
		prepare,
		state,
		storage,
	};
}

const selectIdle = (bundleId: string) => ({
	assetFamilyId: "fam-a",
	bundleId,
	itemId: "idle",
});

async function conflictDraft(env: ReturnType<typeof setup>) {
	return (await env.prepare()).draft;
}

test("a conflict-free mapping finalizes into an immutable Fulfilment that is re-read from storage", async () => {
	const env = setup();
	const { draft } = await env.prepare();
	const created = await env.finalize({ draftId: draft.id });
	expect(created.status).toBe("created");
	expect(created.fulfilment.revisionId).toBe(revisionId);
	expect(created.fulfilment.draftId).toBe(draft.id);
	expect(
		created.fulfilment.requirements.map((row) => [
			row.itemId,
			row.bundleId,
			row.assetVersionIds,
			row.resolution,
		])
	).toEqual([
		["idle", bundleA, ["v-idle"], "only_bundle"],
		["run", bundleA, ["v-run"], "only_bundle"],
		["ut-1", bundleA, ["v-ut"], "only_bundle"],
	]);
	expect(await env.get(created.fulfilment.id)).toEqual(created.fulfilment);
	expect(created.fulfilment.isCurrent).toBe(true);
	expect(env.storage.snapshot()).toContain("v-idle");
});

test("identical pins agree on the earliest bundle and a user selection resolves a conflict", async () => {
	const env = setup({ bundles: conflictingBundles() });
	const draft = await conflictDraft(env);
	const { fulfilment } = await env.finalize({
		draftId: draft.id,
		selections: [selectIdle(bundleB)],
	});
	const byItem = Object.fromEntries(
		fulfilment.requirements.map((row) => [row.itemId, row])
	);
	expect(byItem.idle).toMatchObject({
		assetVersionIds: ["v-idle-2"],
		bundleId: bundleB,
		resolution: "user_selected",
	});
	expect(byItem.run).toMatchObject({
		bundleId: bundleA,
		resolution: "identical_pins",
	});
	expect(byItem["ut-1"]).toMatchObject({
		bundleId: bundleA,
		resolution: "only_bundle",
	});
});

test("an unresolved conflict blocks finalizing and writes nothing", async () => {
	const env = setup({ bundles: conflictingBundles() });
	const draft = await conflictDraft(env);
	await expect(env.finalize({ draftId: draft.id })).rejects.toMatchObject({
		code: "CONFLICT",
		message: expect.stringMatching(conflictText),
	});
	expect((await env.list()).fulfilments).toEqual([]);
	expect(env.storage.snapshot()).toBe("[]");
});

test("a missing requirement blocks finalizing even when every conflict is resolved", async () => {
	const env = setup({
		bundles: [
			fullBundle(bundleA, "2026-11-11T10:00:00.000Z", [
				{ assetVersionId: "v-idle", itemId: "idle" },
				{ assetVersionId: "v-run", itemId: "run" },
			]),
		],
	});
	const draft = await conflictDraft(env);
	await expect(env.finalize({ draftId: draft.id })).rejects.toMatchObject({
		code: "CONFLICT",
		message: expect.stringMatching(missingText),
	});
	expect((await env.list()).fulfilments).toEqual([]);
});

test("a draft with no requirements cannot finalize, because an empty Fulfilment would deliver nothing", async () => {
	const env = setup();
	const emptyId = "6c1f0f0e-8f4e-4c36-9a53-0b0b6a2f2c01";
	await env.mappingStorage.insertDraft({
		bundleChecks: [],
		createdAt: new Date(Date.UTC(2026, 10, 11, 13)),
		createdByUserId: userId,
		deliveryTargetId: targetId,
		id: emptyId,
		projectId,
		requestDigest: "empty",
		requirements: [],
		revisionId,
		revisionNumber: 1,
	});
	await expect(env.finalize({ draftId: emptyId })).rejects.toMatchObject({
		code: "CONFLICT",
		message: expect.stringMatching(noRequirementsText),
	});
	expect((await env.list()).fulfilments).toEqual([]);
	expect(env.storage.snapshot()).toBe("[]");
});

test("rejects selections that are not a candidate, not a conflict, or unknown", async () => {
	const env = setup({ bundles: conflictingBundles() });
	const draft = await conflictDraft(env);
	const notCandidate = selectIdle(bundleC);
	const notConflict = { ...selectIdle(bundleA), itemId: "run" };
	const unknownItem = { ...selectIdle(bundleA), itemId: "nope" };
	await Promise.all(
		[notCandidate, notConflict, unknownItem].map((selection) =>
			expect(
				env.finalize({
					draftId: draft.id,
					selections: [selectIdle(bundleA), selection],
				})
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: expect.stringMatching(invalidSelectionText),
			})
		)
	);
	await expect(
		env.finalize({
			draftId: draft.id,
			selections: [selectIdle(bundleA), selectIdle(bundleB)],
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect((await env.list()).fulfilments).toEqual([]);
});

test("finalize re-checks Ready: a target that became blocked since the draft is refused", async () => {
	const env = setup();
	const { draft } = await env.prepare();
	env.state.ready = false;
	await expect(env.finalize({ draftId: draft.id })).rejects.toMatchObject({
		code: "CONFLICT",
		message: expect.stringMatching(notReadyText),
	});
	expect((await env.list()).fulfilments).toEqual([]);
});

test("a draft of a revision that is no longer active is stale", async () => {
	const env = setup();
	const { draft } = await env.prepare();
	env.state.activeRevision = makeRevision(newerRevisionId, 2);
	await expect(env.finalize({ draftId: draft.id })).rejects.toMatchObject({
		code: "CONFLICT",
		message: expect.stringMatching(staleText),
	});
	env.state.activeRevision = null;
	await expect(
		env.finalize({ draftId: draft.id, idempotencyKey: "fin-2" })
	).rejects.toMatchObject({
		code: "CONFLICT",
		message: expect.stringMatching(noActiveText),
	});
	expect((await env.list()).fulfilments).toEqual([]);
});

test("a later Fulfilment of the same revision becomes current and the first stays unchanged", async () => {
	const env = setup({ bundles: conflictingBundles() });
	const draft = await conflictDraft(env);
	const first = await env.finalize({
		draftId: draft.id,
		selections: [selectIdle(bundleA)],
	});
	const before = JSON.stringify(
		(await env.get(first.fulfilment.id)).requirements
	);
	const second = await env.finalize({
		draftId: draft.id,
		idempotencyKey: "fin-2",
		selections: [selectIdle(bundleB)],
	});
	const { fulfilments } = await env.list();
	expect(fulfilments.map((entry) => [entry.id, entry.isCurrent])).toEqual([
		[second.fulfilment.id, true],
		[first.fulfilment.id, false],
	]);
	const reread = await env.get(first.fulfilment.id);
	expect(JSON.stringify(reread.requirements)).toBe(before);
	expect(reread.isCurrent).toBe(false);
});

test("a repeated key replays the first Fulfilment; the same key with other content conflicts", async () => {
	const env = setup({ bundles: conflictingBundles() });
	const draft = await conflictDraft(env);
	const first = await env.finalize({
		draftId: draft.id,
		selections: [selectIdle(bundleA)],
	});
	env.state.ready = false;
	const again = await env.finalize({
		draftId: draft.id,
		selections: [selectIdle(bundleA)],
	});
	expect(again.status).toBe("replayed");
	expect(again.fulfilment.id).toBe(first.fulfilment.id);
	expect((await env.list()).fulfilments).toHaveLength(1);
	env.state.ready = true;
	await expect(
		env.finalize({ draftId: draft.id, selections: [selectIdle(bundleB)] })
	).rejects.toMatchObject({
		code: "CONFLICT",
		message: expect.stringMatching(idempotencyText),
	});
});

test("hides drafts and Fulfilments from a user without access, another project, or another target", async () => {
	const env = setup();
	const { draft } = await env.prepare();
	const created = await env.finalize({ draftId: draft.id });
	await expect(
		env.finalize({ deliveryTargetId: otherTargetId, draftId: draft.id })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		env.finalize({ draftId: draft.id, projectId: otherProjectId })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(env.finalize({ draftId: unknownId })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(
		env.get(created.fulfilment.id, otherProjectId)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(env.get(unknownId)).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect((await env.list(otherTargetId)).fulfilments).toEqual([]);
	env.state.hasAccess = false;
	await expect(env.get(created.fulfilment.id)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(env.list()).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(env.finalize({ draftId: draft.id })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

test("a newer bundle is never applied to a Fulfilment that already exists", async () => {
	const env = setup();
	const { draft } = await env.prepare();
	const { fulfilment } = await env.finalize({ draftId: draft.id });
	env.state.bundles.push(
		fullBundle(bundleB, "2026-11-13T10:00:00.000Z", [
			{ assetVersionId: "v-idle-new", itemId: "idle" },
		])
	);
	const reread = await env.get(fulfilment.id);
	expect(reread).toEqual(fulfilment);
	expect(
		reread.requirements.find((row) => row.itemId === "idle")?.bundleId
	).toBe(bundleA);
});

test("a prepared draft alone is not a Fulfilment", async () => {
	const env = setup();
	await env.prepare();
	expect((await env.list()).fulfilments).toEqual([]);
});
