import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import type { TextureEdgeCheck } from "@sprite-anvil/api/texture-repetition-reviews";

const input = {
	id: "8a3bf45a-0039-4761-b996-b0d45f732877",
	projectId: "project",
	assetFamilyId: "family",
	contractRevisionId: "texture@1",
	unitVersionId: "unit",
	atlasRegion: { x: 1, y: 0, width: 3, height: 2 },
	terrainId: "grass",
	repeatAxes: ["x", "y"],
	shiftedOffset: { x: 1, y: 1 },
	observations: ["2x2", "3x3", "shifted"].map((arrangement) => ({
		arrangement,
		outcome: "needs_follow_up",
		notes: "Bright motif repeats visibly.",
	})),
};

function setup() {
	const records: unknown[] = [];
	const contract = specializedProfileContractCatalog.find(
		(item) => item.profileId === "tileset_terrain_texture"
	);
	const context = {
		session: { user: { id: "owner" } },
		textureRepetitionReviewStore: {
			list: (userId: string) =>
				userId === "owner" ? structuredClone(records) : null,
			append: (_userId: string, record: unknown) => {
				records.push(structuredClone(record));
				return record;
			},
		},
		assetRecordStore: {
			list: () => [
				{
					id: "record",
					assetCategory: "tileset_terrain_texture",
					availability: "active",
				},
			],
		},
		assetVersionStore: {
			list: () => ({
				assetVersions: [
					{
						id: "version",
						projectId: "project",
						assetRecordId: "record",
						assetFamilyId: "family",
						integrityVerified: true,
						contentDigest: "a".repeat(64),
						sourceImageDimensions: { width: 5, height: 2 },
					},
				],
				unitVersions: [
					{
						id: "unit",
						projectId: "project",
						assetRecordId: "record",
						assetVersionId: "version",
						unitType: "tile",
						unitKey: "grass",
						versionNumber: 1,
						sourceAssetVersionId: "source",
						createdAt: "2026-10-11T00:00:00.000Z",
					},
				],
			}),
		},
		specializedProfileContractStore: {
			getActive: () => ({ contractRevisionId: "texture@1", contract }),
		},
		checkTextureEdges: async (): Promise<TextureEdgeCheck> => ({
			x: { mismatchCount: 0, firstMismatch: null },
			y: { mismatchCount: 0, firstMismatch: null },
		}),
	};
	return { context, records };
}
async function invoke(operation: string, request: unknown, context: unknown) {
	const routers = appRouter as unknown as Record<
		string,
		Record<string, unknown>
	>;
	if (!routers.textureRepetitionReviews) {
		throw new Error("Texture repetition API is unavailable");
	}
	return await call(
		routers.textureRepetitionReviews[operation] as never,
		request as never,
		{ context: context as never }
	);
}
test("records all repeat arrangements against an exact unit and rereads unchanged metadata", async () => {
	const { context } = setup();
	const saved = await invoke("save", input, context);
	expect(saved).toMatchObject({
		...input,
		unitSnapshot: { id: "unit", unitKey: "grass" },
		contentDigest: "a".repeat(64),
		edgeCheck: { x: { mismatchCount: 0 }, y: { mismatchCount: 0 } },
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

test("reports exact cropped RGBA edge mismatches separately from human repetition findings", async () => {
	const { context } = setup();
	context.checkTextureEdges = async () => ({
		x: { mismatchCount: 1, firstMismatch: 1 },
		y: { mismatchCount: 2, firstMismatch: 0 },
	});
	const saved = await invoke("save", input, context);
	expect(saved).toMatchObject({
		edgeCheck: {
			x: { mismatchCount: 1, firstMismatch: 1 },
			y: { mismatchCount: 2, firstMismatch: 0 },
		},
		observations: input.observations,
	});
});
for (const [name, patch] of [
	["missing arrangement", { observations: input.observations.slice(0, 2) }],
	[
		"duplicate arrangement",
		{ observations: new Array(3).fill(input.observations[0]) },
	],
	["out-of-bounds region", { atlasRegion: { ...input.atlasRegion, x: 4 } }],
	["unknown unit", { unitVersionId: "other" }],
	["stale contract", { contractRevisionId: "old" }],
	["duplicate repeat axis", { repeatAxes: ["x", "x"] }],
	["invalid shift", { shiftedOffset: { x: 3, y: 0 } }],
] as const) {
	test(`rejects ${name} without saving`, async () => {
		const { context, records } = setup();
		await expect(
			invoke("save", { ...input, ...patch }, context)
		).rejects.toBeDefined();
		expect(records).toEqual([]);
	});
}
test("denies anonymous and foreign project access", async () => {
	const { context } = setup();
	await expect(
		invoke("save", input, { ...context, session: null })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		invoke("save", input, { ...context, session: { user: { id: "outsider" } } })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});
test("rejects changed operation input and failed bytes, and reports a lost readback", async () => {
	const { context } = setup();
	await invoke("save", input, context);
	await expect(
		invoke("save", { ...input, terrainId: "sand" }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	const fresh = setup();
	await expect(
		invoke("save", input, { ...fresh.context, checkTextureEdges: () => null })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	fresh.context.textureRepetitionReviewStore.append = (_userId, record) =>
		record;
	await expect(invoke("save", input, fresh.context)).rejects.toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
	});
});

test("exports declared atlas, terrain and repeat fields and rejects tampered readback", async () => {
	const {
		createTextureRepetitionPackage,
		textureRepetitionPackageSchema,
		textureRepetitionReviewRecordSchema,
	} = await import("@sprite-anvil/api/texture-repetition-reviews");
	const { context } = setup();
	const saved = textureRepetitionReviewRecordSchema.parse(
		await invoke("save", input, context)
	);
	const metadata = createTextureRepetitionPackage(saved);
	expect(metadata).toMatchObject({
		tileset: {
			tiles: [
				{
					id: "grass",
					atlas_region: { x: 1, y: 0, width: 3, height: 2 },
					unit_version_id: "unit",
				},
			],
			terrain_id: "grass",
		},
		texture: { repeat_axes: ["x", "y"] },
	});
	expect(
		textureRepetitionPackageSchema.safeParse({
			...metadata,
			texture: { repeat_axes: ["x"] },
		}).success
	).toBe(false);
	expect(() =>
		createTextureRepetitionPackage({
			...saved,
			edgeCheck: {
				x: { mismatchCount: 1, firstMismatch: 0 },
				y: saved.edgeCheck.y,
			},
		})
	).toThrow("Exact edge mismatch");
});

test("rejects a texture from another family, an erased record and an inactive profile", async () => {
	const foreign = setup();
	const catalog = foreign.context.assetVersionStore.list();
	const [firstVersion] = catalog.assetVersions;
	if (!firstVersion) {
		throw new Error("Missing version fixture");
	}
	firstVersion.assetFamilyId = "another-family";
	foreign.context.assetVersionStore.list = () => catalog;
	await expect(invoke("save", input, foreign.context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	const erased = setup();
	erased.context.assetRecordStore.list = () => [
		{
			id: "record",
			assetCategory: "tileset_terrain_texture",
			availability: "erased",
		},
	];
	await expect(invoke("save", input, erased.context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	const inactive = setup();
	await expect(
		invoke("save", input, {
			...inactive.context,
			specializedProfileContractStore: { getActive: () => null },
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("reviews an intact derived Unit Version whose older upload path did not store dimensions", async () => {
	const { context } = setup();
	const catalog = context.assetVersionStore.list();
	const contextWithLegacyDimensions = {
		...context,
		assetVersionStore: {
			list: () => ({
				...catalog,
				assetVersions: catalog.assetVersions.map((version) => ({
					...version,
					sourceImageDimensions: null,
				})),
			}),
		},
	};
	expect(
		await invoke("save", input, contextWithLegacyDimensions)
	).toMatchObject({ unitVersionId: "unit" });
});
