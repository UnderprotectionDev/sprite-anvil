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
		contractVersion: "tileset-adjacency-review/1.1.0",
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
		maps: input.maps.map((map) => ({
			...map,
			outcome: map.scenario === "terrain_fill" ? "passed" : "inconclusive",
			issues: [],
		})),
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

test("saves and rereads independent tiles without inventing a terrain identity", async () => {
	const { context } = setup();
	const independent = {
		...input,
		tiles: input.tiles.map((tile) => ({ ...tile, terrainId: null })),
		maps: input.maps.map((map) => ({ ...map, outcome: "inconclusive" })),
	};
	const saved = await invoke("save", independent, context);
	expect(saved).toMatchObject({ tiles: [{ terrainId: null }] });
	expect(
		await invoke(
			"list",
			{ projectId: "project", assetFamilyId: "family" },
			context
		)
	).toEqual([saved]);
});

test("requires a tile or connection target for failed scenarios", async () => {
	const { context, records } = setup();
	const untargeted = {
		...input,
		tiles: input.tiles.map((tile) => ({
			...tile,
			edges: { north: "join", east: "join", south: "join", west: "join" },
		})),
		maps: input.maps.map((map) => ({ ...map, issues: [] })),
	};
	await expect(invoke("save", untargeted, context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	await expect(
		invoke(
			"save",
			{
				...untargeted,
				tiles: untargeted.tiles.map((tile) => ({
					...tile,
					edges: { north: null, east: null, south: null, west: null },
				})),
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toHaveLength(0);
	const targeted = { ...untargeted, maps: input.maps };
	expect(await invoke("save", targeted, context)).toMatchObject({
		adjacencyIssues: [],
	});
	const automatic = {
		...input,
		id: crypto.randomUUID(),
		maps: untargeted.maps,
	};
	expect(await invoke("save", automatic, context)).toMatchObject({
		adjacencyIssues: expect.arrayContaining([
			expect.objectContaining({ result: "mismatch" }),
		]),
	});
});

test("does not accept a neighboring pair as corner, corridor, transition or random evidence", async () => {
	await Promise.all(
		[
			"inner_corner",
			"outer_corner",
			"narrow_corridor",
			"sharp_transition",
			"random",
		].map(async (scenario) => {
			const { context, records } = setup();
			await expect(
				invoke(
					"save",
					{
						...input,
						tiles: input.tiles.map((tile) => ({
							...tile,
							edges: {
								north: "join",
								east: "join",
								south: "join",
								west: "join",
							},
						})),
						maps: input.maps.map((map) => ({
							...map,
							outcome: map.scenario === scenario ? "passed" : "inconclusive",
							issues: [],
							cells:
								map.scenario === scenario
									? ["unit", "unit", null, null]
									: map.cells,
						})),
					},
					context
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(records).toHaveLength(0);
		})
	);
});

test("saves represented scenarios in different orientations without imposing one map template", async () => {
	const { context } = setup();
	const catalog = context.assetVersionStore.list();
	const [sourceUnit] = catalog.unitVersions;
	const [sourceTile] = input.tiles;
	if (!(sourceUnit && sourceTile)) {
		throw new Error("The fixture requires a source unit and tile.");
	}
	context.assetVersionStore.list = () => ({
		...catalog,
		unitVersions: [
			...catalog.unitVersions,
			{ ...sourceUnit, id: "water", unitKey: "water-tile" },
		],
		compositeVersions: catalog.compositeVersions.map((composite) => ({
			...composite,
			compositionMemberships: [
				...composite.compositionMemberships,
				{ unitVersionId: "water", unitType: "tile", unitKey: "water-tile" },
			],
		})),
	});
	const patterns: Record<string, string[]> = {
		inner_corner: ["AAA", "ABB", "ABB"],
		outer_corner: ["BBB", "BAB", "BBB"],
		edge: ["AAB", "AAB", "AAB"],
		narrow_corridor: ["BAB", "BAB", "BAB"],
		terrain_fill: ["AAA", "AAA", "AAA"],
		sharp_transition: ["AAA", "BBB", "BBB"],
		random: ["ABA", "BAA", "ABB"],
	};
	const represented = {
		...input,
		tiles: ["unit", "water"].map((unitVersionId) => ({
			...sourceTile,
			unitVersionId,
			terrainId: unitVersionId === "unit" ? "grass" : "water",
			edges: { north: "join", east: "join", south: "join", west: "join" },
		})),
		maps: input.maps.map((map) => {
			const rows = patterns[map.scenario];
			if (!rows) {
				throw new Error(`Missing scenario fixture: ${map.scenario}`);
			}
			return {
				...map,
				width: 3,
				height: 3,
				outcome: "passed",
				issues: [],
				cells: rows
					.join("")
					.split("")
					.map((cell) => (cell === "A" ? "unit" : "water")),
			};
		}),
	};
	const saved = await invoke("save", represented, context);
	expect(saved).toMatchObject({ maps: represented.maps, adjacencyIssues: [] });
	expect(
		await invoke(
			"list",
			{ projectId: "project", assetFamilyId: "family" },
			context
		)
	).toEqual([saved]);
	const rotated = {
		...represented,
		id: crypto.randomUUID(),
		maps: represented.maps.map((map) => ({
			...map,
			cells: [6, 3, 0, 7, 4, 1, 8, 5, 2].map((index) => map.cells[index]),
		})),
	};
	expect(await invoke("save", rotated, context)).toMatchObject({
		maps: rotated.maps,
		adjacencyIssues: [],
	});
});

test("rereads historical outcomes and retries the original operation without applying new evidence rules", async () => {
	const { context, records } = setup();
	const original = {
		...input,
		tiles: input.tiles.map((tile) => ({
			...tile,
			edges: { north: "grass", east: "grass", south: "grass", west: "grass" },
		})),
		maps: input.maps.map((map) => ({ ...map, outcome: "passed", issues: [] })),
	};
	const historical = {
		...original,
		contractVersion: "tileset-adjacency-review/1.0.0",
		versionPins: [
			{
				unitVersionId: "unit",
				tileId: "grass-edge",
				assetVersionId: "version",
				contentDigest: "a".repeat(64),
				sourceImageDimensions: { width: 32, height: 16 },
			},
		],
		adjacencyIssues: [],
		contractSnapshot: specializedProfileContractCatalog.find(
			(contract) => contract.profileId === "tileset_terrain_texture"
		),
		reviewedByUserId: "owner",
		createdAt: "2026-10-11T10:00:00.000Z",
	};
	records.push(historical);
	expect(
		await invoke(
			"list",
			{ projectId: "project", assetFamilyId: "family" },
			context
		)
	).toEqual([historical]);
	expect(await invoke("save", original, context)).toEqual(historical);
	await expect(
		invoke("save", { ...original, id: crypto.randomUUID() }, context)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("rejects a passed terrain fill without a declared terrain identity", async () => {
	const { context, records } = setup();
	await expect(
		invoke(
			"save",
			{
				...input,
				tiles: input.tiles.map((tile) => ({
					...tile,
					terrainId: null,
					edges: { north: "join", east: "join", south: "join", west: "join" },
				})),
				maps: input.maps.map((map) => ({
					...map,
					outcome: map.scenario === "terrain_fill" ? "passed" : "inconclusive",
					issues: [],
				})),
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toHaveLength(0);
});
