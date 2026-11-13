// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { PixelOperation } from "@sprite-anvil/api/pixel-editor";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
	createPixelEditorToolStore,
	type PixelTool,
	patchToolState,
} from "../../store/pixel-editor-tool-store";
import { PixelCanvas } from "./pixel-canvas";

beforeEach(() => {
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(cleanup);

function setup(tool: PixelTool, selection = null as null | object) {
	const store = createPixelEditorToolStore();
	patchToolState(store, {
		tool,
		selection: selection as never,
	});
	const operations: PixelOperation[] = [];
	render(
		<PixelCanvas
			disabled={false}
			image={null}
			interactive
			label="Working Draft"
			onOperation={(operation) => operations.push(operation)}
			size={{ width: 32, height: 32 }}
			store={store}
		/>
	);
	const widget = screen.getByRole("application");
	return { operations, store, widget, user: userEvent.setup() };
}

test("focusing the canvas puts the cursor on a pixel and announces it", async () => {
	const { user } = setup("pen");
	await user.tab();
	expect(screen.getByText("Pixel 0, 0", { exact: false })).toBeInTheDocument();
});

test("Shift with an arrow key still moves one pixel", async () => {
	const { user } = setup("pen");
	await user.tab();
	await user.keyboard("{Shift>}{ArrowRight}{ArrowDown}{/Shift}");
	expect(screen.getByText("Pixel 1, 1", { exact: false })).toBeInTheDocument();
});

test("keyboard alone selects an area and announces it", async () => {
	const { user, store } = setup("select");
	await user.tab();
	await user.keyboard("{Enter}{ArrowRight}{ArrowRight}{ArrowDown}{Enter}");
	expect(store.state.selection).toEqual({ x: 0, y: 0, width: 3, height: 2 });
	expect(
		screen.getByText("Selection 3 × 2 at 0, 0", { exact: false })
	).toBeInTheDocument();
});

test("keyboard alone moves the selection", async () => {
	const { user, operations, store } = setup("move", {
		x: 2,
		y: 2,
		width: 2,
		height: 2,
	});
	await user.tab();
	await user.keyboard(
		"{ArrowRight}{ArrowRight}{Enter}{ArrowRight}{ArrowDown}{Enter}"
	);
	expect(operations).toEqual([
		{
			type: "move-selection",
			rect: { x: 2, y: 2, width: 2, height: 2 },
			dx: 1,
			dy: 1,
		},
	]);
	expect(store.state.selection).toEqual({ x: 3, y: 3, width: 2, height: 2 });
});

test("the move tool without a selection says why nothing started", async () => {
	const { user } = setup("move");
	await user.tab();
	await user.keyboard("{Enter}");
	expect(
		screen.getByText("Select an area first", { exact: false })
	).toBeInTheDocument();
});

test("Escape cancels a started gesture and says so", async () => {
	const { user } = setup("line");
	await user.tab();
	await user.keyboard("{Enter}{ArrowRight}{Escape}");
	expect(screen.getByText("Cancelled", { exact: false })).toBeInTheDocument();
	expect(
		screen.queryByText("started at", { exact: false })
	).not.toBeInTheDocument();
});
