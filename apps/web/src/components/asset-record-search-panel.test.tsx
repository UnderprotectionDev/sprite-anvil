// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AssetRecordSearchPanel } from "@/components/asset-record-search-panel";
import { createQueryClient } from "@/utils/query-client";

const projectId = "project-discovery";
const gameplayWorldId = "world-gameplay";
const marketingWorldId = "world-marketing";
const pairedSizeMessage =
	"Enter both width and height to search by dimensions.";
const sizeRangeMessage =
	"Width and height must be integers from 1 to 100,000 px.";

const fakeApi = vi.hoisted(() => ({
	scopes: {
		themes: [] as {
			id: string;
			name: string;
			projectId: string;
			visualWorldId: string;
		}[],
		visualWorlds: [] as { id: string; name: string; projectId: string }[],
	},
	search: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { dismiss: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/orpc", () => ({
	orpc: {
		assetRecords: {
			search: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["asset-record-search", input],
					queryFn: () => fakeApi.search(input),
				}),
			},
		},
		contextScopes: {
			list: {
				queryOptions: () => ({
					queryKey: ["scope-catalog", projectId],
					queryFn: async () => fakeApi.scopes,
				}),
			},
		},
	},
}));

beforeEach(() => {
	fakeApi.scopes = {
		visualWorlds: [
			{ id: gameplayWorldId, name: "Gameplay", projectId },
			{ id: marketingWorldId, name: "Marketing", projectId },
		],
		themes: [
			{
				id: "theme-castle",
				name: "Dark Castle",
				projectId,
				visualWorldId: gameplayWorldId,
			},
			{
				id: "theme-poster",
				name: "Launch Poster",
				projectId,
				visualWorldId: marketingWorldId,
			},
		],
	};
	fakeApi.search
		.mockReset()
		.mockImplementation(() => Promise.resolve({ records: [], totalCount: 0 }));
});

afterEach(() => {
	cleanup();
});

function renderPanel() {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<AssetRecordSearchPanel onOpenRecord={vi.fn()} projectId={projectId} />
		</QueryClientProvider>
	);
}

async function waitForIdleSearch() {
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Search Asset Records" })
		).toBeEnabled()
	);
}

function searchButton() {
	return screen.getByRole("button", { name: "Search Asset Records" });
}

test("searches the whole project on open and only re-queries on submit", async () => {
	renderPanel();
	await waitForIdleSearch();
	expect(fakeApi.search).toHaveBeenCalledExactlyOnceWith({
		projectId,
		pagination: { limit: 50, offset: 0 },
	});
	expect(
		await screen.findByText("This project has no Asset Records yet.")
	).toBeVisible();

	fireEvent.change(screen.getByLabelText("Search by name"), {
		target: { value: "  Ash  " },
	});
	fireEvent.change(screen.getByLabelText("Asset category"), {
		target: { value: "icon" },
	});
	fireEvent.change(screen.getByLabelText("Tag"), {
		target: { value: "   " },
	});
	fireEvent.change(screen.getByLabelText("Record status"), {
		target: { value: "archived" },
	});
	await waitForIdleSearch();
	expect(fakeApi.search).toHaveBeenCalledOnce();

	fireEvent.click(searchButton());
	await waitFor(() => expect(fakeApi.search).toHaveBeenCalledTimes(2));
	expect(fakeApi.search).toHaveBeenLastCalledWith({
		pagination: { limit: 50, offset: 0 },
		assetCategory: "icon",
		availability: "archived",
		name: "Ash",
		projectId,
	});
	expect(
		await screen.findByText("No Asset Records match the search criteria.")
	).toBeVisible();
});

test("lists the filter options and keeps the control attributes", async () => {
	renderPanel();
	await waitForIdleSearch();
	const category = screen.getByLabelText("Asset category");
	expect(category).toHaveValue("");
	expect(
		within(category).getByRole("option", { name: "All categories" })
	).toBeInTheDocument();
	const availability = screen.getByLabelText("Record status");
	expect(
		within(availability)
			.getAllByRole("option")
			.map((option) => option.textContent)
	).toEqual(["All statuses", "Active", "Archived", "Erased"]);
	expect(screen.getByLabelText("Search by name")).toHaveAttribute(
		"maxLength",
		"120"
	);
	expect(screen.getByLabelText("Tag")).toHaveAttribute("maxLength", "40");
	const width = screen.getByLabelText("Source image width (px)");
	expect(width).toHaveAttribute("type", "number");
	expect(width).toHaveAttribute("min", "1");
	expect(width).toHaveAttribute("max", "100000");
	expect(width).toHaveAttribute("step", "1");
});

