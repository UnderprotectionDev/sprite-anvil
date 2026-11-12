import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { DeliveryTarget } from "@sprite-anvil/api/delivery-planning-outputs";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDeliveryFulfilmentStore } from "../delivery-fulfilment-store";
import { createFulfilmentMappingStore } from "../fulfilment-mapping-store";
import { createMemoryDeliveryFulfilmentStorage } from "./memory-delivery-fulfilment-storage";
import { createMemoryFulfilmentMappingStorage } from "./memory-fulfilment-mapping-storage";

export const userId = "user-1";
export const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
export const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
export const targetId = "3a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2d01";
export const otherTargetId = "3a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2d02";
export const revisionId = "4a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2e01";
export const newerRevisionId = "4a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2e09";
export const bundleA = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b01";
export const bundleB = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b02";
export const bundleC = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b03";
export const unknownId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b99";

export const item = (id: string, kind = "state") => ({
	assetRecordIds: ["rec-1"],
	disposition: "required",
	id,
	kind,
	name: id,
});

export function makeRevision(
	id: string,
	revisionNumber: number,
	contextRevisionNumber = 1
) {
	return {
		activatedAt: "2026-11-11T09:00:00.000Z",
		contextRevisionId: `ctx-${contextRevisionNumber}`,
		contextRevisionNumber,
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

export function fullBundle(
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

export const bundleAFiles: Files = [
	{ assetVersionId: "v-idle", itemId: "idle" },
	{ assetVersionId: "v-run", itemId: "run" },
	{ assetVersionId: "v-ut", itemId: "ut-1" },
];

export const cleanBundles = () => [
	fullBundle(bundleA, "2026-11-11T10:00:00.000Z", bundleAFiles),
];

export const conflictingBundles = () => [
	fullBundle(bundleA, "2026-11-11T10:00:00.000Z", bundleAFiles),
	fullBundle(bundleB, "2026-11-12T10:00:00.000Z", [
		{ assetVersionId: "v-idle-2", itemId: "idle" },
		{ assetVersionId: "v-run", itemId: "run" },
	]),
];

export function setup(
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
		/** Revisions that were active earlier; the catalog still lists them. */
		pastRevisions: [] as ReturnType<typeof makeRevision>[],
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
				revisions: [
					...state.pastRevisions,
					...(state.activeRevision ? [state.activeRevision] : []),
				],
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
		compare: (input: Record<string, unknown>) =>
			call(
				appRouter.deliveryFulfilment.compareFulfilments,
				{ projectId, ...input } as never,
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
