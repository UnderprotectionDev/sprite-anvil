// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { AnimationTimingClipPreview } from "./animation-timing-clip-preview";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
const missingGround = /Ground metadata unavailable/;
const tolerance = /Tolerance is not declared/i;
const firstPivot = /pivot · .*x.*1/;
const secondPivot = /pivot · .*x.*2/;

test("shows the exact current frame metadata as playback changes", () => {
	const frames = [
		{ assetVersionId: "v", frameKey: "a", durationMs: 100 },
		{ assetVersionId: "v", frameKey: "b", durationMs: 100 },
	];
	const records = ["a", "b"].map((frameKey, index) => ({
		id: frameKey,
		projectId: "p",
		profileId: "character_creature_animation",
		contractRevisionId: "c",
		assetVersionId: "v",
		frameKey,
		createdAt: "2026-01-01",
		fields: [
			{
				fieldId: "pivot",
				value: { x: index + 1, y: 2 },
				unit: "px",
				coordinateSystem: "source_image_top_left",
				source: { kind: "authored" },
			},
		],
	}));
	const props = {
		frames,
		gameplayMetadataRecords: records,
		gameplayMetadataStatus: "ready",
		projectId: "p",
		contractRevisionId: "c",
		label: "Walk",
		looping: false,
		onStatus: vi.fn(),
		statusKey: "walk",
		versions: [],
		zoom: 1,
	} as unknown as Omit<
		ComponentProps<typeof AnimationTimingClipPreview>,
		"elapsedMs"
	>;
	const { rerender } = render(
		<AnimationTimingClipPreview {...props} elapsedMs={0} />
	);
	expect(screen.getByText(firstPivot)).toBeInTheDocument();
	expect(screen.getByLabelText("Walk spatial overlay")).toBeInTheDocument();
	expect(screen.getByText(tolerance)).toBeInTheDocument();
	rerender(<AnimationTimingClipPreview {...props} elapsedMs={100} />);
	expect(screen.getByText(secondPivot)).toBeInTheDocument();
	expect(screen.queryByText(firstPivot)).not.toBeInTheDocument();
	rerender(
		<AnimationTimingClipPreview
			{...props}
			elapsedMs={100}
			gameplayMetadataRecords={[]}
		/>
	);
	expect(
		screen.getByText("No metadata for this frame and version.")
	).toBeInTheDocument();
	expect(screen.getByText(missingGround)).toBeInTheDocument();
});

test("positions source-image marks inside the cropped and centered displayed frame", async () => {
	function loadedImage() {
		const image = document.createElement("img");
		Object.defineProperty(image, "naturalWidth", { value: 64 });
		Object.defineProperty(image, "naturalHeight", { value: 64 });
		Object.defineProperty(image, "src", {
			set: () =>
				queueMicrotask(() => image.onload?.call(image, new Event("load"))),
		});
		return image;
	}
	vi.stubGlobal("Image", loadedImage);
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
		drawImage: vi.fn(),
		clearRect: vi.fn(),
		globalAlpha: 1,
		imageSmoothingEnabled: false,
	} as never);
	const props = {
		frames: [
			{
				assetVersionId: "v",
				frameKey: "a",
				durationMs: 100,
				region: { x: 10, y: 20, width: 16, height: 16 },
			},
			{
				assetVersionId: "v",
				frameKey: "b",
				durationMs: 100,
				region: { x: 0, y: 0, width: 24, height: 24 },
			},
		],
		gameplayMetadataRecords: [
			{
				id: "m",
				projectId: "p",
				profileId: "character_creature_animation",
				contractRevisionId: "c",
				assetVersionId: "v",
				frameKey: "a",
				createdAt: "2026-11-16T00:00:00Z",
				fields: [
					{
						fieldId: "pivot",
						unit: "px",
						coordinateSystem: "source_image_top_left",
						value: { x: 12, y: 23 },
					},
					{
						fieldId: "mount_points",
						unit: "px",
						coordinateSystem: "source_image_top_left",
						value: { hand: { x: 12, y: 23 }, weapon: { x: 12, y: 23 } },
					},
				],
			},
		],
		gameplayMetadataStatus: "ready",
		projectId: "p",
		contractRevisionId: "c",
		label: "Cropping",
		looping: false,
		onStatus: vi.fn(),
		statusKey: "cropping",
		versions: [{ id: "v", previewUrl: "/v.png" }],
		zoom: 2,
	} as unknown as Omit<
		ComponentProps<typeof AnimationTimingClipPreview>,
		"elapsedMs"
	>;
	render(<AnimationTimingClipPreview {...props} elapsedMs={0} />);
	const overlay = screen.getByLabelText("Cropping spatial overlay");
	await waitFor(() => expect(overlay).toHaveAttribute("viewBox", "0 0 24 24"));
	const clipped = overlay.querySelector("svg");
	expect(clipped).toHaveAttribute("viewBox", "10 20 16 16");
	expect(clipped).toHaveAttribute("x", "4");
	expect(clipped).toHaveAttribute("y", "4");
	expect(overlay).toHaveAttribute("width", "48");
	expect(overlay.querySelector('[aria-label="pivot"] path')).toHaveAttribute(
		"d",
		"M 10.5 23 h 3 M 12 21.5 v 3"
	);
	expect(overlay.querySelectorAll('[aria-label="mount_points"]')).toHaveLength(
		2
	);
});
