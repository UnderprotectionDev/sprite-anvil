import type { TilesetTestMap } from "@sprite-anvil/api/tileset-adjacency-reviews";
import { tilesetMapScenarios } from "@sprite-anvil/api/tileset-adjacency-reviews";

/** Small usage examples, not an autotiler or a level editor. */
export function createTilesetTestMaps(
	primary: string,
	secondary: string | null
): TilesetTestMap[] {
	const patterns = {
		inner_corner: ["AAAAA", "AAAAA", "AABBB", "AABBB", "AABBB"],
		outer_corner: ["BBBBB", "BAAAB", "BAAAB", "BAAAB", "BBBBB"],
		edge: ["AABBB", "AABBB", "AABBB", "AABBB", "AABBB"],
		narrow_corridor: ["BBABB", "BBABB", "BBABB", "BBABB", "BBABB"],
		terrain_fill: ["AAAAA", "AAAAA", "AAAAA", "AAAAA", "AAAAA"],
		sharp_transition: ["AAAAA", "AAAAA", "BBBBB", "BBBBB", "BBBBB"],
		random: ["ABBAA", "BAABB", "ABBAB", "AABBA", "BABAB"],
	};
	return tilesetMapScenarios.map((scenario) => ({
		scenario,
		width: 5,
		height: 5,
		cells: patterns[scenario]
			.join("")
			.split("")
			.map((cell) =>
				(scenario === "random" ? Math.random() < 0.5 : cell === "A")
					? primary
					: secondary
			),
		outcome: "inconclusive",
		notes: "",
		issues: [],
	}));
}
