// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { TilesetTestMap } from "@sprite-anvil/api/tileset-adjacency-reviews";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { TilesetMap } from "./tileset-map";

vi.mock("@/env", () => ({ ENV: { VITE_SERVER_URL: "http://tiles.test" } }));

afterEach(cleanup);

const tile = {
	unitVersionId: "unit",
	tileId: "grass",
	assetVersionId: "version",
	terrainId: "grass",
	region: { x: 0, y: 0, width: 16, height: 16 },
	edges: { north: "grass", east: "grass", south: "grass", west: "grass" },
};
const version = {
	id: "version",
	sourceImageDimensions: { width: 16, height: 16 },
	previewUrl: "/tile.svg",
} as AssetVersion;
const map: TilesetTestMap = {
	scenario: "terrain_fill",
	width: 3,
	height: 2,
	cells: ["unit", "unit", "unit", "unit", "unit", "unit"],
	outcome: "inconclusive",
	notes: "",
	issues: [],
};

function setup() {
	const onInspect = vi.fn();
	const onPaint = vi.fn();
	render(
		<TilesetMap
			map={map}
			onInspect={onInspect}
			onPaint={onPaint}
			tiles={[tile]}
			versions={[version]}
		/>
	);
	return { onInspect, onPaint };
}

const cell = (number: number) =>
	screen.getByRole("button", { name: `Cell ${number}: grass` });

test("arrow keys move focus between map cells and stop at the edges", async () => {
	const user = userEvent.setup();
	setup();
	cell(1).focus();
	await user.keyboard("{ArrowRight}");
	expect(cell(2)).toHaveFocus();
	await user.keyboard("{ArrowDown}");
	expect(cell(5)).toHaveFocus();
	await user.keyboard("{ArrowLeft}");
	expect(cell(4)).toHaveFocus();
	await user.keyboard("{ArrowLeft}");
	expect(cell(4)).toHaveFocus();
	await user.keyboard("{ArrowUp}");
	expect(cell(1)).toHaveFocus();
	await user.keyboard("{ArrowUp}");
	expect(cell(1)).toHaveFocus();
});

test("Enter and Space on a focused cell still inspect and paint it", async () => {
	const user = userEvent.setup();
	const { onInspect, onPaint } = setup();
	cell(1).focus();
	await user.keyboard("{ArrowRight}{Enter}");
	expect(onInspect).toHaveBeenLastCalledWith(1);
	expect(onPaint).toHaveBeenLastCalledWith(1);
	await user.keyboard("{ArrowRight} ");
	expect(onInspect).toHaveBeenLastCalledWith(2);
});
