// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
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
import { BackgroundLayerLayoutManager } from "./background-layer-layout-manager";

const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	client: { backgroundLayerLayouts: { save: mocks.save } },
	orpc: {
		backgroundLayerLayouts: {
			list: {
				queryOptions: () => ({ queryKey: ["layouts"], queryFn: mocks.list }),
			},
		},
	},
}));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
function getBackgroundContract() {
	const definition = specializedProfileContractCatalog.find(
		(entry) => entry.profileId === "background_parallax"
	);
	if (!definition) {
		throw new Error("Background contract missing");
	}
	return definition;
}
const contract = getBackgroundContract();
function mount() {
	return render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<BackgroundLayerLayoutManager
				activation={{
					projectId: "project",
					activatedByUserId: "user",
					contractRevisionId: "contract",
					contract,
					activatedAt: "2026-10-11T00:00:00Z",
				}}
				assetFamilyId="family"
				assetRecords={[
					{
						id: "sky",
						name: "Sky",
						assetCategory: "background_parallax",
						availability: "active",
					},
				]}
				familyName="Forest"
				projectId="project"
				versions={[
					{
						id: "sky-v1",
						assetRecordId: "sky",
						assetFamilyId: "family",
						versionNumber: 1,
						integrityVerified: true,
						contentDigest: "a".repeat(64),
						sourceImageDimensions: { width: 320, height: 180 },
						previewUrl: "/sky.png",
					},
				]}
				visualWorldId="world"
			/>
		</QueryClientProvider>
	);
}
test("saves a user-defined safe area and rereads the layout after remount", {
	timeout: 30_000,
}, async () => {
	let records: unknown[] = [];
	mocks.list.mockImplementation(() => Promise.resolve(records));
	mocks.save.mockImplementation((input) => {
		const record = {
			...input,
			createdAt: "2026-10-11T00:00:00Z",
			versionPins: [
				{ assetVersionId: "sky-v1", assetRecordName: "Sky", versionNumber: 1 },
			],
		};
		records = [record];
		return Promise.resolve(record);
	});
	const page = mount();
	await waitFor(() =>
		expect(screen.getByLabelText("Exact version")).toBeEnabled()
	);
	fireEvent.change(screen.getByLabelText("Layer identity"), {
		target: { value: "sky" },
	});
	fireEvent.change(screen.getByLabelText("Exact version"), {
		target: { value: "sky-v1" },
	});
	for (const [label, value] of [
		["Safe area X", "80"],
		["Safe area Y", "30"],
		["Safe area width", "160"],
		["Safe area height", "120"],
	]) {
		fireEvent.change(screen.getByLabelText(label), { target: { value } });
	}
	fireEvent.click(screen.getByRole("button", { name: "Save layer layout" }));
	await screen.findByText("Layer layout saved.");
	expect(mocks.save.mock.calls[0][0]).toMatchObject({
		visualWorldId: "world",
		layers: [
			{
				id: "sky",
				assetVersionId: "sky-v1",
				naturalSize: { width: 320, height: 180 },
				safeArea: { x: 80, y: 30, width: 160, height: 120 },
			},
		],
	});
	page.unmount();
	mount();
	await screen.findByText("sky · Sky · v1");
	expect(
		screen.getByText("Actual scrolling test is still required.")
	).toBeInTheDocument();
});
test("rejects a safe area outside the crop before saving", async () => {
	mocks.list.mockResolvedValue([]);
	mount();
	await waitFor(() =>
		expect(screen.getByLabelText("Exact version")).toBeEnabled()
	);
	fireEvent.change(screen.getByLabelText("Layer identity"), {
		target: { value: "sky" },
	});
	fireEvent.change(screen.getByLabelText("Exact version"), {
		target: { value: "sky-v1" },
	});
	for (const [label, value] of [
		["Safe area X", "300"],
		["Safe area Y", "0"],
		["Safe area width", "100"],
		["Safe area height", "10"],
	]) {
		fireEvent.change(screen.getByLabelText(label), { target: { value } });
	}
	fireEvent.click(screen.getByRole("button", { name: "Save layer layout" }));
	await waitFor(() =>
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Player safe area must remain inside the crop."
		)
	);
	expect(mocks.save).not.toHaveBeenCalled();
});
