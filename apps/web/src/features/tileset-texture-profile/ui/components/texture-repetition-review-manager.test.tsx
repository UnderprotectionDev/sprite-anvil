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
import { useEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { TextureRepetitionReviewManager } from "./texture-repetition-review-manager";

const mocks = vi.hoisted(() => ({
	list: vi.fn(),
	save: vi.fn(),
	inspect: vi.fn(),
}));
vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	const client = {
		textureRepetitionReviews: {
			list: mocks.list,
			save: mocks.save,
			inspect: mocks.inspect,
		},
	};
	return { client, orpc: createTanstackQueryUtils(client) };
});
vi.mock("./texture-repeat-preview", () => ({
	TextureRepeatPreview: ({
		arrangement,
		onStatus,
		statusKey,
	}: {
		arrangement: string;
		onStatus: (key: string, ready: boolean) => void;
		statusKey: string;
	}) => {
		useEffect(() => {
			onStatus(statusKey, true);
		}, [onStatus, statusKey]);
		return <div>{arrangement} preview</div>;
	},
}));
const mismatchPattern = /mismatched pixels/;
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
const contract = specializedProfileContractCatalog.find(
	(item) => item.profileId === "tileset_terrain_texture"
);
function show(initiallyEmpty = false, legacyDimensions = false) {
	if (!contract) {
		throw new Error("Missing contract");
	}
	const props = {
		projectId: "project",
		assetFamilyId: "family",
		familyName: "Grass",
		activation: {
			projectId: "project",
			profileId: "tileset_terrain_texture" as const,
			contractRevisionId: "texture@1",
			contract,
			activatedByUserId: "owner",
			activatedAt: "2026-10-11T00:00:00.000Z",
		},
		units: [
			{
				id: "unit",
				projectId: "project",
				assetRecordId: "record",
				assetVersionId: "version",
				sourceAssetVersionId: "source",
				unitType: "tile" as const,
				unitKey: "grass",
				versionNumber: 1,
				createdAt: "2026-10-11T00:00:00.000Z",
			},
		],
		versions: [
			{
				id: "version",
				assetRecordId: "record",
				assetFamilyId: "family",
				previewUrl: "/image",
				sourceImageDimensions: legacyDimensions
					? null
					: { width: 2, height: 2 },
				integrityVerified: true,
			},
		],
		records: [
			{
				id: "record",
				name: "Grass texture",
				assetCategory: "tileset_terrain_texture",
				availability: "active",
			},
		],
	};
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	function content(empty: boolean) {
		return (
			<QueryClientProvider client={client}>
				<TextureRepetitionReviewManager
					{...props}
					units={empty ? [] : props.units}
				/>
			</QueryClientProvider>
		);
	}
	const view = render(content(initiallyEmpty));
	return { ...view, loadUnits: () => view.rerender(content(false)) };
}
test("shows each preview and records human outcomes separately from exact edge results", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.inspect.mockResolvedValue({
		x: { mismatchCount: 0, firstMismatch: null },
		y: { mismatchCount: 0, firstMismatch: null },
	});
	mocks.save.mockImplementation(async (input) => ({
		...input,
		unitSnapshot: { id: "unit", unitKey: "grass" },
		edgeCheck: { x: { mismatchCount: 0 }, y: { mismatchCount: 0 } },
		createdAt: "2026-10-11T00:00:00.000Z",
	}));
	show();
	expect(screen.getByText("2x2 preview")).toBeInTheDocument();
	expect(screen.getByText("3x3 preview")).toBeInTheDocument();
	expect(screen.getByText("shifted preview")).toBeInTheDocument();
	for (const label of ["2x2", "3x3", "shifted"]) {
		fireEvent.change(screen.getByLabelText(`${label} outcome`), {
			target: { value: "needs_follow_up" },
		});
		fireEvent.change(screen.getByLabelText(`${label} notes`), {
			target: { value: "Bright motif needs attention." },
		});
	}
	fireEvent.click(screen.getByRole("button", { name: "Save texture review" }));
	await waitFor(() =>
		expect(screen.getByText("Texture review saved.")).toBeInTheDocument()
	);
	expect(mocks.save.mock.calls[0][0]).toMatchObject({
		unitVersionId: "unit",
		atlasRegion: { x: 0, y: 0, width: 2, height: 2 },
		repeatAxes: ["x", "y"],
		observations: [
			{ arrangement: "2x2", outcome: "needs_follow_up" },
			{ arrangement: "3x3", outcome: "needs_follow_up" },
			{ arrangement: "shifted", outcome: "needs_follow_up" },
		],
	});
});

function observeAll() {
	for (const label of ["2x2", "3x3", "shifted"]) {
		fireEvent.change(screen.getByLabelText(`${label} outcome`), {
			target: { value: "passed" },
		});
		fireEvent.change(screen.getByLabelText(`${label} notes`), {
			target: { value: "No visible seams." },
		});
	}
}

