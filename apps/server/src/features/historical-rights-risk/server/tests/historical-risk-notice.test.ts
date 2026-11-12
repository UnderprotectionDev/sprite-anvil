import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { DeliveryFulfilment } from "@sprite-anvil/api/delivery-fulfilment-records";
import type { RightsEvidencePolicy } from "@sprite-anvil/api/delivery-planning-inputs";
import type { DeliveryTarget } from "@sprite-anvil/api/delivery-planning-outputs";
import type {
	RightsRecord,
	RightsRecordState,
	RightsRecordStore,
} from "@sprite-anvil/api/rights-records";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { StoredHistoricalRiskNotice } from "../historical-risk-notice-storage";
import { createHistoricalRiskNoticeStore } from "../historical-risk-notice-store";
import { withHistoricalRiskDetection } from "../rights-record-risk-detection";
import { createMemoryHistoricalRiskNoticeStorage } from "./memory-historical-risk-notice-storage";

const notFoundText = /not found/i;
const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
const targetId = "3a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2d01";
const revisionOneId = "4a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2e01";
const revisionTwoId = "4a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2e02";
const fulfilmentId = "6a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2f01";
const bundleId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b01";
const pinnedAssetRecordId = "8a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2c01";
const unrelatedAssetRecordId = "8a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2c02";
const pinnedRightsId = "9a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2900";
const referenceId = "9a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2999";

const strictPolicy: RightsEvidencePolicy = {
	acceptableStates: ["documented", "assertion_only"],
	requireRecordFor: ["results"],
};
const openPolicy: RightsEvidencePolicy = {
	acceptableStates: ["documented", "assertion_only", "restricted"],
	requireRecordFor: ["results"],
};

const revision = (
	id: string,
	revisionNumber: number,
	rightsEvidencePolicy: RightsEvidencePolicy
) => ({ id, revisionNumber, rightsEvidencePolicy });

let nextRightsId = 0;
function recordId() {
	nextRightsId += 1;
	return `9a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2${String(nextRightsId).padStart(3, "0")}`;
}

function rightsInput(
	assetRecordId: string,
	state: RightsRecordState,
	extra: { id?: string; referenceId?: string | null } = {}
) {
	return {
		assertedScope: null,
		assetRecordId,
		evidence: state === "documented" ? "License PDF" : null,
		id: extra.id ?? recordId(),
		projectId,
		referenceId: extra.referenceId ?? null,
		restrictions: state === "restricted" ? "No commercial use" : null,
		rightsHolderOrProvider: null,
		source: null,
		state,
		uncertainty: null,
	};
}

