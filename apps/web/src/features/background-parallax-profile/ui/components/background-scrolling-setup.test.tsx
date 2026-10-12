// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { BackgroundLayerLayoutRecord } from "@sprite-anvil/api/background-layer-layouts";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { BackgroundScrollingSetup } from "./background-scrolling-setup";

const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	client: { backgroundScrollingTests: { save: mocks.save } },
	orpc: {
		backgroundScrollingTests: {
			list: {
				queryOptions: () => ({ queryKey: ["scrolling"], queryFn: mocks.list }),
			},
		},
	},
}));
vi.mock("./background-scrolling-preview", () => ({
	BackgroundScrollingPreview: ({
		onPlayback,
		durationMs,
	}: {
		onPlayback: (time: number) => void;
		durationMs: number;
	}) => (
		<button onClick={() => onPlayback(durationMs)} type="button">
			Complete playback
		</button>
	),
}));
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
const contract = specializedProfileContractCatalog.find(
	(entry) => entry.profileId === "background_parallax"
);
if (!contract) {
	throw new Error("Background contract missing");
}
const layout: BackgroundLayerLayoutRecord = {
	id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	projectId: "project",
	assetFamilyId: "family",
	visualWorldId: "world",
	contractRevisionId: "contract",
	contractSnapshot: contract,
	createdAt: "2026-10-12T00:00:00Z",
	createdByUserId: "user",
	layers: [
		{
			id: "sky",
			assetRecordId: "sky",
			assetVersionId: "sky-v1",
			order: 0,
			naturalSize: { width: 320, height: 180 },
			targetAspectRatio: { width: 16, height: 9 },
			crop: { x: 0, y: 0, width: 320, height: 180 },
			safeArea: { x: 80, y: 30, width: 160, height: 120 },
		},
	],
	versionPins: [
		{
			assetRecordId: "sky",
			assetRecordName: "Sky",
			assetVersionId: "sky-v1",
			versionNumber: 1,
			contentDigest: "a".repeat(64),
			contentLength: 100,
			contentType: "image/png",
			naturalSize: { width: 320, height: 180 },
		},
	],
};
function mount() {
	return render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<BackgroundScrollingSetup
				assetRecords={[
					{
						id: "player",
						name: "Player",
						assetCategory: "character_creature_animation",
						availability: "active",
					},
				]}
				layout={layout}
				versions={[
					{
						id: "player-v1",
						assetRecordId: "player",
						integrityVerified: true,
						previewUrl: "/player.png",
						sourceImageDimensions: { width: 32, height: 32 },
					},
				]}
			/>
		</QueryClientProvider>
	);
}
async function prepare() {
	await waitFor(() => expect(mocks.list).toHaveBeenCalled());
	fireEvent.change(screen.getByLabelText("Exact player version"), {
		target: { value: "player-v1" },
	});
	for (const label of [
		"Loop",
		"Seam",
		"Crop",
		"Contrast",
		"Player visibility",
	]) {
		fireEvent.change(screen.getByLabelText(`${label} outcome`), {
			target: { value: "passed" },
		});
		fireEvent.change(screen.getByLabelText(`${label} notes`), {
			target: { value: "Observed during playback." },
		});
	}
	fireEvent.click(screen.getByRole("button", { name: "Complete playback" }));
}
test("changing the player or scrolling settings clears observations and playback evidence", async () => {
	mocks.list.mockResolvedValue([]);
	mount();
	await prepare();
	fireEvent.change(screen.getByLabelText("sky relative speed (px/s)"), {
		target: { value: "40" },
	});
	expect(screen.getByLabelText("Player visibility outcome")).toHaveValue(
		"inconclusive"
	);
	expect(screen.getByLabelText("Player visibility notes")).toHaveValue("");
	expect(
		screen.getByRole("button", { name: "Save scrolling test" })
	).toBeDisabled();
});
test("an uncertain save only unlocks when its exact operation is read back", async () => {
	let records: unknown[] = [];
	mocks.list.mockImplementation(() => Promise.resolve(records));
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	mount();
	await prepare();
	fireEvent.click(screen.getByRole("button", { name: "Save scrolling test" }));
	const check = await screen.findByRole("button", {
		name: "Check current tests",
	});
	fireEvent.click(check);
	await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
	expect(screen.getByLabelText("Exact player version")).toBeDisabled();
	const [[input]] = mocks.save.mock.calls;
	mocks.list.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	fireEvent.click(check);
	await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(3));
	expect(screen.getByLabelText("Exact player version")).toBeDisabled();
	const saved = {
		...input,
		layoutSnapshot: layout,
		playerPin: { assetRecordName: "Player", versionNumber: 1 },
		createdAt: "2026-10-12T00:00:00Z",
		outcome: "passed",
	};
	records = [
		{
			...saved,
			observations: {
				...input.observations,
				contrast: { outcome: "failed", notes: "Different observation." },
			},
		},
	];
	fireEvent.click(check);
	await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(4));
	expect(screen.getByLabelText("Exact player version")).toBeDisabled();
	records = [saved];
	fireEvent.click(check);
	await screen.findByText("Scrolling test saved.");
	expect(screen.getByLabelText("Exact player version")).toBeEnabled();
	expect(mocks.save).toHaveBeenCalledTimes(1);
});