test("retries an uncertain save with the same immutable operation after checking current reviews", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	mocks.save.mockImplementationOnce(async (input) => ({
		...input,
		unitSnapshot: { id: "unit", unitKey: "grass" },
		edgeCheck: {
			x: { mismatchCount: 0, firstMismatch: null },
			y: { mismatchCount: 0, firstMismatch: null },
		},
		createdAt: "2026-10-11T00:00:00.000Z",
	}));
	show();
	observeAll();
	fireEvent.click(screen.getByRole("button", { name: "Save texture review" }));
	await screen.findByRole("button", { name: "Check current texture reviews" });
	expect(
		screen.getByRole("button", { name: "Save texture review" })
	).toBeDisabled();
	fireEvent.click(
		screen.getByRole("button", { name: "Check current texture reviews" })
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Retry same texture review" })
	);
	await screen.findByText("Texture review saved.");
	expect(mocks.save).toHaveBeenCalledTimes(2);
	expect(mocks.save.mock.calls[1][0]).toEqual(mocks.save.mock.calls[0][0]);
});

test("clears only the shifted observation when its offset changes and all observations when atlas changes", () => {
	mocks.list.mockResolvedValue([]);
	show();
	observeAll();
	fireEvent.change(screen.getByLabelText("Shift X"), {
		target: { value: "0" },
	});
	expect(screen.getByLabelText("shifted outcome")).toHaveValue("");
	expect(screen.getByLabelText("shifted notes")).toHaveValue("");
	expect(screen.getByLabelText("2x2 outcome")).toHaveValue("passed");
	fireEvent.change(screen.getByLabelText("Atlas width"), {
		target: { value: "1" },
	});
	for (const label of ["2x2", "3x3", "shifted"]) {
		expect(screen.getByLabelText(`${label} outcome`)).toHaveValue("");
		expect(screen.getByLabelText(`${label} notes`)).toHaveValue("");
	}
});

test("selects the newly available texture after the first Unit Version is created", async () => {
	mocks.list.mockResolvedValue([]);
	const view = show(true);
	expect(
		screen.getByText(
			"Create a tile Unit Version for a texture Asset Record in this family to review repetition."
		)
	).toBeInTheDocument();
	view.loadUnits();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save texture review" })
		).toBeEnabled()
	);
	expect(screen.getByLabelText("Texture unit")).toHaveValue("unit");
});

test("keeps an intact texture reviewable when its older upload has no stored dimensions", async () => {
	mocks.list.mockResolvedValue([]);
	show(false, true);
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save texture review" })
		).toBeEnabled()
	);
	expect(screen.getByLabelText("Texture unit")).toHaveValue("unit");
});

test("checks exact edges against the server every time and shows the result", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.inspect.mockResolvedValue({
		x: { mismatchCount: 3, firstMismatch: 1 },
		y: null,
	});
	show();
	fireEvent.click(screen.getByRole("button", { name: "Check exact edges" }));
	await screen.findByText("X edge: 3 mismatched pixels; first at 1 px");
	expect(screen.getByText("Y edge: not repeated")).toBeInTheDocument();
	expect(mocks.inspect.mock.calls[0][0]).toMatchObject({
		projectId: "project",
		assetFamilyId: "family",
		unitVersionId: "unit",
		repeatAxes: ["x", "y"],
	});
	fireEvent.click(screen.getByRole("button", { name: "Check exact edges" }));
	await waitFor(() => expect(mocks.inspect).toHaveBeenCalledTimes(2));
});

test("shows an error and no edge result when the edge check fails", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.inspect.mockRejectedValue(new Error("edge boom"));
	show();
	fireEvent.click(screen.getByRole("button", { name: "Check exact edges" }));
	const alert = await screen.findByRole("alert");
	expect(alert.textContent).not.toBe("");
	expect(screen.queryByText(mismatchPattern)).not.toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Save texture review" })
	).toBeEnabled();
});

test("disables the form while saving, then shows the refreshed list", async () => {
	let resolveSave: (value: unknown) => void = () => undefined;
	const record = (input: Record<string, unknown>) => ({
		...input,
		unitSnapshot: { id: "unit", unitKey: "grass" },
		edgeCheck: {
			x: { mismatchCount: 0, firstMismatch: null },
			y: { mismatchCount: 0, firstMismatch: null },
		},
		createdAt: "2026-10-11T00:00:00.000Z",
	});
	mocks.list.mockResolvedValueOnce([]);
	mocks.save.mockImplementation(
		(input) =>
			new Promise((resolve) => {
				resolveSave = () => resolve(record(input));
			})
	);
	show();
	observeAll();
	await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
	fireEvent.click(screen.getByRole("button", { name: "Save texture review" }));
	expect(
		await screen.findByRole("button", { name: "Saving texture review…" })
	).toBeInTheDocument();
	expect(screen.getByLabelText("2x2 outcome")).toBeDisabled();
	mocks.list.mockImplementation(async () => [
		record(mocks.save.mock.calls[0][0]),
	]);
	resolveSave(null);
	await screen.findByText("Texture review saved.");
	await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save texture review" })
		).toBeEnabled()
	);
});

test("keeps the draft and shows the rejection when a save is rejected", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockRejectedValue(new Error("rejected by server"));
	show();
	observeAll();
	fireEvent.click(screen.getByRole("button", { name: "Save texture review" }));
	await screen.findByRole("alert");
	expect(screen.queryByText("Texture review saved.")).not.toBeInTheDocument();
	expect(
		screen.queryByRole("button", { name: "Check current texture reviews" })
	).not.toBeInTheDocument();
	expect(screen.getByLabelText("2x2 outcome")).toHaveValue("passed");
	expect(
		screen.getByRole("button", { name: "Save texture review" })
	).toBeEnabled();
});
