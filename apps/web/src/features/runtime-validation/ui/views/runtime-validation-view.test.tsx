// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { RuntimeValidationView } from "./runtime-validation-view";

const projectId = "11111111-1111-4111-8111-111111111111";
const bundleId = "22222222-2222-4222-8222-222222222222";
const manifestDigest = "d".repeat(64);

const fakeApi = vi.hoisted(() => ({
	addTextEvidence: vi.fn(),
	create: vi.fn(),
	records: [] as unknown[],
}));

vi.mock("@/env", () => ({ ENV: { VITE_SERVER_URL: "http://server.test" } }));

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		exportBundles: {
			list: {
				queryOptions: () => ({
					queryFn: () =>
						Promise.resolve({
							bundles: [
								{
									createdAt: "2026-11-10T10:00:00.000Z",
									id: bundleId,
									manifestDigest,
								},
							],
							latestBundleId: bundleId,
						}),
					queryKey: ["export-bundles"],
				}),
			},
		},
		runtimeValidation: {
			addTextEvidence: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.addTextEvidence(input),
				}),
			},
			create: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.create(input),
				}),
			},
			list: {
				key: () => ["runtime-validation"],
				queryOptions: () => ({
					queryFn: () =>
						Promise.resolve({ records: structuredClone(fakeApi.records) }),
					queryKey: ["runtime-validation", "list"],
				}),
			},
		},
	},
}));

vi.mock("sonner", () => ({ toast: { dismiss: vi.fn(), error: vi.fn() } }));

function record(evidence: unknown[] = []) {
	return {
		adapterVersion: null,
		bundleId,
		createdAt: "2026-11-11T10:00:00.000Z",
		engineVersion: "Godot 4.4.1",
		evidence,
		gameBuild: "build-7",
		id: "33333333-3333-4333-8333-333333333333",
		manifestDigest,
		projectId,
	};
}

beforeEach(() => {
	fakeApi.records = [];
});

afterEach(() => {
	cleanup();
	fakeApi.addTextEvidence.mockReset();
	fakeApi.create.mockReset();
});

function renderView() {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<RuntimeValidationView projectId={projectId} />
		</QueryClientProvider>
	);
}

test("a saved record is shown from the re-read list with its bundle, build, engine and evidence", async () => {
	const user = userEvent.setup();
	fakeApi.create.mockImplementation(() => {
		fakeApi.records = [record()];
		return Promise.resolve({ record: record(), status: "created" });
	});
	renderView();

	await user.selectOptions(
		await screen.findByLabelText("Export Bundle"),
		bundleId
	);
	await user.type(screen.getByLabelText("Game build"), "build-7");
	await user.type(screen.getByLabelText("Engine version"), "Godot 4.4.1");
	await user.click(
		screen.getByRole("button", { name: "Save Runtime Validation Record" })
	);

	const card = await screen.findByRole("article", {
		name: "Runtime Validation Record for build build-7",
	});
	expect(fakeApi.create).toHaveBeenCalledWith(
		expect.objectContaining({
			adapterVersion: null,
			bundleId,
			engineVersion: "Godot 4.4.1",
			gameBuild: "build-7",
			projectId,
		})
	);
	expect(within(card).getByText(manifestDigest)).toBeInTheDocument();
	expect(
		within(card).getByText("No evidence has been added to this record yet.")
	).toBeInTheDocument();
});

test("blank fields are refused before anything is sent", async () => {
	const user = userEvent.setup();
	renderView();
	await user.click(
		await screen.findByRole("button", {
			name: "Save Runtime Validation Record",
		})
	);

	expect(
		await screen.findByText("Choose the Export Bundle that was tested.")
	).toBeInTheDocument();
	expect(screen.getByText("Enter the game build.")).toBeInTheDocument();
	expect(screen.getByText("Enter the engine version.")).toBeInTheDocument();
	expect(fakeApi.create).not.toHaveBeenCalled();
});

test("observation text is added to the record and the re-read evidence is shown", async () => {
	const user = userEvent.setup();
	fakeApi.records = [record()];
	fakeApi.addTextEvidence.mockImplementation(() => {
		fakeApi.records = [
			record([
				{
					createdAt: "2026-11-11T10:05:00.000Z",
					file: null,
					id: "44444444-4444-4444-8444-444444444444",
					kind: "observation",
					source: "manual",
					text: "The hero idles at 12 fps.",
				},
			]),
		];
		return Promise.resolve({ status: "created" });
	});
	renderView();

	await user.type(
		await screen.findByLabelText("Observation or test result text"),
		"The hero idles at 12 fps."
	);
	await user.click(screen.getByRole("button", { name: "Add evidence" }));

	expect(
		await screen.findByText("The hero idles at 12 fps.")
	).toBeInTheDocument();
	expect(fakeApi.addTextEvidence).toHaveBeenCalledWith(
		expect.objectContaining({ kind: "observation", source: "manual" })
	);
});

test("an observation with no text is refused", async () => {
	const user = userEvent.setup();
	fakeApi.records = [record()];
	renderView();
	await user.click(await screen.findByRole("button", { name: "Add evidence" }));

	expect(await screen.findByText("Write the observation.")).toBeInTheDocument();
	expect(fakeApi.addTextEvidence).not.toHaveBeenCalled();
});
