// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { BackgroundScrollingPreview } from "./background-scrolling-preview";

// Pixi is the GPU/platform boundary; controls and configuration use real React.
vi.mock("pixi.js", () => {
	class Texture {
		source = { scaleMode: "linear" };
		static from() {
			return new Texture();
		}
		destroy() {
			/* GPU resources are mocked. */
		}
	}
	class Sprite {
		position = { set: vi.fn() };
		scale = { set: vi.fn() };
	}
	class Application {
		canvas = document.createElement("canvas");
		stage = { addChild: vi.fn() };
		async init() {
			/* GPU initialization is mocked. */
		}
		render() {
			/* GPU rendering is mocked. */
		}
		destroy() {
			/* GPU resources are mocked. */
		}
	}
	return { Application, Texture, Sprite, Rectangle: class {} };
});
Object.defineProperty(HTMLImageElement.prototype, "decode", {
	configurable: true,
	value: async () => undefined,
});
const layers = [
	{
		id: "sky",
		assetRecordId: "sky-record",
		assetVersionId: "sky-version",
		order: 0,
		naturalSize: { width: 320, height: 180 },
		targetAspectRatio: { width: 16, height: 9 },
		crop: { x: 0, y: 0, width: 320, height: 180 },
		safeArea: { x: 80, y: 30, width: 160, height: 120 },
	},
	{
		id: "trees",
		assetRecordId: "trees-record",
		assetVersionId: "trees-version",
		order: 1,
		naturalSize: { width: 320, height: 180 },
		targetAspectRatio: { width: 16, height: 9 },
		crop: { x: 0, y: 0, width: 320, height: 180 },
		safeArea: { x: 80, y: 30, width: 160, height: 120 },
	},
];
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});
test("seeks all layers on one timeline with independent speed and loop settings", async () => {
	vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue();
	vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
		320
	);
	vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(
		180
	);
	const user = userEvent.setup();
	render(
		<BackgroundScrollingPreview
			durationMs={10_000}
			layers={layers}
			motions={[
				{ layerId: "sky", speed: 40, loop: true, startOffset: 0 },
				{ layerId: "trees", speed: 100, loop: false, startOffset: 10 },
			]}
			onPlayback={vi.fn()}
			versions={[
				{ id: "sky-version", previewUrl: "/sky" },
				{ id: "trees-version", previewUrl: "/trees" },
			]}
		/>
	);
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Play scrolling" })).toBeEnabled()
	);
	await user.clear(screen.getByLabelText("Timeline (ms)"));
	await user.type(screen.getByLabelText("Timeline (ms)"), "9000");
	expect(screen.getByText("sky: 40 px · loop 1")).toBeVisible();
	expect(screen.getByText("trees: 910 px · no loop")).toBeVisible();
	await user.click(screen.getByRole("button", { name: "Restart scrolling" }));
	expect(screen.getByLabelText("Timeline (ms)")).toHaveValue(0);
	expect(screen.getByText("trees: 10 px · no loop")).toBeVisible();
});
test("unreadable exact content blocks playback", async () => {
	vi.spyOn(HTMLImageElement.prototype, "decode").mockRejectedValue(
		new Error("Image unavailable")
	);
	render(
		<BackgroundScrollingPreview
			durationMs={10_000}
			layers={layers}
			motions={[
				{ layerId: "sky", speed: 40, loop: true, startOffset: 0 },
				{ layerId: "trees", speed: 100, loop: false, startOffset: 0 },
			]}
			onPlayback={vi.fn()}
			versions={[
				{ id: "sky-version", previewUrl: "/sky" },
				{ id: "trees-version", previewUrl: "/trees" },
			]}
		/>
	);
	await waitFor(() =>
		expect(screen.getByRole("alert")).toHaveTextContent("Image unavailable")
	);
	expect(screen.getByRole("button", { name: "Play scrolling" })).toBeDisabled();
});
