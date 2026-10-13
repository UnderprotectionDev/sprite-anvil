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
import { UiStateComparisonManager } from "./ui-state-comparison-manager";

const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	client: { uiStateComparisons: { save: mocks.save } },
	orpc: {
		uiStateComparisons: {
			list: {
				queryOptions: () => ({
					queryKey: ["ui-state-comparisons"],
					queryFn: mocks.list,
				}),
			},
		},
	},
}));
const contract = getSpecializedProfileContract("ui");
if (!contract) {
	throw new Error("Missing UI contract");
}
const versions = ["screen", "button"].map((id) => ({
	id,
	assetFamilyId: "family",
	assetRecordId: id,
	contentDigest: "a".repeat(64),
	integrityVerified: true,
	contentLength: 100,
	contentType: "image/png" as const,
	versionNumber: 1,
	previewUrl: `/api/${id}`,
	sourceImageDimensions: { width: 64, height: 64 },
}));
function mount() {
	if (!contract) {
		throw new Error("Missing UI contract");
	}
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<UiStateComparisonManager
				activation={{
					contract,
					contractRevisionId: "ui@1",
					projectId: "project",
					activatedAt: "2026-10-13T00:00:00.000Z",
					activatedByUserId: "owner",
				}}
				assetFamilyId="family"
				assetRecords={versions.map((version) => ({
					id: version.id,
					name: version.id,
					assetCategory: "ui",
					availability: "active",
				}))}
				familyName="Inventory UI"
				projectId="project"
				units={[]}
				versions={versions}
			/>
		</QueryClientProvider>
	);
}
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
function fill() {
	fireEvent.change(screen.getByLabelText("Screen version"), {
		target: { value: "screen" },
	});
	fireEvent.change(screen.getByLabelText("Comparison name"), {
		target: { value: "Inventory controls" },
	});
	for (const select of screen.getAllByLabelText("Component version")) {
		fireEvent.change(select, { target: { value: "button" } });
	}
	for (const field of screen.getAllByLabelText("Component identity")) {
		fireEvent.change(field, { target: { value: "inventory-button" } });
	}
	fireEvent.change(screen.getByLabelText("Family style observations"), {
		target: { value: "Outline is consistent." },
	});
	fireEvent.change(screen.getByLabelText("State distinction observations"), {
		target: { value: "Hover is lighter." },
	});
}
test("compares screen and states, saves and reopens the persisted result", async () => {
	let records: unknown[] = [];
	mocks.list.mockImplementation(() => Promise.resolve(records));
	mocks.save.mockImplementation((input) => {
		const saved = {
			...input,
			createdAt: "2026-10-13T00:00:00.000Z",
			reviewedByUserId: "owner",
			contractSnapshot: contract,
			unitPins: [],
			versionPins: versions.map((v) => ({
				assetVersionId: v.id,
				assetRecordId: v.id,
				assetRecordName: v.id,
				contentDigest: v.contentDigest,
				contentLength: v.contentLength,
				contentType: v.contentType,
				versionNumber: 1,
				sourceImageDimensions: v.sourceImageDimensions,
			})),
		};
		records = [saved];
		return Promise.resolve(saved);
	});
	const view = mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save comparison" })
		).toBeEnabled()
	);
	fill();
	expect(screen.getAllByRole("option", { name: "Closed" })).toHaveLength(2);
	fireEvent.click(screen.getByRole("button", { name: "Save comparison" }));
	await screen.findByText("Comparison verified from persistent storage.");
	view.unmount();
	mount();
	expect(
		await screen.findByRole("heading", { name: "Inventory controls" })
	).toBeInTheDocument();
	expect(screen.getByText("Outline is consistent.")).toBeInTheDocument();
});
test("an uncertain save retains the same operation for checking and retry", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save comparison" })
		).toBeEnabled()
	);
	fill();
	fireEvent.click(screen.getByRole("button", { name: "Save comparison" }));
	await screen.findByRole("button", { name: "Check saved comparisons" });
	expect(
		screen.getByRole("button", { name: "Save comparison" })
	).toBeDisabled();
	fireEvent.click(
		screen.getByRole("button", { name: "Check saved comparisons" })
	);
	await screen.findByRole("button", { name: "Retry same comparison" });
	fireEvent.click(
		screen.getByRole("button", { name: "Retry same comparison" })
	);
	await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
	expect(mocks.save.mock.calls[1]?.[0]).toEqual(mocks.save.mock.calls[0]?.[0]);
});
