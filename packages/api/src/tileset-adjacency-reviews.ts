import { z } from "zod";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);
export const tilesetMapScenarios = [
	"inner_corner",
	"outer_corner",
	"edge",
	"narrow_corridor",
	"terrain_fill",
	"sharp_transition",
	"random",
] as const;
export const tilesetMapScenarioLabels = {
	inner_corner: "Inner corner",
	outer_corner: "Outer corner",
	edge: "Edge",
	narrow_corridor: "Narrow corridor",
	terrain_fill: "Terrain fill",
	sharp_transition: "Sharp transition",
	random: "Random placement",
} as const;
export const tilesetEdges = ["north", "east", "south", "west"] as const;
const regionSchema = z
	.object({
		x: z.number().int().min(0).max(16_384),
		y: z.number().int().min(0).max(16_384),
		width: z.number().int().min(1).max(4096),
		height: z.number().int().min(1).max(4096),
	})
	.strict();
export const tilesetTileSchema = z
	.object({
		unitVersionId: id,
		terrainId: id,
		region: regionSchema,
		edges: z
			.object({
				north: id.nullable(),
				east: id.nullable(),
				south: id.nullable(),
				west: id.nullable(),
			})
			.strict(),
	})
	.strict();
const mapSchema = z
	.object({
		scenario: z.enum(tilesetMapScenarios),
		width: z.number().int().min(2).max(16),
		height: z.number().int().min(2).max(16),
		cells: z.array(id.nullable()).min(4).max(256),
		outcome: z.enum(["passed", "failed", "inconclusive"]),
		notes: z.string().trim().min(1).max(2000),
		issues: z
			.array(
				z
					.object({
						cellIndex: z.number().int().nonnegative(),
						neighborIndex: z.number().int().nonnegative().nullable(),
						notes: z.string().trim().min(1).max(1000),
					})
					.strict()
			)
			.max(256),
	})
	.strict();
function validatePassedMap(
	map: z.infer<typeof mapSchema>,
	tiles: z.infer<typeof tilesetTileSchema>[],
	index: number,
	ctx: z.RefinementCtx
) {
	if (map.outcome !== "passed") {
		return;
	}
	const hasPaintedAdjacency = map.cells.some(
		(cell, cellIndex) =>
			Boolean(cell) &&
			((cellIndex % map.width < map.width - 1 &&
				Boolean(map.cells[cellIndex + 1])) ||
				Boolean(map.cells[cellIndex + map.width]))
	);
	if (!hasPaintedAdjacency) {
		ctx.addIssue({
			code: "custom",
			path: ["maps", index],
			message: "A passed adjacency map must contain neighboring painted tiles.",
		});
	}
	if (map.scenario === "terrain_fill") {
		const terrainIds = new Set(
			map.cells.map(
				(cell) => tiles.find((tile) => tile.unitVersionId === cell)?.terrainId
			)
		);
		if (map.cells.includes(null) || terrainIds.size !== 1) {
			ctx.addIssue({
				code: "custom",
				path: ["maps", index],
				message: "A passed terrain fill must fill every cell with one terrain.",
			});
		}
	}
}

export const tilesetAdjacencyReviewListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();
export const tilesetAdjacencyReviewInputSchema =
	tilesetAdjacencyReviewListInputSchema
		.extend({
			id: z.uuid(),
			compositeVersionId: id,
			contractRevisionId: id,
			tiles: z.array(tilesetTileSchema).min(1).max(256),
			maps: z.array(mapSchema).length(tilesetMapScenarios.length),
		})
		.strict()
		.superRefine((input, ctx) => {
			const tileIds = new Set(input.tiles.map((tile) => tile.unitVersionId));
			if (tileIds.size !== input.tiles.length) {
				ctx.addIssue({
					code: "custom",
					message: "Tile Unit Versions must be unique.",
				});
			}
			if (
				new Set(input.maps.map((map) => map.scenario)).size !==
				tilesetMapScenarios.length
			) {
				ctx.addIssue({
					code: "custom",
					message: "Review every adjacency scenario exactly once.",
				});
			}
			for (const [index, map] of input.maps.entries()) {
				const invalid =
					map.cells.length !== map.width * map.height ||
					map.cells.some((cell) => cell !== null && !tileIds.has(cell)) ||
					!map.cells.some((cell) => cell !== null);
				if (invalid) {
					ctx.addIssue({
						code: "custom",
						path: ["maps", index],
						message:
							"A test map must contain known tiles and match its dimensions.",
					});
				}
				validatePassedMap(map, input.tiles, index, ctx);
				for (const issue of map.issues) {
					const neighbor = issue.neighborIndex;
					if (
						!map.cells[issue.cellIndex] ||
						(neighbor !== null &&
							(!map.cells[neighbor] ||
								Math.abs(
									(issue.cellIndex % map.width) - (neighbor % map.width)
								) +
									Math.abs(
										Math.floor(issue.cellIndex / map.width) -
											Math.floor(neighbor / map.width)
									) !==
									1))
					) {
						ctx.addIssue({
							code: "custom",
							path: ["maps", index, "issues"],
							message:
								"An issue must identify a painted tile or its adjacent painted connection.",
						});
					}
				}
				if (map.outcome === "passed" && map.issues.length > 0) {
					ctx.addIssue({
						code: "custom",
						path: ["maps", index],
						message: "A map with unresolved human issues cannot pass.",
					});
				}
			}
		});
