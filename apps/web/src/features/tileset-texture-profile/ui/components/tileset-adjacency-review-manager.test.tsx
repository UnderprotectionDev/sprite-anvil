// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import type {
	TilesetAdjacencyReviewInput,
	TilesetAdjacencyReviewRecord,
} from "@sprite-anvil/api/tileset-adjacency-reviews";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";

const openReviewPattern = /Open review/;
const seamPattern = /Visible corner seam/;

import { TilesetAdjacencyReviewManager } from "./tileset-adjacency-review-manager";

const api = vi.hoisted(() => ({ save: vi.fn(), records: [] as unknown[] }));
vi.mock("@/utils/orpc", () => ({
	client: { tilesetAdjacencyReviews: { save: api.save } },
	orpc: {
		tilesetAdjacencyReviews: {
			list: {
				queryOptions: () => ({
					queryKey: ["tileset-reviews"],
					initialData: api.records,
					queryFn: async () => api.records,
				}),
			},
		},
	},
}));
vi.mock("@/env", () => ({ ENV: { VITE_SERVER_URL: "http://localhost:3000" } }));
const props = {
	assetFamilyId: "family",
	familyName: "Forest tiles",
	projectId: "project",
	activation: {
		projectId: "project",
		contractRevisionId: "tiles@1",
		contract: specializedProfileContractCatalog.find(
			(item) => item.profileId === "tileset_terrain_texture"
		),
	},
	assetRecords: [
		{
			id: "record",
			assetFamilyId: "family",
			name: "Forest atlas",
			assetCategory: "tileset_terrain_texture",
			availability: "active",
		},
	],
	catalog: {
		assetVersions: [
			{
				id: "version",
				assetRecordId: "record",
				assetFamilyId: "family",
				sourceImageDimensions: { width: 16, height: 16 },
				previewUrl: "/tiles.png",
			},
		],
		unitVersions: [
			{
				id: "unit",
				unitKey: "grass",
				assetVersionId: "version",
				unitType: "tile",
			},
		],
		compositeVersions: [
			{
				id: "composite",
				assetRecordId: "record",
				versionNumber: 1,
				compositionMemberships: [{ unitVersionId: "unit", unitType: "tile" }],
			},
		],
		canonicalDesigns: [],
	},
} as unknown as ComponentProps<typeof TilesetAdjacencyReviewManager>;
async function openEditor() {
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<TilesetAdjacencyReviewManager {...props} />
		</QueryClientProvider>
	);
	fireEvent.change(screen.getByLabelText("Composite Version"), {
		target: { value: "composite" },
	});
	fireEvent.change(screen.getByLabelText("Terrain ID"), {
		target: { value: "grass" },
	});
	for (const edge of ["north", "east", "south", "west"]) {
		fireEvent.change(screen.getByLabelText(`${edge} connector`), {
			target: { value: "grass" },
		});
	}
	for (const image of document.querySelectorAll("img")) {
		Object.defineProperties(image, {
			naturalWidth: { value: 16, configurable: true },
			naturalHeight: { value: 16, configurable: true },
		});
		fireEvent.load(image);
	}
	for (let index = 0; index < 7; index += 1) {
		fireEvent.change(screen.getByLabelText("Scenario"), {
			target: { value: String(index) },
		});
		fireEvent.change(screen.getByLabelText("Scenario observations"), {
			target: { value: "Checked grass edges" },
		});
	}
	fireEvent.change(screen.getByLabelText("Scenario"), {
		target: { value: "0" },
	});
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save adjacency review" })
		).toBeEnabled()
	);
}
afterEach(() => {
	cleanup();
	api.records = [];
	api.save.mockReset();
});
test("paints and inspects a tile, persists exact map cells and restores the saved review", async () => {
	api.save.mockImplementation((input: TilesetAdjacencyReviewInput) => {
		const record = {
			...input,
			contractVersion: "tileset-adjacency-review/1.0.0",
			versionPins: [
				{
					unitVersionId: "unit",
					tileId: "grass",
					assetVersionId: "version",
					contentDigest: "a".repeat(64),
					sourceImageDimensions: { width: 16, height: 16 },
				},
			],
			adjacencyIssues: [],
			contractSnapshot: props.activation.contract,
			reviewedByUserId: "owner",
			createdAt: "2026-10-11T10:00:00.000Z",
		} satisfies TilesetAdjacencyReviewRecord;
		api.records = [record];
		return Promise.resolve(record);
	});
	await openEditor();
	fireEvent.change(screen.getByLabelText("Paint tile"), {
		target: { value: "" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Cell 1: grass" }));
	expect(
		screen.getByRole("button", { name: "Cell 1: Empty" })
	).toBeInTheDocument();
	fireEvent.change(screen.getByLabelText("Paint tile"), {
		target: { value: "unit" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Cell 1: Empty" }));
	fireEvent.click(screen.getByLabelText("Inspect without painting"));
	fireEvent.change(screen.getByLabelText("Tile or connection issue"), {
		target: { value: "Visible corner seam" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Record issue" }));
	fireEvent.click(
		screen.getByRole("button", { name: "Save adjacency review" })
	);
	await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
	expect(api.save.mock.calls[0]?.[0]).toMatchObject({
		compositeVersionId: "composite",
		maps: expect.arrayContaining([
			expect.objectContaining({
				scenario: "inner_corner",
				outcome: "failed",
				issues: [
					{ cellIndex: 0, neighborIndex: null, notes: "Visible corner seam" },
				],
			}),
		]),
	});
	await waitFor(() =>
		expect(
			screen.getByText("Tileset adjacency review saved.")
		).toBeInTheDocument()
	);
	const previousAtlasImage = document.querySelector("img");
	fireEvent.click(screen.getByRole("button", { name: openReviewPattern }));
	expect(screen.getByText(seamPattern)).toBeInTheDocument();
	const atlasImage = document.querySelector("img");
	expect(atlasImage).not.toBe(previousAtlasImage);
	if (!atlasImage) {
		throw new Error("Expected the reopened atlas preview");
	}
	Object.defineProperties(atlasImage, {
		naturalWidth: { value: 16, configurable: true },
		naturalHeight: { value: 16, configurable: true },
	});
	fireEvent.load(atlasImage);
	fireEvent.click(
		screen.getByRole("button", { name: "Save adjacency review" })
	);
	await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
}, 20_000);
test("keeps a failed validation editable and retries an uncertain save with the original operation", async () => {
	await openEditor();
	api.save.mockRejectedValueOnce({
		code: "BAD_REQUEST",
		message: "Atlas region invalid",
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Save adjacency review" })
	);
	await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
	await waitFor(() =>
		expect(screen.getByLabelText("Terrain ID")).toBeEnabled()
	);
	api.save.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	fireEvent.click(
		screen.getByRole("button", { name: "Save adjacency review" })
	);
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Retry same review" })
		).toBeInTheDocument()
	);
	expect(screen.getByLabelText("Terrain ID")).toBeDisabled();
	const pending = api.save.mock.calls[1]?.[0];
	api.save.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	fireEvent.click(screen.getByRole("button", { name: "Retry same review" }));
	await waitFor(() => expect(api.save).toHaveBeenCalledTimes(3));
	expect(api.save.mock.calls[2]?.[0]).toEqual(pending);
}, 20_000);
