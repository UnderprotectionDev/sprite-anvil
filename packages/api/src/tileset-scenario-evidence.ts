import {
	inspectTilesetAdjacency,
	type TilesetAdjacencyReviewInput,
	type TilesetTestMap,
	type TilesetTile,
	tilesetMapScenarioLabels,
} from "./tileset-adjacency-reviews";

function mapGroups(map: TilesetTestMap, tiles: TilesetTile[]) {
	const groups = new Map(
		tiles.map((tile) => [
			tile.unitVersionId,
			tile.terrainId === null
				? `tile:${tile.unitVersionId}`
				: `terrain:${tile.terrainId}`,
		])
	);
	return map.cells.map((cell) =>
		cell === null ? null : (groups.get(cell) ?? null)
	);
}

function hasBoundaryBlock(
	map: TilesetTestMap,
	groups: (string | null)[],
	corner: boolean
) {
	return groups.some((_, index) => {
		if (
			index % map.width === map.width - 1 ||
			index + map.width + 1 >= groups.length
		) {
			return false;
		}
		const block = [
			groups[index],
			groups[index + 1],
			groups[index + map.width],
			groups[index + map.width + 1],
		];
		if (corner) {
			return block.some(
				(group) =>
					typeof group === "string" &&
					block.filter((value) => value === group).length === 3
			);
		}
		return [
			[0, 1],
			[2, 3],
			[0, 2],
			[1, 3],
		].some(([first, second]) => {
			const group = block[first ?? 0];
			return (
				typeof group === "string" &&
				block[second ?? 0] === group &&
				block.filter((value) => value === group).length === 2
			);
		});
	});
}

function hasCorridor(map: TilesetTestMap, groups: (string | null)[]) {
	return groups.some((group, index) => {
		const column = index % map.width;
		if (
			group === null ||
			column === 0 ||
			column === map.width - 1 ||
			index < map.width ||
			index + map.width >= groups.length
		) {
			return false;
		}
		const horizontal =
			groups[index - 1] === group &&
			groups[index + 1] === group &&
			groups[index - map.width] !== group &&
			groups[index + map.width] !== group;
		const vertical =
			groups[index - map.width] === group &&
			groups[index + map.width] === group &&
			groups[index - 1] !== group &&
			groups[index + 1] !== group;
		return horizontal || vertical;
	});
}

function hasTerrainTransition(map: TilesetTestMap, tiles: TilesetTile[]) {
	const terrains = new Map(
		tiles.map((tile) => [tile.unitVersionId, tile.terrainId])
	);
	return map.cells.some((cell, index) => {
		const terrain = cell === null ? null : (terrains.get(cell) ?? null);
		if (terrain === null) {
			return false;
		}
		return [
			index % map.width < map.width - 1 ? index + 1 : -1,
			index + map.width,
		].some((neighbor) => {
			const adjacent = map.cells[neighbor];
			const otherTerrain = adjacent ? (terrains.get(adjacent) ?? null) : null;
			return otherTerrain !== null && otherTerrain !== terrain;
		});
	});
}

function passedScenarioError(map: TilesetTestMap, tiles: TilesetTile[]) {
	const groups = mapGroups(map, tiles);
	switch (map.scenario) {
		case "inner_corner":
		case "outer_corner":
			return hasBoundaryBlock(map, groups, true)
				? null
				: "Paint a corner with three cells of one terrain or tile identity and a different or empty fourth cell; otherwise keep the result inconclusive.";
		case "edge":
			return hasBoundaryBlock(map, groups, false)
				? null
				: "Paint a straight boundary between two neighboring cells of one terrain or tile identity and two different or empty cells.";
		case "narrow_corridor":
			return hasCorridor(map, groups)
				? null
				: "Paint three cells in a straight corridor with different or empty cells on both sides of its middle cell.";
		case "sharp_transition":
			return hasTerrainTransition(map, tiles)
				? null
				: "Paint adjacent tiles with two different declared Terrain IDs; otherwise keep the result inconclusive.";
		case "terrain_fill":
			return map.cells.every(
				(cell) =>
					cell !== null &&
					tiles.some(
						(tile) => tile.unitVersionId === cell && tile.terrainId !== null
					)
			)
				? null
				: "Fill every cell with one declared Terrain ID; otherwise keep the result inconclusive.";
		case "random":
			return map.cells.filter((cell) => cell !== null).length >= 3 &&
				new Set(map.cells).size > 1
				? null
				: "Paint at least three cells with varied tile placement or empty cells; otherwise keep the result inconclusive.";
		default:
			return null;
	}
}

/** Validates new evidence without reinterpreting immutable historical records. */
export function getTilesetReviewEvidenceError(
	input: Pick<TilesetAdjacencyReviewInput, "tiles" | "maps">
): string | null {
	const adjacencyIssues = inspectTilesetAdjacency(input);
	for (const map of input.maps) {
		if (map.outcome === "passed") {
			const error = passedScenarioError(map, input.tiles);
			if (error) {
				return `${tilesetMapScenarioLabels[map.scenario]}: ${error}`;
			}
		}
		if (
			map.outcome === "failed" &&
			map.issues.length === 0 &&
			!adjacencyIssues.some(
				(issue) =>
					issue.scenario === map.scenario && issue.result === "mismatch"
			)
		) {
			return `${tilesetMapScenarioLabels[map.scenario]}: Record a tile or connection issue before marking this scenario failed.`;
		}
	}
	return null;
}
