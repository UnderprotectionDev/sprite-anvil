import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { DeliveryTarget } from "@sprite-anvil/api/delivery-planning-outputs";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createFulfilmentMappingStore } from "../fulfilment-mapping-store";
import { createMemoryFulfilmentMappingStorage } from "./memory-fulfilment-mapping-storage";

const deliveryStatusText = /delivered|deliveryStatus/;
const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
const targetId = "3a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2d01";
const revisionId = "4a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2e01";
const bundleA = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b01";
const bundleB = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b02";
const unknownId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b99";

const item = (id: string, kind = "state") => ({
	assetRecordIds: ["rec-1"],
	disposition: "required",
	id,
	kind,
	name: id,
});

const revision = {
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
	id: revisionId,
	revisionNumber: 1,
	runtimeValidationCriterion: null,
	scopeDiff: null,
};

function bundleSummary(
	id: string,
	createdAt: string,
	forRevision = revisionId
) {
	return {
		createdAt,
		deliveryTargetRevisionId: forRevision,
		id,
		manifestDigest: id.slice(-2).repeat(32),
	};
}

function fullBundle(
	id: string,
	createdAt: string,
	files: { assetVersionId: string; itemId: string }[]
) {
	return {
		...bundleSummary(id, createdAt),
		manifest: {
			files: files.map((file) => ({ ...file, assetFamilyId: "fam-a" })),
			requiredSets: [{ assetFamilyId: "fam-a", revisionId: "rs-1" }],
		},
	};
}

function setup(
	options: {
		activeRevision?: boolean;
		bundles?: ReturnType<typeof fullBundle>[];
		hasAccess?: boolean;
		ready?: boolean;
	} = {}
) {
	const bundles = options.bundles ?? [
		fullBundle(bundleA, "2026-11-11T10:00:00.000Z", [
			{ assetVersionId: "v-idle", itemId: "idle" },
			{ assetVersionId: "v-run", itemId: "run" },
			{ assetVersionId: "v-ut", itemId: "ut-1" },
		]),
	];
	let tick = 0;
	const storage = createMemoryFulfilmentMappingStorage();
	const target = {
		activeRevision: options.activeRevision === false ? null : revision,
		drafts: [],
		id: targetId,
		name: "Demo",
		purpose: "demo",
		revisions: [revision],
	} as unknown as DeliveryTarget;
	const store = createFulfilmentMappingStore({
		bundles: {
			get: (_user, requestedProject, bundleId) =>
				Promise.resolve(
					requestedProject === projectId
						? ((bundles.find((entry) => entry.id === bundleId) as never) ??
								null)
						: null
				),
			list: (_user, requestedProject) =>
				Promise.resolve(
					requestedProject === projectId
						? ({
								bundles: bundles.map((entry) => entry) as never,
								latestBundleId: bundles.at(-1)?.id ?? null,
							} as never)
						: null
				),
		},
		deliveryTargets: {
			list: (_user, requestedProject) =>
				Promise.resolve(
					(options.hasAccess ?? true) && requestedProject === projectId
						? { deliveryTargets: [target] }
						: null
				),
		},
		now: () => {
			tick += 1;
			return new Date(Date.UTC(2026, 10, 11, 12, 0, tick));
		},
		readinessPlans: {
			get: () =>
				Promise.resolve({
					plan: {
						revisionId,
						targetReadiness: (options.ready ?? true) ? "ready" : "blocked",
					} as never,
					status: "found",
				}),
		},
		runtimeValidation: {
			list: () => Promise.resolve({ records: [] }),
		},
		storage,
	});
	const context = () =>
		({
			fulfilmentMappingStore: store,
			session: { user: { id: userId } },
		}) as unknown as Context;
	return {
		get: (draftId: string, project = projectId) =>
			call(
				appRouter.deliveryFulfilment.getMapping,
				{ draftId, projectId: project },
				{ context: context() }
			),
		list: () =>
			call(
				appRouter.deliveryFulfilment.listMappings,
				{ deliveryTargetId: targetId, projectId },
				{ context: context() }
			),
		prepare: (input: Record<string, unknown> = {}) =>
			call(
				appRouter.deliveryFulfilment.prepareMapping,
				{
					deliveryTargetId: targetId,
					idempotencyKey: "key-1",
					projectId,
					...input,
				} as never,
				{ context: context() }
			),
		storage,
	};
}

