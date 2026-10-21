import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";

const input = {
	id: "8a3bf45a-0039-4761-b996-b0d45f732877",
	projectId: "project",
	assetFamilyId: "family",
	contractRevisionId: "effect@1",
	name: "Fire burst",
	looping: true,
	opacity: 0.75,
	cell: { width: 16, height: 16 },
	sceneAssetVersionId: "scene",
	frames: [
		{
			assetVersionId: "version-one",
			frameKey: "burst-0",
			durationMs: 80,
			region: { x: 0, y: 0, width: 24, height: 16 },
			offset: { x: -4, y: 0 },
		},
	],
	overflowAllowed: true,
	qualityWaiverEvidenceId: null,
	backgrounds: ["light", "dark", "transparent", "scene"],
	outcome: "passed",
	rationale: "The burst remains readable on all four backgrounds.",
};

function setup() {
	const records: unknown[] = [];
	const versions = [
		{
			id: "scene",
			assetRecordId: "scene-record",
			assetFamilyId: "scene-family",
			integrityVerified: true,
			contentDigest: "c".repeat(64),
			sourceImageDimensions: { width: 64, height: 64 },
		},
		{
			id: "version-one",
			assetFamilyId: "family",
			assetRecordId: "effect",
			sourceImageDimensions: { width: 24, height: 16 },
			integrityVerified: true,
			contentDigest: "a".repeat(64),
		},
		{
			id: "version-two",
			assetFamilyId: "family",
			assetRecordId: "effect",
			sourceImageDimensions: { width: 24, height: 16 },
			integrityVerified: true,
			contentDigest: "b".repeat(64),
		},
	];
	const context = {
		session: { user: { id: "owner" } },
		vfxAppearanceReviewStore: {
			list: (userId: string, projectId: string, assetFamilyId: string) =>
				userId === "owner" &&
				projectId === "project" &&
				assetFamilyId === "family"
					? records
					: null,
			append: (_userId: string, record: unknown) => {
				records.push(structuredClone(record));
				return record;
			},
			listAccessibleVersionIds: (
				userId: string,
				projectId: string,
				assetFamilyId: string
			) =>
				userId === "owner" &&
				projectId === "project" &&
				assetFamilyId === "family"
					? new Set(versions.map((version) => version.id))
					: null,
		},
		assetVersionStore: {
			list: () => ({
				assetVersions: versions,
				unitVersions: [],
				compositeVersions: [],
			}),
		},
		verifyAssetVersionContent: () => true,
		verifyVfxFrameContent: async () => true,
		assetRecordStore: {
			list: () => [
				{
					id: "effect",
					assetCategory: "visual_effect_projectile_shadow_mark",
					availability: "available",
				},
			],
		},
		specializedProfileContractStore: {
			getActive: () => ({
				contract: specializedProfileContractCatalog.find(
					(contract) =>
						contract.profileId === "visual_effect_projectile_shadow_mark"
				),
				contractRevisionId: "effect@1",
			}),
		},
	};
	return { context, records, versions };
}

async function invoke(operation: string, request: unknown, context: unknown) {
	const routers = appRouter as unknown as Record<
		string,
		Record<string, unknown>
	>;
	if (!routers.vfxAppearanceReviews) {
		throw new Error("VFX appearance review API is unavailable");
	}
	return await call(
		routers.vfxAppearanceReviews[operation] as never,
		request as never,
		{ context: context as never }
	);
}

test("persists VFX playback on four backgrounds with exact effect and scene versions", async () => {
	const { context, records } = setup();
	const saved = await invoke("save", input, context);
	expect(saved).toMatchObject({
		...input,
		reviewedByUserId: "owner",
		measuredOverflowPx: 4,
	});
	expect(
		await invoke(
			"list",
			{ projectId: "project", assetFamilyId: "family" },
			context
		)
	).toEqual([saved]);
	expect(await invoke("save", input, context)).toEqual(saved);
	expect(records).toHaveLength(1);
});

