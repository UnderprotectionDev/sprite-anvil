import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";

const scenarios = [
	"inner_corner",
	"outer_corner",
	"edge",
	"narrow_corridor",
	"terrain_fill",
	"sharp_transition",
	"random",
];
const input = {
	id: "64869356-a595-4a3a-995f-87dad6c77d04",
	projectId: "project",
	assetFamilyId: "family",
	compositeVersionId: "composition",
	contractRevisionId: "tiles@1",
	tiles: [
		{
			unitVersionId: "unit",
			terrainId: "grass",
			region: { x: 0, y: 0, width: 16, height: 16 },
			edges: { north: "grass", east: "grass", south: "grass", west: "water" },
		},
	],
	maps: scenarios.map((scenario) => ({
		scenario,
		width: 2,
		height: 2,
		cells: ["unit", "unit", "unit", "unit"],
		outcome: "failed",
		notes: "Visible seam at the grass border",
		issues: [{ cellIndex: 0, neighborIndex: 1, notes: "Wrong west connector" }],
	})),
};
function setup() {
	const records: unknown[] = [];
	const context = {
		session: { user: { id: "owner" } },
		tilesetAdjacencyReviewStore: {
			list: (userId: string, projectId: string) =>
				userId === "owner" && projectId === "project" ? records : null,
			append: (_userId: string, record: unknown) => {
				records.push(structuredClone(record));
				return record;
			},
			listAccessibleVersionIds: () => new Set(["version"]),
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
						assetRecordId: "record",
						assetFamilyId: "family",
						integrityVerified: true,
						contentDigest: "a".repeat(64),
						sourceImageDimensions: { width: 32, height: 16 },
					},
				],
				unitVersions: [
					{
						id: "unit",
						assetRecordId: "record",
						assetVersionId: "version",
						unitType: "tile",
						unitKey: "grass-edge",
					},
				],
				compositeVersions: [
					{
						id: "composition",
						assetRecordId: "record",
						compositionMemberships: [
							{
								unitVersionId: "unit",
								unitKey: "grass-edge",
								unitType: "tile",
							},
						],
					},
				],
			}),
		},
		verifyAssetVersionContent: () => true,
		specializedProfileContractStore: {
			getActive: () => ({
				contract: specializedProfileContractCatalog.find(
					(item) => item.profileId === "tileset_terrain_texture"
				),
				contractRevisionId: "tiles@1",
			}),
		},
	};
	return { context, records };
}
async function invoke(
	operation: string,
	request: unknown,
	context: unknown
): Promise<unknown> {
	const routers = appRouter as unknown as Record<string, Record<string, never>>;
	if (!routers.tilesetAdjacencyReviews) {
		throw new Error("Tileset adjacency review API is unavailable");
	}
	return await call(
		routers.tilesetAdjacencyReviews[operation] as never,
		request as never,
		{ context: context as never }
	);
}
test("saves all difficult adjacency maps with exact tile pins and rereads immutable evidence", async () => {
	const { context, records } = setup();
	const saved = (await invoke("save", input, context)) as {
		adjacencyIssues: unknown[];
	};
	expect(saved).toMatchObject({
		...input,
		versionPins: [
			{
				unitVersionId: "unit",
				tileId: "grass-edge",
				assetVersionId: "version",
				contentDigest: "a".repeat(64),
			},
		],
	});
	expect(saved.adjacencyIssues[0]).toMatchObject({
		scenario: "inner_corner",
		cellIndex: 0,
		neighborIndex: 1,
		unitVersionId: "unit",
		neighborUnitVersionId: "unit",
		edge: "east",
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

test("rejects unauthorized, inactive profiles, stale contracts and broken or foreign tile versions", async () => {
	const { context, records } = setup();
	await expect(
		invoke("save", input, { ...context, session: null })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		invoke("list", { projectId: "other", assetFamilyId: "family" }, context)
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
		invoke("save", { ...input, compositeVersionId: "foreign" }, context)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke(
			"save",
			{
				...input,
				tiles: [
					{ ...input.tiles[0], region: { x: 20, y: 0, width: 16, height: 16 } },
				],
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toHaveLength(0);
	await invoke("save", input, context);
	await expect(
		invoke(
			"save",
			{
				...input,
				maps: input.maps.map((map) => ({ ...map, notes: "Changed judgment" })),
			},
			context
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(records).toHaveLength(1);
});
test("rejects incomplete maps, unrelated issue targets and passed maps with declared connector failures", async () => {
	const { context, records } = setup();
	await expect(
		invoke("save", { ...input, maps: input.maps.slice(1) }, context)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke(
			"save",
			{
				...input,
				maps: input.maps.map((map) => ({
					...map,
					cells: ["missing", "unit", "unit", "unit"],
				})),
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke(
			"save",
			{
				...input,
				maps: input.maps.map((map) => ({
					...map,
					issues: [
						{ cellIndex: 0, neighborIndex: 3, notes: "Not a neighboring tile" },
					],
				})),
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke(
			"save",
			{
				...input,
				maps: input.maps.map((map) => ({
					...map,
					outcome: "passed",
					issues: [],
				})),
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke("save", input, {
			...context,
			tilesetAdjacencyReviewStore: {
				...context.tilesetAdjacencyReviewStore,
				append: () => null,
			},
		})
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(records).toHaveLength(0);
});
test("allows a user-declared pass with known matching connectors and keeps unknown connectors inconclusive", async () => {
	const { context } = setup();
	const matching = {
		...input,
		tiles: [
			{
				...input.tiles[0],
				edges: { north: "grass", east: "grass", south: "grass", west: "grass" },
			},
		],
		maps: input.maps.map((map) => ({ ...map, outcome: "passed", issues: [] })),
	};
	expect(await invoke("save", matching, context)).toMatchObject({
		adjacencyIssues: [],
		maps: expect.arrayContaining([
			expect.objectContaining({ outcome: "passed" }),
		]),
	});
	const unknown = {
		...matching,
		id: crypto.randomUUID(),
		tiles: [
			{
				...matching.tiles[0],
				edges: { ...matching.tiles[0]?.edges, west: null },
			},
		],
		maps: matching.maps.map((map) => ({ ...map, outcome: "inconclusive" })),
	};
	expect(await invoke("save", unknown, context)).toMatchObject({
		adjacencyIssues: expect.arrayContaining([
			expect.objectContaining({ result: "unknown" }),
		]),
	});
});

test("rejects passed maps without painted adjacency and incomplete single-terrain fills", async () => {
	const { context, records } = setup();
	await Promise.all(
		[
			["unit", null, null, null],
			["unit", "unit", null, null],
		].map((cells) =>
			expect(
				invoke(
					"save",
					{
						...input,
						tiles: input.tiles.map((tile) => ({
							...tile,
							edges: {
								north: "grass",
								east: "grass",
								south: "grass",
								west: "grass",
							},
						})),
						maps: input.maps.map((map) => ({
							...map,
							cells: map.scenario === "terrain_fill" ? cells : map.cells,
							outcome: "passed",
							issues: [],
						})),
					},
					context
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" })
		)
	);
	expect(records).toHaveLength(0);
});
