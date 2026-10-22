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
import { createQueryClient } from "@/utils/query-client";
import { AssetRecordSearchPanel } from "./asset-record-search-panel";

const projectId = "project-discovery";
const gameplayWorldId = "world-gameplay";
const marketingWorldId = "world-marketing";
const pairedSizeMessage =
	"Ölçü aramak için genişlik ve yüksekliği birlikte girin.";
const sizeRangeMessage =
	"Genişlik ve yükseklik 1–100.000 px arasında tam sayı olmalı.";

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
			screen.getByRole("button", { name: "Varlık kayıtlarını ara" })
		).toBeEnabled()
	);
}

function searchButton() {
	return screen.getByRole("button", { name: "Varlık kayıtlarını ara" });
}

test("searches the whole project on open and only re-queries on submit", async () => {
	renderPanel();
	await waitForIdleSearch();
	expect(fakeApi.search).toHaveBeenCalledExactlyOnceWith({ projectId });
	expect(
		await screen.findByText("Bu projede henüz varlık kaydı yok.")
	).toBeVisible();

	fireEvent.change(screen.getByLabelText("Ada göre ara"), {
		target: { value: "  Ash  " },
	});
	fireEvent.change(screen.getByLabelText("Varlık kategorisi"), {
		target: { value: "icon" },
	});
	fireEvent.change(screen.getByLabelText("Etiket"), {
		target: { value: "   " },
	});
	fireEvent.change(screen.getByLabelText("Kayıt durumu"), {
		target: { value: "archived" },
	});
	await waitForIdleSearch();
	expect(fakeApi.search).toHaveBeenCalledOnce();

	fireEvent.click(searchButton());
	await waitFor(() => expect(fakeApi.search).toHaveBeenCalledTimes(2));
	expect(fakeApi.search).toHaveBeenLastCalledWith({
		assetCategory: "icon",
		availability: "archived",
		name: "Ash",
		projectId,
	});
	expect(
		await screen.findByText("Arama ölçütleriyle eşleşen varlık kaydı yok.")
	).toBeVisible();
});

test("lists the filter options and keeps the control attributes", async () => {
	renderPanel();
	await waitForIdleSearch();
	const category = screen.getByLabelText("Varlık kategorisi");
	expect(category).toHaveValue("");
	expect(
		within(category).getByRole("option", { name: "Tüm kategoriler" })
	).toBeInTheDocument();
	const availability = screen.getByLabelText("Kayıt durumu");
	expect(
		within(availability)
			.getAllByRole("option")
			.map((option) => option.textContent)
	).toEqual(["Tüm durumlar", "Etkin", "Arşivlenmiş", "Silinmiş"]);
	expect(screen.getByLabelText("Ada göre ara")).toHaveAttribute(
		"maxLength",
		"120"
	);
	expect(screen.getByLabelText("Etiket")).toHaveAttribute("maxLength", "40");
	const width = screen.getByLabelText("Kaynak Görsel genişliği (px)");
	expect(width).toHaveAttribute("type", "number");
	expect(width).toHaveAttribute("min", "1");
	expect(width).toHaveAttribute("max", "100000");
	expect(width).toHaveAttribute("step", "1");
});

test("narrows Themes to the chosen Visual World and clears the Theme on change", async () => {
	renderPanel();
	await screen.findByRole("option", { name: "Gameplay" });
	const theme = screen.getByLabelText("Tema");
	expect(
		within(theme)
			.getAllByRole("option")
			.map((option) => option.textContent)
	).toEqual(["Tüm Temalar", "Dark Castle", "Launch Poster"]);

	fireEvent.change(screen.getByLabelText("Görsel Dünya"), {
		target: { value: gameplayWorldId },
	});
	expect(
		within(theme)
			.getAllByRole("option")
			.map((option) => option.textContent)
	).toEqual(["Tüm Temalar", "Dark Castle"]);
	fireEvent.change(theme, { target: { value: "theme-castle" } });
	expect(theme).toHaveValue("theme-castle");

	fireEvent.change(screen.getByLabelText("Görsel Dünya"), {
		target: { value: marketingWorldId },
	});
	expect(theme).toHaveValue("");
	await waitForIdleSearch();
	fireEvent.click(searchButton());
	await waitFor(() =>
		expect(fakeApi.search).toHaveBeenLastCalledWith({
			projectId,
			visualWorldId: marketingWorldId,
		})
	);
});

test("requires width and height together and clears the message on edit", async () => {
	renderPanel();
	await waitForIdleSearch();
	fireEvent.change(screen.getByLabelText("Kaynak Görsel genişliği (px)"), {
		target: { value: "32" },
	});
	fireEvent.click(searchButton());
	expect(await screen.findByRole("alert")).toHaveTextContent(pairedSizeMessage);
	expect(fakeApi.search).toHaveBeenCalledOnce();

	fireEvent.change(screen.getByLabelText("Ada göre ara"), {
		target: { value: "A" },
	});
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();

	fireEvent.change(screen.getByLabelText("Kaynak Görsel yüksekliği (px)"), {
		target: { value: "48" },
	});
	fireEvent.click(searchButton());
	await waitFor(() =>
		expect(fakeApi.search).toHaveBeenLastCalledWith({
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
	fireEvent.change(screen.getByLabelText("Kaynak Görsel genişliği (px)"), {
		target: { value: width },
	});
	fireEvent.change(screen.getByLabelText("Kaynak Görsel yüksekliği (px)"), {
		target: { value: height },
	});
	// Native number constraints block a button submit first; submit the form
	// directly to pin the panel's own range message.
	fireEvent.submit(searchButton().closest("form") as HTMLFormElement);
	expect(await screen.findByRole("alert")).toHaveTextContent(sizeRangeMessage);
	expect(fakeApi.search).toHaveBeenCalledOnce();
});
