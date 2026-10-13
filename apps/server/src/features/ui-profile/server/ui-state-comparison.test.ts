import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";

const input = {
	id: "8a3bf45a-0039-4761-b996-b0d45f732877",
	projectId: "project",
	assetFamilyId: "family",
	contractRevisionId: "ui@1",
	screenAssetVersionId: "screen",
	name: "Inventory controls",
	outcome: "needs_follow_up",
	familyStyleNotes: "Disabled button has a different outline.",
	stateDistinctionNotes: "Normal and pressed remain distinguishable.",
	items: [
		"normal",
		"hover",
		"pressed",
		"disabled",
		"selected",
		"open",
		"closed",
	].map((state, index) => ({
		componentId: "inventory-button",
		componentKind: "button",
		state,
		assetVersionId: "button",
		unitVersionId: null,
		region: { x: index * 8, y: 0, width: 8, height: 8 },
	})),
};
function setup() {
	const records: unknown[] = [];
	const versions = ["screen", "button"].map((id) => ({
		id,
		projectId: "project",
		assetFamilyId: "family",
		assetRecordId: id,
		integrityVerified: true,
		contentDigest: "a".repeat(64),
		contentLength: 100,
		contentType: "image/png",
		versionNumber: 1,
		sourceImageDimensions: { width: 64, height: 64 },
	}));
	const context = {
		session: { user: { id: "owner" } },
		uiStateComparisonStore: {
			list: (userId: string, projectId: string, familyId: string) =>
				userId === "owner" && projectId === "project" && familyId === "family"
					? structuredClone(records)
					: null,
			append: (_userId: string, record: unknown) => {
				records.push(structuredClone(record));
				return record;
			},
			listAccessibleVersionIds: () =>
				new Set(versions.map((version) => version.id)),
		},
		assetRecordStore: {
			list: () =>
				versions.map((version) => ({
					id: version.assetRecordId,
					name: version.id,
					assetCategory: "ui",
					availability: "active",
				})),
		},
		assetVersionStore: {
			list: () => ({ assetVersions: versions, unitVersions: [] }),
		},
		verifyAssetVersionContent: () => true,
		specializedProfileContractStore: {
			getActive: () => ({
				contractRevisionId: "ui@1",
				contract: getSpecializedProfileContract("ui"),
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
	if (!routers.uiStateComparisons) {
		throw new Error("UI state comparison API is unavailable");
	}
	return await call(
		routers.uiStateComparisons[operation] as never,
		request as never,
		{ context: context as never }
	);
}
test("saves and rereads a UI screen with all seven component states and exact profile pins", async () => {
	const { context, records } = setup();
	const saved = await invoke("save", input, context);
	expect(saved).toMatchObject({
		...input,
		reviewedByUserId: "owner",
		contractSnapshot: { profileId: "ui" },
		versionPins: [{ assetVersionId: "screen" }, { assetVersionId: "button" }],
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

test("rejects missing sessions, foreign families, inactive and stale profiles and unreadable images", async () => {
	const { context, records, versions } = setup();
	await expect(
		invoke("save", input, { ...context, session: null })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		invoke("save", input, { ...context, session: { user: { id: "outsider" } } })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
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
	const [, componentVersion] = versions;
	if (!componentVersion) {
		throw new Error("Missing component fixture");
	}
	componentVersion.assetFamilyId = "other-world-family";
	await expect(invoke("save", input, context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect(records).toHaveLength(0);
});
test("rejects duplicate state identities, conflicting component kinds, missing states and invalid crops", async () => {
	const { context, records } = setup();
	for (const request of [
		{ ...input, items: [input.items[0], input.items[0]] },
		{ ...input, items: [] },
		{
			...input,
			items: [input.items[0], { ...input.items[1], componentKind: "panel" }],
		},
		{
			...input,
			items: [input.items[0], { ...input.items[1], state: "unknown" }],
		},
		{
			...input,
			items: [
				input.items[0],
				{ ...input.items[1], region: { x: 60, y: 0, width: 8, height: 8 } },
			],
		},
		{
			...input,
			items: [input.items[0], { ...input.items[1], unitVersionId: "foreign" }],
		},
		{ ...input, familyStyleNotes: " " },
	]) {
		// biome-ignore lint/performance/noAwaitInLoops: Exercise each rejected API request independently.
		await expect(invoke("save", request, context)).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	}
	expect(records).toHaveLength(0);
});
test("altered retries conflict and failed persistence never reports a successful comparison", async () => {
	const { context } = setup();
	await invoke("save", input, context);
	await expect(
		invoke("save", { ...input, name: "Altered" }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	const other = setup();
	await expect(
		invoke("save", input, {
			...other.context,
			uiStateComparisonStore: {
				...other.context.uiStateComparisonStore,
				append: () => null,
			},
		})
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		invoke("save", input, {
			...other.context,
			uiStateComparisonStore: {
				...other.context.uiStateComparisonStore,
				append: (_user: string, record: unknown) => record,
			},
		})
	).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});