test("prepares a mapping draft for the active revision and re-reads it from storage", async () => {
	const { get, prepare, storage } = setup();
	const created = await prepare();
	expect(created.status).toBe("created");
	expect(created.draft.revisionId).toBe(revisionId);
	expect(created.draft.requirements.map((entry) => entry.status)).toEqual([
		"mapped",
		"mapped",
		"mapped",
	]);
	const reread = await get(created.draft.id);
	expect(reread).toEqual(created.draft);
	expect(storage.snapshot()).toContain("v-idle");
});

test("shows missing and conflicting requirements to the user", async () => {
	const { prepare } = setup({
		bundles: [
			fullBundle(bundleA, "2026-11-11T10:00:00.000Z", [
				{ assetVersionId: "v-idle", itemId: "idle" },
				{ assetVersionId: "v-run", itemId: "run" },
			]),
			fullBundle(bundleB, "2026-11-12T10:00:00.000Z", [
				{ assetVersionId: "v-idle-2", itemId: "idle" },
				{ assetVersionId: "v-run", itemId: "run" },
			]),
		],
	});
	const { draft } = await prepare();
	expect(
		Object.fromEntries(draft.requirements.map((r) => [r.itemId, r.status]))
	).toEqual({ idle: "conflict", run: "agreed", "ut-1": "missing" });
	const idle = draft.requirements.find((r) => r.itemId === "idle");
	expect(idle?.proposedBundleId).toBeNull();
	expect(idle?.candidates.map((c) => c.bundleId).sort()).toEqual([
		bundleA,
		bundleB,
	]);
});

test("the newest-bundle marker never decides a requirement", async () => {
	const { prepare } = setup({
		bundles: [
			fullBundle(bundleA, "2026-11-11T10:00:00.000Z", [
				{ assetVersionId: "v-idle", itemId: "idle" },
			]),
			// A newer bundle (the latest marker) that is not for this revision.
			{
				...fullBundle(bundleB, "2026-11-12T10:00:00.000Z", [
					{ assetVersionId: "v-run", itemId: "run" },
					{ assetVersionId: "v-ut", itemId: "ut-1" },
				]),
				deliveryTargetRevisionId: "4a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2e99",
			},
		],
	});
	const { draft } = await prepare();
	expect(draft.requirements.map((r) => r.status)).toEqual([
		"mapped",
		"missing",
		"missing",
	]);
});

test("replays the same key and does not write a second draft", async () => {
	const { list, prepare } = setup();
	const first = await prepare();
	const second = await prepare();
	expect(second.status).toBe("replayed");
	expect(second.draft.id).toBe(first.draft.id);
	expect((await list()).drafts).toHaveLength(1);
	const third = await prepare({ idempotencyKey: "key-2" });
	expect(third.draft.id).not.toBe(first.draft.id);
	expect((await list()).drafts[0]?.id).toBe(third.draft.id);
});

test("preparing creates no Delivery Fulfilment and no delivery status", async () => {
	const { prepare } = setup();
	const { draft } = await prepare();
	expect(JSON.stringify(draft)).not.toMatch(deliveryStatusText);
});

test("refuses a target that is not ready", async () => {
	const { list, prepare } = setup({ ready: false });
	await expect(prepare()).rejects.toMatchObject({ code: "CONFLICT" });
	expect((await list()).drafts).toEqual([]);
});

test("refuses a target without an active revision", async () => {
	const { prepare } = setup({ activeRevision: false });
	await expect(prepare()).rejects.toMatchObject({ code: "CONFLICT" });
});

test("hides drafts and targets from a user without project access", async () => {
	const { get, prepare } = setup({ hasAccess: false });
	await expect(prepare()).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(get(unknownId)).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("does not read a draft through another project or an unknown id", async () => {
	const { get, prepare } = setup();
	const { draft } = await prepare();
	await expect(get(unknownId)).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(get(draft.id, otherProjectId)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

test("does not prepare for an unknown Delivery Target", async () => {
	const { prepare } = setup();
	await expect(prepare({ deliveryTargetId: unknownId })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});