function setup(
	options: {
		activeRevision?: ReturnType<typeof revision>;
		failFirstNoticeInsert?: boolean;
		hasAccess?: boolean;
		policy?: RightsEvidencePolicy;
	} = {}
) {
	const policy = options.policy ?? strictPolicy;
	const state = {
		activeRevision:
			options.activeRevision ?? revision(revisionOneId, 1, policy),
		hasAccess: options.hasAccess ?? true,
	};
	const revisions = [
		revision(revisionOneId, 1, policy),
		...(state.activeRevision.id === revisionTwoId
			? [state.activeRevision]
			: []),
	];
	const deliveryTargets = {
		list: (_user: string, requestedProject: string) =>
			Promise.resolve(
				state.hasAccess && requestedProject === projectId
					? {
							deliveryTargets: [
								{
									activeRevision: state.activeRevision,
									drafts: [],
									id: targetId,
									name: "Demo",
									purpose: "demo",
									revisions,
								} as unknown as DeliveryTarget,
							],
						}
					: null
			),
	};
	const fulfilment: DeliveryFulfilment = {
		createdAt: "2026-11-10T10:00:00.000Z",
		deliveryTargetId: targetId,
		draftId: "draft-1",
		id: fulfilmentId,
		projectId,
		isCurrent: true,
		requirements: [
			{
				assetFamilyId: "fam-a",
				assetFamilyName: "Hero",
				assetVersionIds: ["v-idle"],
				bundleId,
				itemId: "idle",
				itemKind: "state",
				itemName: "Idle",
				manifestDigest: "ab".repeat(32),
				requiredSetRevisionId: "rs-1",
				resolution: "only_bundle",
			},
		],
		revisionId: revisionOneId,
		revisionNumber: 1,
	};
	const bundles = {
		get: (_user: string, requestedProject: string, id: string) =>
			Promise.resolve(
				requestedProject === projectId && id === bundleId
					? ({
							id: bundleId,
							manifest: {
								files: [
									{
										assetFamilyId: "fam-a",
										assetRecordId: pinnedAssetRecordId,
										assetVersionId: "v-idle",
										itemId: "idle",
									},
								],
								rightsEvidence: [
									{
										assetRecordId: pinnedAssetRecordId,
										rightsRecordId: pinnedRightsId,
										state: "documented",
										versionNumber: 1,
									},
								],
							},
						} as never)
					: null
			),
	};
	const records: RightsRecord[] = [];
	const baseRights: RightsRecordStore = {
		canAccessAssetRecord: () => Promise.resolve(true),
		canAccessReference: () => Promise.resolve(true),
		createRevision: (_user, input) => {
			const existing = records.find((entry) => entry.id === input.id);
			const record =
				existing ??
				({
					...input,
					createdAt: new Date().toISOString(),
					evidenceFile: null,
					versionNumber:
						records.filter(
							(entry) =>
								entry.assetRecordId === input.assetRecordId &&
								(entry.referenceId ?? null) === (input.referenceId ?? null)
						).length + 2,
				} as unknown as RightsRecord);
			if (!existing) {
				records.push(record);
			}
			return Promise.resolve({ ok: true as const, record });
		},
		createRevisionWithEvidenceFile: () => Promise.reject(new Error("not used")),
		getEvidenceFile: () => Promise.resolve(null),
		list: (_user, requestedProject, assetRecordId, requestedReference) =>
			Promise.resolve(
				requestedProject === projectId
					? records.filter(
							(entry) =>
								entry.assetRecordId === assetRecordId &&
								(entry.referenceId ?? null) === requestedReference
						)
					: null
			),
	};
	const memoryStorage = createMemoryHistoricalRiskNoticeStorage();
	let failNextInsert = options.failFirstNoticeInsert ?? false;
	const storage = {
		...memoryStorage,
		insertNotice: (notice: StoredHistoricalRiskNotice) => {
			if (failNextInsert) {
				failNextInsert = false;
				return Promise.reject(new Error("notice storage unavailable"));
			}
			return memoryStorage.insertNotice(notice);
		},
	};
	let tick = 0;
	const now = () => {
		tick += 1;
		return new Date(Date.UTC(2026, 10, 12, 8, 0, tick));
	};
	const store = createHistoricalRiskNoticeStore({
		bundles,
		deliveryTargets,
		fulfilments: {
			list: (_user, input) =>
				Promise.resolve(
					input.projectId === projectId && input.deliveryTargetId === targetId
						? { fulfilments: [fulfilment] }
						: null
				),
		},
		now,
		rights: baseRights,
		storage,
	});
	const rights = withHistoricalRiskDetection(baseRights, store);
	const context = () =>
		({
			historicalRiskNoticeStore: store,
			session: { user: { id: userId } },
		}) as unknown as Context;
	return {
		bundleChanged: () => JSON.stringify(bundles),
		fulfilmentSnapshot: () => JSON.stringify(fulfilment),
		listNotices: (input: Record<string, unknown> = {}) =>
			call(
				appRouter.historicalRiskNotices.list,
				{ deliveryTargetId: targetId, projectId, ...input },
				{ context: context() }
			),
		noticeSnapshot: memoryStorage.snapshot,
		rights,
		state,
	};
}

test("a Restricted Rights Record revision creates a notice that shows source, new revision, usage and detection time", async () => {
	const world = setup();
	const created = await world.rights.createRevision(
		userId,
		rightsInput(pinnedAssetRecordId, "restricted")
	);
	if (!created.ok) {
		throw new Error("rights record not created");
	}

	const { notices } = await world.listNotices();

	expect(notices).toHaveLength(1);
	expect(notices[0]).toMatchObject({
		affectedUsage: [
			{
				assetFamilyId: "fam-a",
				assetFamilyName: "Hero",
				bundleId,
				itemId: "idle",
				itemName: "Idle",
			},
		],
		assetRecordId: pinnedAssetRecordId,
		fulfilmentId,
		pinnedPolicy: strictPolicy,
		pinnedRights: {
			rightsRecordId: pinnedRightsId,
			state: "documented",
			versionNumber: 1,
		},
		revisionId: revisionOneId,
		rightsRecordId: created.record.id,
		rightsRecordState: "restricted",
		rightsRecordVersionNumber: created.record.versionNumber,
	});
	expect(notices[0]?.detectedAt).toBe("2026-11-12T08:00:01.000Z");
});

