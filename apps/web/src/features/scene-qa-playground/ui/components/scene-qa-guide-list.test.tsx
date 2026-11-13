// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { SceneQaPlacement } from "@sprite-anvil/api/scene-qa";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { SceneQaGuideList } from "./scene-qa-guide-list";

afterEach(cleanup);

const placement = {
	id: "hero",
	role: "character",
	pivot: { x: 1, y: 2 },
	groundPoint: { x: 3, y: 4 },
	sortPoint: { x: 5, y: 6 },
	origin: { x: 7, y: 8 },
	areas: [{ kind: "hitbox", x: 9, y: 10, width: 11, height: 12 }],
} as unknown as SceneQaPlacement;

test("every overlay is listed by name and position without relying on color", () => {
	render(<SceneQaGuideList placements={[placement]} />);
	const list = screen.getByRole("list", { name: "Scene overlays" });
	const items = within(list)
		.getAllByRole("listitem")
		.map((item) => item.textContent);
	expect(items).toEqual([
		"hero · Pivot (1, 2)",
		"hero · Ground (3, 4)",
		"hero · Sort (5, 6)",
		"hero · Effect origin (7, 8)",
		"hero · Hitbox area (9, 10) 11×12",
	]);
});
