// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { UiStretchTestManager } from "./ui-stretch-test-manager";

const retrySame = /retry same/i;
const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	client: { uiStretchTests: { save: mocks.save } },
	orpc: {
		uiStretchTests: {
			list: {
				queryOptions: () => ({
					queryKey: ["ui-stretch-tests"],
					queryFn: mocks.list,
				}),
			},
		},
	},
}));
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
function mount() {
	const contract = getSpecializedProfileContract("ui");
	if (!contract) {
		throw new Error("Missing UI contract");
	}
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<UiStretchTestManager
				activation={{
					projectId: "project",
					contractRevisionId: "ui@1.0.0",
					contract,
					activatedAt: "2026-10-13T00:00:00Z",
					activatedByUserId: "owner",
				}}
				assetFamilyId="family"
				assetRecords={[
					{
						id: "record",
						name: "Normal panel",
						assetCategory: "ui",
						availability: "active",
					},
				]}
				familyName="Panels"
				projectId="project"
				versions={[
					{
						id: "version",
						assetRecordId: "record",
						assetFamilyId: "family",
						versionNumber: 1,
						integrityVerified: true,
						contentDigest: "a".repeat(64),
						sourceImageDimensions: { width: 32, height: 24 },
						previewUrl: "/panel.png",
					},
				]}
				visualWorldId="world"
			/>
		</QueryClientProvider>
	);
}
async function fill() {
	await waitFor(() =>
		expect(screen.getByLabelText("Exact version")).toBeEnabled()
	);
	for (const [label, value] of [
		["Component identity", "panel"],
		["State identity", "normal"],
		["Exact version", "version"],
		["Left margin", "4"],
		["Right margin", "6"],
		["Top margin", "3"],
		["Bottom margin", "5"],
		["Text area X", "6"],
		["Text area Y", "5"],
		["Text area width", "18"],
		["Text area height", "12"],
		["Target width", "64"],
		["Target height", "40"],
	]) {
		fireEvent.change(screen.getByLabelText(label ?? ""), { target: { value } });
	}
}
test("an uncertain write stays locked after an empty read without offering another save", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	mount();
	await fill();
	fireEvent.click(screen.getByRole("button", { name: "Save stretch test" }));
	const check = await screen.findByRole("button", {
		name: "Check current tests",
	});
	fireEvent.click(check);
	await screen.findByText(
		"The pending test is not visible yet. Check current tests again."
	);
	expect(
		screen.getByRole("button", { name: "Save stretch test" })
	).toBeDisabled();
	expect(screen.getByLabelText("Component identity")).toBeDisabled();
	expect(
		screen.queryByRole("button", { name: retrySame })
	).not.toBeInTheDocument();
	expect(mocks.save).toHaveBeenCalledTimes(1);
});
test("a failed read offers a working Retry and blocks writes until data loads", async () => {
	mocks.list
		.mockRejectedValueOnce(new Error("Cannot read tests"))
		.mockResolvedValue([]);
	mount();
	const retry = await screen.findByRole("button", { name: "Retry" });
	expect(screen.getByLabelText("Exact version")).toBeDisabled();
	fireEvent.click(retry);
	await waitFor(() =>
		expect(screen.getByLabelText("Exact version")).toBeEnabled()
	);
});