test("a notice leaves the Delivery Fulfilment and its pinned evidence unchanged", async () => {
	const world = setup();
	const fulfilmentBefore = world.fulfilmentSnapshot();
	const bundlesBefore = world.bundleChanged();

	await world.rights.createRevision(
		userId,
		rightsInput(pinnedAssetRecordId, "restricted")
	);

	expect(world.fulfilmentSnapshot()).toBe(fulfilmentBefore);
	expect(world.bundleChanged()).toBe(bundlesBefore);
	expect((await world.listNotices()).notices).toHaveLength(1);
});

test("the notice is immutable: repeating the same creation adds nothing and keeps the first detection time", async () => {
	const world = setup();
	const input = rightsInput(pinnedAssetRecordId, "restricted");
	await world.rights.createRevision(userId, input);
	const first = await world.listNotices();
	const stored = world.noticeSnapshot();

	await world.rights.createRevision(userId, input);

	expect(world.noticeSnapshot()).toBe(stored);
	expect(await world.listNotices()).toEqual(first);
});

test("a retry after a failed detection replays the saved revision and still writes the notice", async () => {
	const world = setup({ failFirstNoticeInsert: true });
	const input = rightsInput(pinnedAssetRecordId, "restricted");

	await expect(world.rights.createRevision(userId, input)).rejects.toThrow(
		"notice storage unavailable"
	);
	expect((await world.listNotices()).notices).toHaveLength(0);

	const retried = await world.rights.createRevision(userId, input);

	expect(retried.ok).toBe(true);
	expect((await world.listNotices()).notices).toHaveLength(1);
});

test("a revision the pinned policy accepts creates no notice", async () => {
	const world = setup();

	await world.rights.createRevision(
		userId,
		rightsInput(pinnedAssetRecordId, "assertion_only")
	);

	expect((await world.listNotices()).notices).toEqual([]);
});

test("a revision of an Asset Record the bundle did not pin creates no notice", async () => {
	const world = setup();

	await world.rights.createRevision(
		userId,
		rightsInput(unrelatedAssetRecordId, "restricted")
	);

	expect((await world.listNotices()).notices).toEqual([]);
});

test("a pinned policy that requires no result records creates no notice", async () => {
	const world = setup({
		policy: { acceptableStates: ["documented"], requireRecordFor: [] },
	});

	await world.rights.createRevision(
		userId,
		rightsInput(pinnedAssetRecordId, "restricted")
	);

	expect((await world.listNotices()).notices).toEqual([]);
});

test("a reference-level revision creates no notice because bundles pin only result evidence", async () => {
	const world = setup();

	await world.rights.createRevision(
		userId,
		rightsInput(pinnedAssetRecordId, "restricted", { referenceId })
	);

	expect((await world.listNotices()).notices).toEqual([]);
});

test("the notice shows how the current policy evaluates the new state without rewriting the pinned policy", async () => {
	const world = setup({
		activeRevision: revision(revisionTwoId, 2, openPolicy),
		policy: strictPolicy,
	});

	await world.rights.createRevision(
		userId,
		rightsInput(pinnedAssetRecordId, "restricted")
	);
	const [notice] = (await world.listNotices()).notices;

	expect(notice?.pinnedPolicy).toEqual(strictPolicy);
	expect(notice?.revisionId).toBe(revisionOneId);
	expect(notice?.currentPolicy).toEqual({
		accepted: true,
		revisionId: revisionTwoId,
		revisionNumber: 2,
	});
});

test("the current policy rejects the new state when the active revision still excludes it", async () => {
	const world = setup();

	await world.rights.createRevision(
		userId,
		rightsInput(pinnedAssetRecordId, "unknown")
	);
	const [notice] = (await world.listNotices()).notices;

	expect(notice?.currentPolicy).toEqual({
		accepted: false,
		revisionId: revisionOneId,
		revisionNumber: 1,
	});
});

test("the notice list is not found for a project the user cannot read", async () => {
	const world = setup({ hasAccess: false });

	await expect(world.listNotices()).rejects.toThrow(notFoundText);
	await expect(
		world.listNotices({ projectId: otherProjectId })
	).rejects.toThrow(notFoundText);
});
