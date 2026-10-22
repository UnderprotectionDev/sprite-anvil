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
const mocks = vi.hoisted(() => ({
	exportTest: vi.fn(),
	list: vi.fn(),
	save: vi.fn(),
}));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		uiStretchTests: {
			list: {
				queryKey: () => ["ui-stretch-tests"],
				queryOptions: () => ({
					queryKey: ["ui-stretch-tests"],
					queryFn: mocks.list,
				}),
			},
			export: {
				mutationOptions: () => ({
					mutationFn: (input: unknown) => mocks.exportTest(input),
				}),
			},
			save: {
				mutationOptions: () => ({
					mutationFn: (input: unknown) => mocks.save(input),
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
test("shows every issue of the first invalid state without saving", async () => {
	mocks.list.mockResolvedValue([]);
	mount();
	await fill();
	fireEvent.change(screen.getByLabelText("Left margin"), {
		target: { value: "20" },
	});
	fireEvent.change(screen.getByLabelText("Right margin"), {
		target: { value: "20" },
	});
	fireEvent.change(screen.getByLabelText("Text area width"), {
		target: { value: "40" },
	});
	expect(screen.queryByLabelText("Observation")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Save stretch test" }));
	expect(
		await screen.findByText(
			"Stretch margins must leave a positive source center. Text safe area must fit inside the source image."
		)
	).toHaveAttribute("role", "alert");
	expect(mocks.save).not.toHaveBeenCalled();
});
test("shows configuration issues once every state is valid", async () => {
	mocks.list.mockResolvedValue([]);
	mount();
	await fill();
	fireEvent.click(screen.getByRole("button", { name: "Add state" }));
	const second = (label: string) =>
		screen.getAllByLabelText(label)[1] as HTMLElement;
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
	] as const) {
		fireEvent.change(second(label), { target: { value } });
	}
	fireEvent.click(screen.getByRole("button", { name: "Save stretch test" }));
	expect(
		await screen.findByText("Component and state identities must be unique.")
	).toHaveAttribute("role", "alert");
	expect(mocks.save).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Remove state 2" }));
	expect(screen.getByRole("button", { name: "Remove state 1" })).toBeDisabled();
});
test("saves the configuration with only the written observations", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	mount();
	await fill();
	fireEvent.change(screen.getByLabelText("Screen version (optional)"), {
		target: { value: "version" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Add target" }));
	fireEvent.change(screen.getAllByLabelText("Target width")[1] as HTMLElement, {
		target: { value: "48" },
	});
	fireEvent.change(
		screen.getAllByLabelText("Target height")[1] as HTMLElement,
		{ target: { value: "30" } }
	);
	fireEvent.change(screen.getByLabelText("Sample text"), {
		target: { value: "  Potion  " },
	});
	const results = screen.getAllByLabelText("Test result");
	const notes = screen.getAllByLabelText("Observation");
	expect(results).toHaveLength(2);
	expect(results[0]).toHaveValue("inconclusive");
	fireEvent.change(results[0] as HTMLElement, { target: { value: "failed" } });
	fireEvent.change(notes[0] as HTMLElement, {
		target: { value: "Text overflows." },
	});
	fireEvent.change(results[1] as HTMLElement, { target: { value: "passed" } });
	fireEvent.change(notes[1] as HTMLElement, { target: { value: "   " } });
	fireEvent.click(screen.getByRole("button", { name: "Save stretch test" }));
	await screen.findByRole("button", { name: "Check current tests" });
	expect(mocks.save).toHaveBeenCalledTimes(1);
	expect(mocks.save.mock.calls[0]?.[0]).toEqual({
		id: expect.any(String),
		projectId: "project",
		assetFamilyId: "family",
		visualWorldId: "world",
		contractRevisionId: "ui@1.0.0",
		screen: { assetRecordId: "record", assetVersionId: "version" },
		states: [
			{
				componentId: "panel",
				stateId: "normal",
				assetVersionId: "version",
				assetRecordId: "record",
				naturalSize: { width: 32, height: 24 },
				stretchMargins: { left: 4, right: 6, top: 3, bottom: 5 },
				textSafeArea: { x: 6, y: 5, width: 18, height: 12 },
			},
		],
		targets: [
			{ width: 64, height: 40 },
			{ width: 48, height: 30 },
		],
		observations: [
			{
				componentId: "panel",
				stateId: "normal",
				targetIndex: 0,
				outcome: "failed",
				notes: "Text overflows.",
			},
		],
		sampleText: "Potion",
	});
	expect(screen.getByRole("alert")).toHaveTextContent(
		"The result could not be confirmed. Check the current state before repeating this action."
	);
});
test("editing the configuration clears recorded observations", async () => {
	mocks.list.mockResolvedValue([]);
	mount();
	await fill();
	fireEvent.change(screen.getByLabelText("Test result"), {
		target: { value: "passed" },
	});
	fireEvent.change(screen.getByLabelText("Observation"), {
		target: { value: "Fits." },
	});
	expect(screen.getByLabelText("Observation")).toHaveValue("Fits.");
	fireEvent.change(screen.getByLabelText("Sample text"), {
		target: { value: "Longer inventory item description" },
	});
	expect(screen.getByLabelText("Observation")).toHaveValue("");
	expect(screen.getByLabelText("Test result")).toHaveValue("inconclusive");
	fireEvent.change(screen.getByLabelText("Observation"), {
		target: { value: "Still fits." },
	});
	fireEvent.change(screen.getByLabelText("Top margin"), {
		target: { value: "4" },
	});
	expect(screen.getByLabelText("Observation")).toHaveValue("");
});
const savedRecord = {
	id: "saved",
	createdAt: "2026-10-13T00:00:00Z",
	evaluations: [],
	targets: [],
	states: [],
	observations: [],
	sampleText: "x",
};
test("a confirmed save reports success only after the refreshed list contains it", async () => {
	mocks.list.mockResolvedValueOnce([]).mockResolvedValue([savedRecord]);
	mocks.save.mockResolvedValue({ id: "saved" });
	mount();
	await fill();
	fireEvent.click(screen.getByRole("button", { name: "Save stretch test" }));
	expect(await screen.findByText("Stretch test saved.")).toBeInTheDocument();
	expect(mocks.list).toHaveBeenCalledTimes(2);
	expect(
		screen.queryByRole("button", { name: "Check current tests" })
	).not.toBeInTheDocument();
});
test("an unconfirmed readback reports it and keeps the check available", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockResolvedValue({ id: "saved" });
	mount();
	await fill();
	fireEvent.click(screen.getByRole("button", { name: "Save stretch test" }));
	expect(
		await screen.findByText(
			"Save returned, but readback is not confirmed. Check current tests."
		)
	).toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Check current tests" })
	).toBeInTheDocument();
});
test("a failed export surfaces its message and always calls the server", async () => {
	mocks.list.mockResolvedValue([savedRecord]);
	mocks.exportTest.mockRejectedValue(new Error("Export denied"));
	mount();
	const download = await screen.findByRole("button", {
		name: "Download UI profile metadata",
	});
	fireEvent.click(download);
	await waitFor(() => expect(mocks.exportTest).toHaveBeenCalledTimes(1));
	expect(mocks.exportTest.mock.calls[0]?.[0]).toEqual({
		projectId: "project",
		assetFamilyId: "family",
		id: "saved",
	});
	expect(await screen.findByRole("alert")).toBeInTheDocument();
	fireEvent.click(download);
	await waitFor(() => expect(mocks.exportTest).toHaveBeenCalledTimes(2));
});
