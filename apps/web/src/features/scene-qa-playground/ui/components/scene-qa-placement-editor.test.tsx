// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { SceneQaPlacement } from "@sprite-anvil/api/scene-qa";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SceneQaPlacementEditor } from "./scene-qa-placement-editor";

const frame = { x: 0, y: 0, width: 16, height: 16, durationMs: 100 };
const placement: SceneQaPlacement = {
	id: "object-placement",
	role: "object",
	assetVersionId: "version",
	contractRevisionId: "revision",
	usageTestId: "usage",
	x: 0,
	y: 0,
	layer: 0,
	scale: 1,
	pivot: { x: 0, y: 0 },
	groundPoint: { x: 0, y: 0 },
	sortPoint: { x: 0, y: 0 },
	origin: { x: 0, y: 0 },
	areas: [],
	clips: { idle: [frame], walk: [frame], attack: [frame] },
};
afterEach(cleanup);
test("object optional animation can be removed while idle remains required", () => {
	const onChange = vi.fn();
	render(
		<SceneQaPlacementEditor
			onChange={onChange}
			onRemove={vi.fn()}
			placement={placement}
		/>
	);
	const walk = within(screen.getByRole("group", { name: "walk" }));
	fireEvent.click(walk.getByRole("button", { name: "Remove frame" }));
	expect(onChange).toHaveBeenCalledWith({
		...placement,
		clips: { ...placement.clips, walk: [] },
	});
	expect(
		within(screen.getByRole("group", { name: "idle" })).getByRole("button", {
			name: "Remove frame",
		})
	).toBeDisabled();
});
test("character keeps the last frame of each required animation", () => {
	render(
		<SceneQaPlacementEditor
			onChange={vi.fn()}
			onRemove={vi.fn()}
			placement={{ ...placement, role: "character" }}
		/>
	);
	for (const clip of ["idle", "walk", "attack"]) {
		expect(
			within(screen.getByRole("group", { name: clip })).getByRole("button", {
				name: "Remove frame",
			})
		).toBeDisabled();
	}
});
