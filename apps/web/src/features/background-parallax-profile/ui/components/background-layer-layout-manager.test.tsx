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
	vi.resetAllMocks();
});

async function fillValidLayout() {
	await waitFor(() =>
		expect(screen.getByLabelText("Exact version")).toBeEnabled()
	);
	for (const [label, value] of [
		["Layer identity", "sky"],
		["Exact version", "sky-v1"],
		["Safe area X", "80"],
		["Safe area Y", "30"],
		["Safe area width", "160"],
		["Safe area height", "120"],
	]) {
		fireEvent.change(screen.getByLabelText(label), { target: { value } });
	}
}

test("keeps an uncertain layout locked after an empty read and retries the exact operation", async () => {
	let records: unknown[] = [];
	mocks.list.mockImplementation(() => Promise.resolve(records));
	mocks.save
		.mockRejectedValueOnce(new TypeError("Failed to fetch"))
		.mockImplementationOnce((input) => {
			records = [
				{
					...input,
					createdAt: "2026-10-11T00:00:00Z",
					versionPins: [
						{
							assetVersionId: "sky-v1",
							assetRecordName: "Sky",
							versionNumber: 1,
						},
					],
				},
			];
			return Promise.resolve(records[0]);
		});
	mount();
	await fillValidLayout();
	fireEvent.click(screen.getByRole("button", { name: "Save layer layout" }));
	fireEvent.click(
		await screen.findByRole("button", { name: "Check current layouts" })
	);
	await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
	expect(screen.getByLabelText("Layer identity")).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Save layer layout" })
	).toBeDisabled();
	fireEvent.click(screen.getByRole("button", { name: "Retry same layout" }));
	await screen.findByText("Layer layout saved.");
	expect(mocks.save).toHaveBeenCalledTimes(2);
	expect(mocks.save.mock.calls[1][0]).toEqual(mocks.save.mock.calls[0][0]);
	expect(screen.getByLabelText("Layer identity")).toBeEnabled();
});

test("only unlocks an uncertain layout when its own operation is read back", async () => {
	let records: unknown[] = [];
	mocks.list.mockImplementation(() => Promise.resolve(records));
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	mount();
	await fillValidLayout();
	fireEvent.click(screen.getByRole("button", { name: "Save layer layout" }));
	const check = await screen.findByRole("button", {
		name: "Check current layouts",
	});
	const [[pending]] = mocks.save.mock.calls;
	const saved = {
		...pending,
		createdAt: "2026-10-11T00:00:00Z",
		versionPins: [
			{ assetVersionId: "sky-v1", assetRecordName: "Sky", versionNumber: 1 },
		],
	};
	records = [{ ...saved, id: crypto.randomUUID() }];
	fireEvent.click(check);
	await screen.findByText("sky · Sky · v1");
	expect(screen.getByLabelText("Layer identity")).toBeDisabled();
	mocks.list.mockRejectedValueOnce(new Error("Read failed"));
	fireEvent.click(check);
	await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(3));
	expect(screen.getByLabelText("Layer identity")).toBeDisabled();
	records = [saved];
	fireEvent.click(check);
	await screen.findByText("Layer layout saved.");
	expect(screen.getByLabelText("Layer identity")).toBeEnabled();
	expect(mocks.save).toHaveBeenCalledTimes(1);
});

test("does not announce success or unlock when the post-save read fails", async () => {
	mocks.list
		.mockResolvedValueOnce([])
		.mockRejectedValueOnce(new Error("Read failed"));
	mocks.save.mockResolvedValue({});
	mount();
	await fillValidLayout();
	fireEvent.click(screen.getByRole("button", { name: "Save layer layout" }));
	await screen.findByRole("button", { name: "Check current layouts" });
	expect(screen.queryByText("Layer layout saved.")).not.toBeInTheDocument();
	expect(screen.getByLabelText("Layer identity")).toBeDisabled();
});
test("allows correcting a definitively rejected first save", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockRejectedValue(
		Object.assign(new Error("Invalid layout."), {
			code: "BAD_REQUEST",
			status: 400,
		})
	);
	mount();
	await fillValidLayout();
	fireEvent.click(screen.getByRole("button", { name: "Save layer layout" }));
	await screen.findByText("Invalid layout.");
	expect(screen.getByLabelText("Layer identity")).toBeEnabled();
	expect(
		screen.queryByRole("button", { name: "Check current layouts" })
	).not.toBeInTheDocument();
});

test("a rejected retry does not resolve the original uncertain write", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save
		.mockRejectedValueOnce(new TypeError("Failed to fetch"))
		.mockRejectedValueOnce(
			Object.assign(new Error("Contract changed."), {
				code: "CONFLICT",
				status: 409,
			})
		);
	mount();
	await fillValidLayout();
	fireEvent.click(screen.getByRole("button", { name: "Save layer layout" }));
	fireEvent.click(
		await screen.findByRole("button", { name: "Retry same layout" })
	);
	await screen.findByText("Contract changed.");
	expect(screen.getByLabelText("Layer identity")).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Check current layouts" })
	).toBeEnabled();
	expect(mocks.save.mock.calls[1][0]).toEqual(mocks.save.mock.calls[0][0]);
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
