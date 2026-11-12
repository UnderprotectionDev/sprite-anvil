import { expect, test } from "bun:test";
import { buildFulfilmentMapping } from "./delivery-fulfilment-mapping";
import type { DeliveryTargetRevision } from "./delivery-planning-outputs";

const revisionId = "11111111-1111-4111-8111-111111111111";
const otherRevisionId = "11111111-1111-4111-8111-111111111112";

const revision = {
	families: [
		{
			assetFamilyId: "family-a",
			assetFamilyName: "Hero",
			requiredItems: [
				{
					assetRecordIds: ["rec-1"],
					disposition: "required",
					id: "idle",
					kind: "state",
					name: "Idle",
				},
				{
					assetRecordIds: [],
					disposition: "optional",
					id: "wave",
					kind: "state",
					name: "Wave",
				},
			],
			requiredSetRevisionId: "rs-1",
			requiredSetRevisionNumber: 1,
			usageTests: [
				{
					assetRecordIds: ["rec-1"],
					disposition: "required",
					id: "ut-1",
					kind: "usage_test",
					name: "On ground",
					testId: "t1",
				},
			],
		},
	],
	id: revisionId,
	runtimeValidationCriterion: null,
} as unknown as DeliveryTargetRevision;

function bundle(
	id: string,
	options: {
		createdAt?: string;
		files?: { assetVersionId: string; itemId: string }[];
		requiredSetRevisionId?: string;
		revision?: string | null;
	} = {}
) {
	return {
		createdAt: options.createdAt ?? "2026-11-11T10:00:00.000Z",
		deliveryTargetRevisionId:
			options.revision === undefined ? revisionId : options.revision,
		id,
		manifest: {
			files: (options.files ?? []).map((file) => ({
				...file,
				assetFamilyId: "family-a",
			})),
			requiredSets: [
				{
					assetFamilyId: "family-a",
					revisionId: options.requiredSetRevisionId ?? "rs-1",
				},
			],
		},
		manifestDigest: id.padEnd(64, "0"),
	};
}

const all = [
	{ assetVersionId: "v-idle", itemId: "idle" },
	{ assetVersionId: "v-ut", itemId: "ut-1" },
];

function build(bundles: ReturnType<typeof bundle>[]) {
	return buildFulfilmentMapping({
		bundles: bundles as never,
		recordsByBundleId: new Map(),
		revision,
	});
}

test("lists one row per required item and usage test, skipping optional items", () => {
	const { requirements } = build([]);
	expect(requirements.map((entry) => [entry.itemId, entry.status])).toEqual([
		["idle", "missing"],
		["ut-1", "missing"],
	]);
	expect(requirements[0]?.proposedBundleId).toBeNull();
});

test("maps a requirement met by one bundle to its exact Asset Versions", () => {
	const { requirements } = build([bundle("b1", { files: all })]);
	expect(requirements[0]).toMatchObject({
		candidates: [{ assetVersionIds: ["v-idle"], bundleId: "b1" }],
		proposedBundleId: "b1",
		status: "mapped",
	});
});

test("shows a requirement the bundle lacks as missing while others map", () => {
	const { requirements } = build([bundle("b1", { files: [all[0] as never] })]);
	expect(requirements.map((entry) => entry.status)).toEqual([
		"mapped",
		"missing",
	]);
});

test("two bundles pinning different Asset Versions are a conflict with no proposal", () => {
	const { requirements } = build([
		bundle("b1", { files: all }),
		bundle("b2", {
			createdAt: "2026-11-12T10:00:00.000Z",
			files: [{ assetVersionId: "v-idle-2", itemId: "idle" }, all[1] as never],
		}),
	]);
	expect(requirements[0]?.status).toBe("conflict");
	expect(requirements[0]?.proposedBundleId).toBeNull();
	expect(requirements[0]?.candidates).toHaveLength(2);
	// identical pins agree automatically
	expect(requirements[1]?.status).toBe("agreed");
});

test("an agreed requirement proposes the earliest bundle, never the newest", () => {
	const { requirements } = build([
		bundle("b2", { createdAt: "2026-11-12T10:00:00.000Z", files: all }),
		bundle("b1", { files: all }),
	]);
	expect(requirements[0]?.status).toBe("agreed");
	expect(requirements[0]?.proposedBundleId).toBe("b1");
});

test("bundles of another revision or with ad hoc scope are not candidates", () => {
	const { requirements, bundleChecks } = build([
		bundle("other", { files: all, revision: otherRevisionId }),
		bundle("adhoc", { files: all, revision: null }),
	]);
	expect(requirements.every((entry) => entry.status === "missing")).toBe(true);
	expect(bundleChecks).toEqual([]);
});

test("a bundle built from another Required Set revision does not meet the requirement", () => {
	const { requirements } = build([
		bundle("b1", { files: all, requiredSetRevisionId: "rs-0" }),
	]);
	expect(requirements.every((entry) => entry.status === "missing")).toBe(true);
});

test("records runtime validation as a per-bundle check, not as a requirement row", () => {
	const { bundleChecks, requirements } = build([bundle("b1", { files: all })]);
	expect(requirements).toHaveLength(2);
	expect(bundleChecks[0]).toMatchObject({
		bundleId: "b1",
		runtimeValidation: { ready: true, required: false },
	});
});