const pinSchema = z
	.object({
		unitVersionId: id,
		tileId: id,
		assetVersionId: id,
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		sourceImageDimensions: z
			.object({
				width: z.number().int().positive(),
				height: z.number().int().positive(),
			})
			.strict(),
	})
	.strict();
const adjacencyIssueSchema = z
	.object({
		scenario: z.enum(tilesetMapScenarios),
		cellIndex: z.number().int().nonnegative(),
		neighborIndex: z.number().int().nonnegative(),
		unitVersionId: id,
		neighborUnitVersionId: id,
		edge: z.enum(tilesetEdges),
		result: z.enum(["mismatch", "unknown"]),
	})
	.strict();
export const tilesetAdjacencyReviewRecordSchema =
	tilesetAdjacencyReviewInputSchema.safeExtend({
		contractVersion: z.literal("tileset-adjacency-review/1.0.0"),
		versionPins: z.array(pinSchema).min(1),
		adjacencyIssues: z.array(adjacencyIssueSchema),
		contractSnapshot: specializedProfileContractSchema,
		reviewedByUserId: id,
		createdAt: z.string().datetime(),
	});
export type TilesetTile = z.infer<typeof tilesetTileSchema>;
export type TilesetAdjacencyReviewInput = z.infer<
	typeof tilesetAdjacencyReviewInputSchema
>;
export type TilesetAdjacencyReviewRecord = z.infer<
	typeof tilesetAdjacencyReviewRecordSchema
>;
export type TilesetTestMap = TilesetAdjacencyReviewInput["maps"][number];
export interface TilesetAdjacencyReviewStore {
	append: (
		userId: string,
		record: TilesetAdjacencyReviewRecord
	) => Promise<TilesetAdjacencyReviewRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<TilesetAdjacencyReviewRecord[] | null>;
	listAccessibleVersionIds: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<Set<string> | null>;
}

type AdjacencyIssue = z.infer<typeof adjacencyIssueSchema>;
function inspectMapAdjacency(
	map: TilesetTestMap,
	tiles: ReadonlyMap<string, TilesetTile>
): AdjacencyIssue[] {
	const issues: AdjacencyIssue[] = [];
	for (const [cellIndex, unitId] of map.cells.entries()) {
		const tile = unitId ? tiles.get(unitId) : undefined;
		if (!tile) {
			continue;
		}
		const neighbors = [
			{
				index: cellIndex + 1,
				edge: "east",
				opposite: "west",
				exists: cellIndex % map.width < map.width - 1,
			},
			{
				index: cellIndex + map.width,
				edge: "south",
				opposite: "north",
				exists: cellIndex + map.width < map.cells.length,
			},
		] as const;
		for (const neighbor of neighbors) {
			if (!neighbor.exists) {
				continue;
			}
			const adjacentId = map.cells[neighbor.index];
			const adjacent = adjacentId ? tiles.get(adjacentId) : undefined;
			if (!adjacent) {
				continue;
			}
			const result = connectorResult(
				tile.edges[neighbor.edge],
				adjacent.edges[neighbor.opposite]
			);
			if (result) {
				issues.push({
					scenario: map.scenario,
					cellIndex,
					neighborIndex: neighbor.index,
					unitVersionId: tile.unitVersionId,
					neighborUnitVersionId: adjacent.unitVersionId,
					edge: neighbor.edge,
					result,
				});
			}
		}
	}
	return issues;
}
function connectorResult(
	left: string | null,
	right: string | null
): "unknown" | "mismatch" | null {
	if (left === null || right === null) {
		return "unknown";
	}
	return left === right ? null : "mismatch";
}
/** Checks declared connector identity, not subjective visual quality or image pixels. */
export function inspectTilesetAdjacency(
	input: Pick<TilesetAdjacencyReviewInput, "tiles" | "maps">
): AdjacencyIssue[] {
	const tiles = new Map(input.tiles.map((tile) => [tile.unitVersionId, tile]));
	return input.maps.flatMap((map) => inspectMapAdjacency(map, tiles));
}
