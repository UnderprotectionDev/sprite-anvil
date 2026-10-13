import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";

const observation = {
	outcome: "passed",
	notes: "Face and expression remain visible.",
};
const input = {
	id: crypto.randomUUID(),
	projectId: "project",
	assetFamilyId: "portrait-family",
	visualWorldId: "illustration",
	subjectIdentityId: "hero",
	canonicalDesignId: "portrait-design",
	contractRevisionId: "portrait@1",
	rationale: "Compared dialogue expressions at the requested size.",
	observations: {
		identity: observation,
		expression: observation,
		crop: observation,
	},
	items: ["neutral", "happy"].map((expression, i) => ({
		assetRecordId: i === 0 ? "portrait" : "happy",
		assetVersionId: i === 0 ? "portrait-version" : "happy-version",
		expression,
		usagePurpose: "dialogue",
		naturalSize: { width: 600, height: 800 },
		crop: { x: 50, y: 80, width: 400, height: 500 },
		targetSize: { width: 137, height: 181 },
		background: "light",
	})),
};
function setup() {
	const records: unknown[] = [];
	const versions = ["portrait", "happy"].map((id) => ({
		id: `${id}-version`,
		assetRecordId: id,
		assetFamilyId: "portrait-family",
		integrityVerified: true,
		contentDigest: "a".repeat(64),
		contentLength: 80,
		contentType: "image/png",
		versionNumber: 1,
		sourceImageDimensions: { width: 600, height: 800 },
		reviewDisposition: "approved",
	}));
	const catalog = {
		assetVersions: versions,
		canonicalDesigns: [
			{
				id: "portrait-design",
				assetFamilyId: "portrait-family",
				assetRecordId: "portrait",
				assetVersionId: "portrait-version",
			},
		],
		unitVersions: [],
		compositeVersions: [],
	};
	const familyCatalog = {
		assetFamilies: [
			{
				id: "portrait-family",
				visualWorldId: "illustration",
				subjectIdentityId: "hero",
				name: "Hero portraits",
				useContext: "Dialogue",
			},
			{ id: "gameplay", visualWorldId: "pixels", subjectIdentityId: "hero" },
		],
		assetRecords: ["portrait", "happy"].map((id) => ({
			id,
			assetFamilyId: "portrait-family",
		})),
		relationships: [
			{
				type: "derivative",
				sourceAssetRecordId: "portrait",
				sourceAssetVersionId: "portrait-version",
				targetAssetRecordId: "happy",
				assetFamilyId: "portrait-family",
			},
		],
	};
	const context = {
		session: { user: { id: "owner" } },
		portraitIdentityReviewStore: {
			list: (userId: string, projectId: string) =>
				Promise.resolve(
					userId === "owner" && projectId === "project"
						? structuredClone(records)
						: null
				),
			append: (_userId: string, record: unknown) => {
				records.push(structuredClone(record));
				return Promise.resolve(record);
			},
			listAccessibleVersionIds: () =>
				Promise.resolve(new Set(versions.map((v) => v.id))),
		},
		assetFamilyStore: { list: () => Promise.resolve(familyCatalog) },
		assetRecordStore: {
			list: () =>
				Promise.resolve(
					["portrait", "happy"].map((id) => ({
						id,
						name: id,
						assetCategory: "portrait_logo_marketing",
						availability: "active",
					}))
				),
		},
		assetVersionStore: { list: () => Promise.resolve(catalog) },
		verifyAssetVersionContent: () => Promise.resolve(true),
		specializedProfileContractStore: {
			getActive: () =>
				Promise.resolve({
					contractRevisionId: "portrait@1",
					contract: specializedProfileContractCatalog.find(
						(c) => c.profileId === "portrait_logo_marketing"
					),
				}),
		},
	};
	return { context, records, catalog, familyCatalog };
}
async function invoke(
	operation: string,
	request: unknown,
	context: unknown
): Promise<unknown> {
	const routers = appRouter as unknown as Record<string, Record<string, never>>;
	if (!routers.portraitIdentityReviews) {
		throw new Error("Portrait Identity Review API is unavailable");
	}
	return await call(
		routers.portraitIdentityReviews[operation] as never,
		request as never,
		{ context: context as Context }
	);
}
test("preserves shared Subject Identity and separate portrait lineage, expressions and noninteger usage scale on reread", async () => {
	const { context, records } = setup();
	const saved = await invoke("save", input, context);
	expect(saved).toMatchObject({
		...input,
		outcome: "passed",
		versionPins: [
			{ assetVersionId: "portrait-version" },
			{ assetVersionId: "happy-version" },
		],
	});
	expect(
		await invoke(
			"list",
			{ projectId: "project", assetFamilyId: "portrait-family" },
			context
		)
	).toEqual([saved]);
	expect(await invoke("save", input, context)).toEqual(saved);
	expect(records).toHaveLength(1);
});