test("rejects absent sessions, foreign families, inactive or stale profiles and broken image/alpha data", async () => {
	const { context, records } = setup();
	await expect(
		invoke("save", input, { ...context, session: null })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		invoke("save", { ...input, assetFamilyId: "foreign" }, context)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		invoke("save", input, {
			...context,
			specializedProfileContractStore: { getActive: () => null },
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke("save", { ...input, contractRevisionId: "old" }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		invoke("save", input, {
			...context,
			verifyAssetVersionContent: () => false,
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke("save", input, { ...context, verifyVfxFrameContent: () => false })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toHaveLength(0);
});

test("rejects missing backgrounds, invalid timing, out-of-source crops and unpermitted overflow", async () => {
	const { context, records } = setup();
	const invalid = [
		{ ...input, backgrounds: ["light", "dark", "transparent"] },
		{ ...input, frames: [{ ...input.frames[0], durationMs: 0 }] },
		{
			...input,
			frames: [
				{ ...input.frames[0], region: { x: 10, y: 0, width: 24, height: 16 } },
			],
		},
		{ ...input, overflowAllowed: false },
		{ ...input, qualityWaiverEvidenceId: "unrelated" },
		{ ...input, rationale: " " },
	];
	await Promise.all(
		invalid.map((request) =>
			expect(invoke("save", request, context)).rejects.toMatchObject({
				code: "BAD_REQUEST",
			})
		)
	);
	expect(records).toHaveLength(0);
	expect(
		await invoke(
			"save",
			{ ...input, overflowAllowed: false, outcome: "failed" },
			context
		)
	).toMatchObject({ outcome: "failed", measuredOverflowPx: 4 });
});

test("rejects altered retries and refuses to report success if saved evidence cannot be reread", async () => {
	const { context } = setup();
	await invoke("save", input, context);
	await expect(
		invoke("save", { ...input, opacity: 0.5 }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	const other = setup();
	await expect(
		invoke("save", input, {
			...other.context,
			vfxAppearanceReviewStore: {
				...other.context.vfxAppearanceReviewStore,
				append: (_user: string, record: unknown) => record,
			},
		})
	).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});

test("pins only a current measured cell-overflow waiver for the exact frame Unit Version", async () => {
	const { context } = setup();
	const evidence = {
		projectId: "project",
		assetFamilyId: "family",
		id: "waiver",
		revisionId: "required-set",
		itemId: "burst",
		kind: "quality",
		result: "waived",
		assetVersionIds: ["version-one"],
		profileContractRevisionIds: ["effect@1"],
		contextRevisionId: "context",
		visualWorldId: "world",
		useContext: "spell",
		canonicalDesignVersionId: null,
		ruleId: "effect.cell_overflow",
		ruleClass: "waivable_requirement",
		testId: null,
		usageTestContext: null,
		usageVariant: null,
		targetDimensions: null,
		grayscaleReviewed: null,
		observedValue: "4 px",
		versionTarget: { kind: "unit", id: "burst-unit" },
		method: "Native frame-area bounds",
		rationale: "The burst intentionally extends four pixels.",
		createdAt: "2026-10-11T09:00:00.000Z",
		createdByUserId: "owner",
		isCurrent: true,
	};
	const waiverContext = {
		...context,
		assetVersionStore: {
			list: () => ({
				...context.assetVersionStore.list(),
				unitVersions: [
					{
						id: "burst-unit",
						assetVersionId: "version-one",
						unitKey: "burst-0",
					},
				],
			}),
		},
		familyReadinessStore: {
			list: () => ({ items: [{ latestEvidence: [evidence] }] }),
		},
	};
	const request = {
		...input,
		overflowAllowed: false,
		qualityWaiverEvidenceId: "waiver",
	};
	expect(await invoke("save", request, waiverContext)).toMatchObject({
		qualityWaiverSnapshot: evidence,
	});
	await Promise.all(
		[
			{ isCurrent: false },
			{ observedValue: "8 px" },
			{ ruleId: "effect.frame_and_alpha_integrity" },
			{ versionTarget: { kind: "unit", id: "other-unit" } },
		].map(async (patch) => {
			await expect(
				invoke(
					"save",
					{ ...request, id: crypto.randomUUID() },
					{
						...waiverContext,
						familyReadinessStore: {
							list: () => ({
								items: [{ latestEvidence: [{ ...evidence, ...patch }] }],
							}),
						},
					}
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		})
	);
	await expect(
		invoke(
			"save",
			{ ...request, id: crypto.randomUUID() },
			{ ...waiverContext, verifyVfxFrameContent: () => false }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("rejects an unreadable actual scene even when effect frames decode", async () => {
	const { context, records } = setup();
	await expect(
		invoke("save", input, {
			...context,
			verifyVfxFrameContent: async (
				_userId: string,
				_projectId: string,
				frame: { assetVersionId: string }
			) => frame.assetVersionId !== "scene",
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toHaveLength(0);
});
