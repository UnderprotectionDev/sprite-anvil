// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { VfxSynchronizationInput } from "@sprite-anvil/api/vfx-synchronization";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { VfxSynchronizedPreview } from "./vfx-synchronized-preview";

const mocks = vi.hoisted(() => ({
	render: vi.fn(),
}));
vi.mock("pixi.js", () => ({
	Application: class {
		canvas = document.createElement("canvas");
		init = async () => undefined;
		destroy = () => undefined;
	},
}));
vi.mock("../../lib/vfx-preview-scene", () => ({
	createVfxPreviewScene: () => ({
		render: mocks.render,
		destroy: () => undefined,
	}),
}));
beforeEach(() => {
	HTMLImageElement.prototype.decode = () => Promise.resolve();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	mocks.render.mockReset();
});

const frame = (id: string, durationMs: number) => ({
	assetVersionId: id,
	unitVersionId: id,
	frameKey: id,
	durationMs,
	region: { x: 0, y: 0, width: 32, height: 32 },
	origin: { x: 8, y: 24 },
});
const input = {
	effect: { looping: false, frames: [frame("spark", 80)] },
	owner: { looping: false, frames: [frame("cast", 300)] },
	event: { id: "spell-release", timeMs: 150 },
	layer: 1,
	sceneAssetVersionId: "scene",
} as VfxSynchronizationInput;
const versions = ["spark", "cast", "scene"].map((id) => ({
	id,
	previewUrl: `/vfx-fixture/${id}.png`,
})) as AssetVersion[];

function mount(previewVersions = versions) {
	const onReady = vi.fn();
	render(
		<VfxSynchronizedPreview
			input={input}
			onReady={onReady}
			versions={previewVersions}
		/>
	);
	return onReady;
}

test("names the timeline and pauses playback when the user scrubs it", async () => {
	const onReady = mount();
	await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
	// Base UI keeps the thumb visibility:hidden until it can measure layout, which jsdom never does,
	// so the role query needs hidden:true and the name is asserted through its aria-label.
	const timeline = screen.getByRole("slider", { hidden: true });
	expect(timeline).toHaveAttribute("aria-label", "Timeline (ms)");
	expect(screen.getByLabelText("Timeline (ms)")).toBe(timeline);
	expect(timeline).toHaveValue("0");
	expect(timeline).toHaveAttribute("min", "0");
	expect(timeline).toHaveAttribute("max", "300");
	fireEvent.click(screen.getByRole("button", { name: "Play" }));
	expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
	fireEvent.change(screen.getByLabelText("Timeline (ms)"), {
		target: { value: "150" },
	});
	expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
	expect(screen.getByLabelText("Timeline (ms)")).toHaveValue("150");
	expect(
		screen.getByText("150 ms · spell-release at 150 ms · layer 1")
	).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Play" }));
	expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
	timeline.focus();
	await userEvent.setup().keyboard("{ArrowRight}");
	expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
	expect(timeline).toHaveValue("151");
});

test("restarts the timeline when the playback mode changes and keeps background and zoom choices", async () => {
	const onReady = mount();
	await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
	fireEvent.change(screen.getByLabelText("Timeline (ms)"), {
		target: { value: "200" },
	});
	fireEvent.change(screen.getByLabelText("Playback mode"), {
		target: { value: "alone" },
	});
	expect(screen.getByLabelText("Timeline (ms)")).toHaveValue("0");
	expect(screen.getByLabelText("Timeline (ms)")).toHaveAttribute("max", "80");
	fireEvent.change(screen.getByLabelText("Background"), {
		target: { value: "scene" },
	});
	expect(screen.getByLabelText("Background")).toHaveValue("scene");
	fireEvent.change(screen.getByLabelText("Zoom"), { target: { value: "4" } });
	expect(screen.getByLabelText("Zoom")).toHaveValue("4");
	expect(mocks.render).toHaveBeenCalled();
});

test("reports a missing version and keeps playback disabled", async () => {
	const onReady = mount(versions.slice(0, 2));
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Choose exact effect, owner and scene versions first."
	);
	expect(onReady).toHaveBeenLastCalledWith(false);
	expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
	expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
});

function stubReducedMotion(initial: boolean) {
	let matches = initial;
	const listeners = new Set<() => void>();
	vi.stubGlobal("matchMedia", (query: string) => ({
		get matches() {
			return matches;
		},
		media: query,
		addEventListener: (_: string, listener: () => void) =>
			listeners.add(listener),
		removeEventListener: (_: string, listener: () => void) =>
			listeners.delete(listener),
	}));
	return (next: boolean) => {
		matches = next;
		for (const listener of listeners) {
			listener();
		}
	};
}

test("pauses playback and explains it when the system turns reduced motion on", async () => {
	const setReduced = stubReducedMotion(false);
	const onReady = mount();
	await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
	fireEvent.click(screen.getByRole("button", { name: "Play" }));
	expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
	act(() => setReduced(true));
	expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
	expect(screen.getByRole("note")).toHaveTextContent("reduced motion");
	fireEvent.click(screen.getByRole("button", { name: "Play" }));
	expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
});

test("when the system already reduces motion playback starts paused until Play is pressed", async () => {
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: true,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	}));
	vi.stubGlobal(
		"requestAnimationFrame",
		vi.fn(() => 1)
	);
	vi.stubGlobal("cancelAnimationFrame", vi.fn());
	const onReady = mount();
	await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
	expect(screen.getByRole("note")).toHaveTextContent("reduced motion");
	expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
	fireEvent.click(screen.getByRole("button", { name: "Play" }));
	expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
});