test("rejects missing or expired sessions, foreign projects, inactive and changed contracts without evidence", async () => {
	const { context, records } = setup();
	await expect(
		invoke("save", input, { ...context, session: null })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		invoke(
			"list",
			{ projectId: "foreign", assetFamilyId: "portrait-family" },
			context
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		invoke("save", input, { ...context, session: { user: { id: "outsider" } } })
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
	expect(records).toHaveLength(0);
});
test("rejects cross-world canonical links, missing expression lineage, broken content and invalid crop geometry", async () => {
	const { context, records, familyCatalog, catalog } = setup();
	const invalid = [
		{ ...input, visualWorldId: "pixels" },
		{ ...input, subjectIdentityId: "another-subject" },
		{ ...input, canonicalDesignId: "gameplay-design" },
		{
			...input,
			items: input.items.map((i) => ({
				...i,
				naturalSize: { width: 601, height: 800 },
			})),
		},
		{
			...input,
			items: input.items.map((i) => ({
				...i,
				crop: { x: 500, y: 0, width: 400, height: 500 },
			})),
		},
		{ ...input, items: input.items.slice(0, 1) },
		{
			...input,
			items: input.items.map((i) => ({ ...i, expression: "neutral" })),
		},
		{
			...input,
			items: input.items.map((i) => ({ ...i, assetRecordId: "foreign" })),
		},
		{
			...input,
			items: input.items.map((i) => ({
				...i,
				assetVersionId: "foreign-version",
			})),
		},
	];
	await Promise.all(
		invalid.map((request) =>
			expect(invoke("save", request, context)).rejects.toMatchObject({
				code: "BAD_REQUEST",
			})
		)
	);
	await expect(
		invoke("save", input, {
			...context,
			verifyAssetVersionContent: () => false,
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	familyCatalog.relationships = [];
	await expect(invoke("save", input, context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	const [canonicalVersion] = catalog.assetVersions;
	if (!canonicalVersion) {
		throw new Error("Missing canonical fixture");
	}
	canonicalVersion.reviewDisposition = "rejected";
	await expect(invoke("save", input, context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect(records).toHaveLength(0);
});
test("retains failed and inconclusive user judgments and rejects changed retries or lost writes", async () => {
	const { context, records } = setup();
	const failed = {
		...input,
		observations: {
			...input.observations,
			identity: {
				outcome: "failed",
				notes: "Expression changes the face identity.",
			},
		},
	};
	expect(await invoke("save", failed, context)).toMatchObject({
		outcome: "failed",
	});
	await expect(
		invoke("save", { ...failed, rationale: "Changed" }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	const incomplete = {
		...input,
		id: crypto.randomUUID(),
		observations: {
			...input.observations,
			crop: {
				outcome: "inconclusive",
				notes: "Dialogue context is not available.",
			},
		},
	};
	expect(await invoke("save", incomplete, context)).toMatchObject({
		outcome: "inconclusive",
	});
	expect(records).toHaveLength(2);
	await expect(
		invoke(
			"save",
			{ ...input, id: crypto.randomUUID() },
			{
				...context,
				portraitIdentityReviewStore: {
					...context.portraitIdentityReviewStore,
					append: () => null,
				},
			}
		)
	).rejects.toMatchObject({ code: "CONFLICT" });

	await expect(
		invoke(
			"save",
			{ ...input, id: crypto.randomUUID() },
			{
				...context,
				portraitIdentityReviewStore: {
					...context.portraitIdentityReviewStore,
					list: () => Promise.resolve([]),
				},
			}
		)
	).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});