test("narrows Themes to the chosen Visual World and clears the Theme on change", async () => {
	renderPanel();
	await screen.findByRole("option", { name: "Gameplay" });
	const theme = screen.getByLabelText("Theme");
	expect(
		within(theme)
			.getAllByRole("option")
			.map((option) => option.textContent)
	).toEqual(["All Themes", "Dark Castle", "Launch Poster"]);

	fireEvent.change(screen.getByLabelText("Visual World"), {
		target: { value: gameplayWorldId },
	});
	expect(
		within(theme)
			.getAllByRole("option")
			.map((option) => option.textContent)
	).toEqual(["All Themes", "Dark Castle"]);
	fireEvent.change(theme, { target: { value: "theme-castle" } });
	expect(theme).toHaveValue("theme-castle");

	fireEvent.change(screen.getByLabelText("Visual World"), {
		target: { value: marketingWorldId },
	});
	expect(theme).toHaveValue("");
	await waitForIdleSearch();
	fireEvent.click(searchButton());
	await waitFor(() =>
		expect(fakeApi.search).toHaveBeenLastCalledWith({
			pagination: { limit: 50, offset: 0 },
			projectId,
			visualWorldId: marketingWorldId,
		})
	);
});

test("requires width and height together and clears the message on edit", async () => {
	renderPanel();
	await waitForIdleSearch();
	fireEvent.change(screen.getByLabelText("Source image width (px)"), {
		target: { value: "32" },
	});
	fireEvent.click(searchButton());
	expect(await screen.findByRole("alert")).toHaveTextContent(pairedSizeMessage);
	expect(fakeApi.search).toHaveBeenCalledOnce();

	fireEvent.change(screen.getByLabelText("Search by name"), {
		target: { value: "A" },
	});
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();

	fireEvent.change(screen.getByLabelText("Source image height (px)"), {
		target: { value: "48" },
	});
	fireEvent.click(searchButton());
	await waitFor(() =>
		expect(fakeApi.search).toHaveBeenLastCalledWith({
			pagination: { limit: 50, offset: 0 },
			name: "A",
			projectId,
			sourceImageHeight: 48,
			sourceImageWidth: 32,
		})
	);
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test.each([
	["0", "48"],
	["32", "100001"],
	["1.5", "48"],
])("rejects a source image size of %s × %s", async (width, height) => {
	renderPanel();
	await waitForIdleSearch();
	fireEvent.change(screen.getByLabelText("Source image width (px)"), {
		target: { value: width },
	});
	fireEvent.change(screen.getByLabelText("Source image height (px)"), {
		target: { value: height },
	});
	// Native number constraints block a button submit first; submit the form
	// directly to pin the panel's own range message.
	fireEvent.submit(searchButton().closest("form") as HTMLFormElement);
	expect(await screen.findByRole("alert")).toHaveTextContent(sizeRangeMessage);
	expect(fakeApi.search).toHaveBeenCalledOnce();
});

const longRecordPattern = /Record \d+ open record/u;

test("bounds a long result list and opens a visible record", async () => {
	const onOpenRecord = vi.fn();
	fakeApi.search.mockResolvedValue({
		records: Array.from({ length: 500 }, (_, index) => ({
			record: {
				id: `record-${index}`,
				name: `Record ${index}`,
				availability: "active",
				identityCriteria: [],
			},
			matchingVersions: [],
		})),
		totalCount: 500,
	});
	const queryClient = createQueryClient();
	render(
		<QueryClientProvider client={queryClient}>
			<AssetRecordSearchPanel
				onOpenRecord={onOpenRecord}
				projectId={projectId}
			/>
		</QueryClientProvider>
	);
	const button = await screen.findByRole("button", {
		name: "Record 0 open record",
	});
	expect(
		screen.getAllByRole("button", { name: longRecordPattern }).length
	).toBeLessThan(100);
	fireEvent.click(button);
	expect(onOpenRecord).toHaveBeenCalledWith("record-0");
});

test("requests the next bounded page and resets to the first page when filters change", async () => {
	fakeApi.search.mockImplementation(
		({ pagination }: { pagination: { offset: number } }) =>
			Promise.resolve({
				records: [
					{
						record: {
							id: `record-${pagination.offset}`,
							name: `Record ${pagination.offset}`,
							availability: "active",
							identityCriteria: [],
						},
						matchingVersions: [],
					},
				],
				totalCount: 60,
				nextOffset: pagination.offset === 0 ? 50 : null,
			})
	);
	renderPanel();
	await screen.findByRole("button", { name: "Record 0 open record" });
	fireEvent.click(screen.getByRole("button", { name: "Next" }));
	await screen.findByRole("button", { name: "Record 50 open record" });
	expect(fakeApi.search).toHaveBeenLastCalledWith({
		projectId,
		pagination: { limit: 50, offset: 50 },
	});
	fireEvent.change(screen.getByLabelText("Search by name"), {
		target: { value: "Knight" },
	});
	fireEvent.click(searchButton());
	await waitFor(() =>
		expect(fakeApi.search).toHaveBeenLastCalledWith({
			projectId,
			name: "Knight",
			pagination: { limit: 50, offset: 0 },
		})
	);
});
