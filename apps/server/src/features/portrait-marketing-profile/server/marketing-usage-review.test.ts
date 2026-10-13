import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";

const input = {
	id: "8a3bf45a-0039-4761-b996-b0d45f732877",
	projectId: "project",
	assetFamilyId: "family",
	contractRevisionId: "portrait_logo_marketing@1.0.0",
	visualWorldId: "world",
	canonicalDesignId: "design",
	items: [
		{
			assetRecordId: "record",
			assetVersionId: "version",
			usePurpose: "logo",
			naturalSize: { width: 301, height: 199 },
			crop: { x: 0, y: 0, width: 301, height: 199 },
			safeArea: { x: 20, y: 20, width: 260, height: 150 },
			displaySize: { width: 77, height: 51 },
			presentation: "transparent",
			opaqueColor: null,
			observations: ["light", "dark"].map((background) => ({
				background,
				readability: "passed",
				safeArea: "failed",
				crop: "passed",
				notes: "Small lettering clips the safe area.",
			})),
		},
	],
};
function setup() {
	const records: unknown[] = [];
	const context = {
		session: { user: { id: "owner" } },
		marketingUsageReviewStore: {
			list: (userId: string) =>
				userId === "owner" ? structuredClone(records) : null,
			listAccessibleVersionIds: () => new Set(["version"]),
			append: (_user: string, record: unknown) => {
				records.push(structuredClone(record));
				return record;
			},
		},
		assetFamilyStore: {
			list: () => ({
				assetFamilies: [
					{ id: "family", visualWorldId: "world", canonicalDesignId: "design" },
				],
				assetRecords: [{ id: "record", assetFamilyId: "family" }],
			}),
		},
		assetRecordStore: {
			list: () => [
				{
					id: "record",
					name: "Anvil logo",
					assetCategory: "portrait_logo_marketing",
					availability: "active",
				},
			],
		},
		assetVersionStore: {
			list: () => ({
				canonicalDesigns: [
					{ id: "design", assetFamilyId: "family", assetVersionId: "version" },
				],
				assetVersions: [
					{
						id: "version",
						projectId: "project",
						assetRecordId: "record",
						assetFamilyId: "family",
						integrityVerified: true,
						contentDigest: "a".repeat(64),
						contentLength: 120,
						contentType: "image/png",
						versionNumber: 1,
						sourceImageDimensions: { width: 301, height: 199 },
					},
				],
			}),
		},
		specializedProfileContractStore: {
			getActive: () => ({
				contractRevisionId: input.contractRevisionId,
				contract: getSpecializedProfileContract("portrait_logo_marketing"),
			}),
		},
		verifyAssetVersionContent: () => true,
	};
	return { context, records };
}
async function invoke(operation: string, request: unknown, context: unknown) {
	const routers = appRouter as unknown as Record<
		string,
		Record<string, unknown>
	>;
	if (!routers.marketingUsageReviews) {
		throw new Error("Marketing usage API is unavailable");
	}
	return await call(
		routers.marketingUsageReviews[operation] as never,
		request as never,
		{ context: context as never }
	);
}
test("saves logo safe-area failures and noninteger small-use scaling, rereads exact purpose and pins", async () => {
	const { context } = setup();
	const saved = await invoke("save", input, context);
	expect(saved).toMatchObject({
		...input,
		versionPins: [{ assetVersionId: "version", contentDigest: "a".repeat(64) }],
	});
	expect(
		await invoke(
			"list",
			{ projectId: "project", assetFamilyId: "family" },
			context
		)
	).toEqual([saved]);
	expect(await invoke("save", input, context)).toEqual(saved);
});

for (const [name, patch] of [
	[
		"portrait evidence",
		{ items: [{ ...input.items[0], usePurpose: "portrait" }] },
	],
	[
		"missing dark background",
		{
			items: [
				{
					...input.items[0],
					observations: input.items[0]?.observations.slice(0, 1),
				},
			],
		},
	],
	[
		"unsafe geometry",
		{
			items: [
				{
					...input.items[0],
					safeArea: { x: 300, y: 0, width: 20, height: 20 },
				},
			],
		},
	],
	[
		"fabricated dimensions",
		{
			items: [{ ...input.items[0], naturalSize: { width: 302, height: 199 } }],
		},
	],
	[
		"missing opaque color",
		{ items: [{ ...input.items[0], presentation: "opaque" }] },
	],
	["foreign world", { visualWorldId: "other" }],
	["foreign design", { canonicalDesignId: "other" }],
	["stale contract", { contractRevisionId: "old" }],
] as const) {
	test(`rejects ${name} before persistence`, async () => {
		const { context, records } = setup();
		await expect(
			invoke("save", { ...input, ...patch }, context)
		).rejects.toBeDefined();
		expect(records).toEqual([]);
	});
}
test("denies anonymous, expired and foreign project access", async () => {
	const { context } = setup();
	await expect(
		invoke("save", input, { ...context, session: null })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		invoke(
			"list",
			{ projectId: "project", assetFamilyId: "family" },
			{ ...context, session: null }
		)
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		invoke("save", input, { ...context, session: { user: { id: "outsider" } } })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});
test("rejects erased versions, failed bytes, inactive contracts, reused ids and lost readback", async () => {
	const { context } = setup();
	await Promise.all(
		[
			{ verifyAssetVersionContent: () => false },
			{ specializedProfileContractStore: { getActive: () => null } },
			{
				assetRecordStore: {
					list: () => [
						{
							id: "record",
							name: "Anvil logo",
							assetCategory: "portrait_logo_marketing",
							availability: "erased",
						},
					],
				},
			},
			{
				assetVersionStore: {
					list: () => ({
						canonicalDesigns: [
							{
								id: "design",
								assetFamilyId: "family",
								assetVersionId: "version",
							},
						],
						assetVersions: [],
					}),
				},
			},
		].map((patch) =>
			expect(
				invoke("save", input, { ...context, ...patch })
			).rejects.toMatchObject({ code: "BAD_REQUEST" })
		)
	);
	await invoke("save", input, context);
	await expect(
		invoke(
			"save",
			{ ...input, items: [{ ...input.items[0], usePurpose: "opening" }] },
			context
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
	const fresh = setup();
	fresh.context.marketingUsageReviewStore.append = (_user, record) => record;
	await expect(invoke("save", input, fresh.context)).rejects.toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
	});
});
test("packages purpose, geometry, backgrounds and exact design without mixing portrait evidence", async () => {
	const {
		createMarketingUsageReviewPackage,
		marketingUsageReviewRecordSchema,
		marketingUsageReviewPackageSchema,
	} = await import("@sprite-anvil/api/marketing-usage-reviews");
	const { context } = setup();
	const saved = marketingUsageReviewRecordSchema.parse(
		await invoke(
			"save",
			{
				...input,
				items: [
					{
						...input.items[0],
						usePurpose: "store",
						presentation: "opaque",
						opaqueColor: "#ffcc00",
					},
				],
			},
			context
		)
	);
	const bundle = createMarketingUsageReviewPackage(saved);
	expect(JSON.parse(JSON.stringify(bundle)).record).toEqual(saved);
	expect(bundle.record.items[0]).toMatchObject({
		usePurpose: "store",
		presentation: "opaque",
		opaqueColor: "#ffcc00",
		displaySize: { width: 77, height: 51 },
	});
	expect(
		marketingUsageReviewPackageSchema.safeParse({
			...bundle,
			record: {
				...saved,
				items: [{ ...saved.items[0], usePurpose: "portrait" }],
			},
		}).success
	).toBe(false);
});
