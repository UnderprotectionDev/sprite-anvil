// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { DirectionalReviewInput } from "@sprite-anvil/api/directional-reviews";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { DirectionalReviewEditor } from "./directional-review-editor";

vi.mock("@/env", () => ({
	ENV: { VITE_SERVER_URL: "http://127.0.0.1:3000/" },
}));

const previewSources = vi.fn();
const directionLabel = /Yön adı/;
const humanMessage = /Otomatik sanatsal hüküm/;
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
test("shows four views and native scale, accepts eight directions and requires human observations", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn();
	render(
		<DirectionalReviewEditor
			assetFamilyId="family"
			canonicalDesignId="design"
			canonicalVersionId="version"
			contract={specializedProfileContractCatalog[0]}
			contractRevisionId="contract"
			disabled={false}
			onSave={onSave}
			projectId="project"
			versions={[]}
		/>
	);
	expect(screen.getAllByLabelText(directionLabel)).toHaveLength(4);
	expect(screen.getByLabelText("Yakınlaştırma")).toHaveValue("1");
	await user.selectOptions(screen.getByLabelText("Yön sayısı"), "8");
	expect(screen.getAllByLabelText(directionLabel)).toHaveLength(8);
	expect(
		screen.getByRole("button", { name: "İncelemeyi kaydet" })
	).toBeDisabled();
	expect(screen.getByText(humanMessage)).toBeInTheDocument();
});

const version = { id: "version", previewUrl: "/frame.png" } as AssetVersion;
const review: DirectionalReviewInput = {
	id: "64869356-a595-4a3a-995f-87dad6c77d04",
	projectId: "project",
	assetFamilyId: "family",
	canonicalDesignId: "design",
	contractRevisionId: "contract",
	directions: ["south", "west", "north", "east"].map((direction, index) => ({
		direction,
		frames: [
			{
				assetVersionId: "version",
				durationMs: index === 0 ? 100 : 250,
				region: { x: 0, y: 0, width: 32, height: 32 },
			},
			{
				assetVersionId: "version",
				durationMs: 200,
				region: { x: 32, y: 0, width: 32, height: 32 },
			},
		],
	})),
	observations: {
		silhouette: "Outline",
		proportions: "Proportions",
		equipmentSide: "Right",
		palette: "Palette",
		perspective: "Side",
		scale: "32 pixels",
		groundContact: "Different",
	},
	outcome: "needs_follow_up",
	rationale: "Human observation",
};
function preparePreview() {
	const drawImage = vi.fn();
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
		drawImage,
		clearRect: vi.fn(),
		imageSmoothingEnabled: true,
	} as unknown as ReturnType<HTMLCanvasElement["getContext"]>);
	vi.stubGlobal(
		"Image",
		class {
			crossOrigin = "";
			naturalWidth = 64;
			naturalHeight = 32;
			onload: (() => void) | null = null;
			set src(value: string) {
				previewSources(value, this.crossOrigin);
				queueMicrotask(() => this.onload?.());
			}
		}
	);
	return drawImage;
}
function renderReview(onSave = vi.fn()) {
	return render(
		<DirectionalReviewEditor
			assetFamilyId="family"
			canonicalDesignId="design"
			canonicalVersionId="version"
			contract={specializedProfileContractCatalog[0]}
			contractRevisionId="contract"
			disabled={false}
			initial={review}
			onSave={onSave}
			projectId="project"
			versions={[version]}
		/>
	);
}
test("compares varying frame durations at shared elapsed time and saves exact human observations", async () => {
	const draw = preparePreview();
	const onSave = vi.fn();
	const user = userEvent.setup();
	renderReview(onSave);
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Birlikte oynat" })).toBeEnabled()
	);
	fireEvent.change(screen.getByLabelText("Oynatma konumu (ms)"), {
		target: { value: "150" },
	});
	expect(screen.getByText("south · Kare 2")).toBeInTheDocument();
	expect(screen.getByText("west · Kare 1")).toBeInTheDocument();
	const canvas = screen.getByRole("img", { name: "south piksel önizlemesi" });
	expect(canvas).toHaveAttribute("width", "32");
	expect(canvas).toHaveStyle({ width: "32px", height: "32px" });
	expect(draw).toHaveBeenCalledWith(
		expect.anything(),
		32,
		0,
		32,
		32,
		0,
		0,
		32,
		32
	);
	await user.selectOptions(screen.getByLabelText("Yakınlaştırma"), "4");
	expect(canvas).toHaveStyle({ width: "128px" });
	expect(canvas).toHaveAttribute("width", "32");
	await user.click(screen.getByRole("button", { name: "İncelemeyi kaydet" }));
	expect(onSave).toHaveBeenCalledWith(review);
});
test("advances all directions on one clock and stops at pause and reset", async () => {
	preparePreview();
	let tick: FrameRequestCallback = () => {
		throw new Error("Playback has not started");
	};
	const request = vi.fn((callback: FrameRequestCallback) => {
		tick = callback;
		return 1;
	});
	vi.stubGlobal("requestAnimationFrame", request);
	const cancel = vi.fn();
	vi.stubGlobal("cancelAnimationFrame", cancel);
	renderReview();
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Birlikte oynat" })).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Birlikte oynat" }));
	act(() => tick(1000));
	act(() => tick(1150));
	expect(screen.getByLabelText("Oynatma konumu (ms)")).toHaveValue(150);
	expect(screen.getByText("south · Kare 2")).toBeInTheDocument();
	expect(screen.getByText("east · Kare 1")).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Duraklat" }));
	expect(cancel).toHaveBeenCalledWith(1);
	fireEvent.click(screen.getByRole("button", { name: "Başa dön" }));
	expect(screen.getByLabelText("Oynatma konumu (ms)")).toHaveValue(0);
});
test("blocks saving a crop outside the pinned image", async () => {
	preparePreview();
	renderReview();
	fireEvent.change(screen.getByLabelText("Yön 1 kare 1 width"), {
		target: { value: "65" },
	});
	await waitFor(() =>
		expect(
			screen.getByText("Kare alanı görsel sınırlarının dışında.")
		).toBeInTheDocument()
	);
	expect(
		screen.getByRole("button", { name: "İncelemeyi kaydet" })
	).toBeDisabled();
});

test("loads authenticated previews from the configured API origin", async () => {
	preparePreview();
	renderReview();
	await waitFor(() =>
		expect(previewSources).toHaveBeenCalledWith(
			"http://127.0.0.1:3000/frame.png",
			"use-credentials"
		)
	);
});