test("retries a Background Scrolling Test with the same input after a request never reaches the server", async () => {
	let records: unknown[] = [];
	mocks.list.mockImplementation(() => Promise.resolve(records));
	mocks.save
		.mockRejectedValueOnce(new TypeError("Failed to fetch"))
		.mockResolvedValue(undefined);
	mount();
	await prepare();
	fireEvent.click(screen.getByRole("button", { name: "Save scrolling test" }));
	const check = await screen.findByRole("button", {
		name: "Check current tests",
	});
	fireEvent.click(check);
	await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
	expect(screen.getByLabelText("Exact player version")).toBeDisabled();
	const [[input]] = mocks.save.mock.calls;
	fireEvent.click(
		screen.getByRole("button", { name: "Retry same scrolling test" })
	);
	await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(3));
	expect(mocks.save).toHaveBeenCalledTimes(2);
	expect(mocks.save.mock.calls[1][0]).toEqual(input);
	expect(screen.getByLabelText("Exact player version")).toBeDisabled();
	expect(screen.getByLabelText("Player visibility notes")).toHaveValue(
		"Observed during playback."
	);
	expect(screen.getByText("Actual playback: 10000 / 10000 ms")).toBeVisible();
	records = [
		{
			...input,
			layoutSnapshot: layout,
			playerPin: { assetRecordName: "Player", versionNumber: 1 },
			createdAt: "2026-10-12T00:00:00Z",
			outcome: "passed",
		},
	];
	fireEvent.click(check);
	await screen.findByText("Scrolling test saved.");
	expect(screen.getByLabelText("Exact player version")).toBeEnabled();
	expect(
		screen.queryByRole("button", { name: "Retry same scrolling test" })
	).not.toBeInTheDocument();
});

test.each([
	new TypeError("Failed to fetch"),
	Object.assign(new Error("Scrolling target changed."), {
		code: "CONFLICT",
		status: 409,
	}),
])(
	"keeps the pending Background Scrolling Test locked after a failed retry: %s",
	async (failure) => {
		mocks.list.mockResolvedValue([]);
		mocks.save
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockRejectedValueOnce(failure);
		mount();
		await prepare();
		fireEvent.click(
			screen.getByRole("button", { name: "Save scrolling test" })
		);
		const retry = await screen.findByRole("button", {
			name: "Retry same scrolling test",
		});
		fireEvent.click(retry);
		await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(retry).toBeEnabled());
		expect(mocks.save.mock.calls[1][0]).toEqual(mocks.save.mock.calls[0][0]);
		expect(screen.getByLabelText("Exact player version")).toBeDisabled();
		expect(screen.getByLabelText("Player visibility notes")).toHaveValue(
			"Observed during playback."
		);
		expect(
			screen.getByRole("button", { name: "Save scrolling test" })
		).toBeDisabled();
	}
);
