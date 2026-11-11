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
	confirmFailureSource: vi.fn(),
	create: vi.fn(),
	finalizeOutcome: vi.fn(),
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
		deliveryPlanning: {
			list: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve({ deliveryTargets: [] }),
					queryKey: ["delivery-targets"],
				}),
			},
		},
		runtimeValidation: {
			confirmFailureSource: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.confirmFailureSource(input),
				}),
			},
			deliveryTargetReadiness: { key: () => ["runtime-validation-readiness"] },
			finalizeOutcome: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.finalizeOutcome(input),
				}),
			},
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

const recordId = "33333333-3333-4333-8333-333333333333";
const sourceUnknownBlocksPattern = /Source Unknown blocks any Delivery Target/;
const revalidationRequiredPattern = /Revalidation Required for this use only/;

function record(
	evidence: unknown[] = [],
	state: {
		decisions?: unknown[];
		failureSource?: string | null;
		outcome?: string | null;
	} = {}
) {
	return {
		adapterVersion: null,
		bundleId,
		createdAt: "2026-11-11T10:00:00.000Z",
		decisions: state.decisions ?? [],
		engineVersion: "Godot 4.4.1",
		evidence,
		failureSource: state.failureSource ?? null,
		gameBuild: "build-7",
		id: recordId,
		manifestDigest,
		outcome: state.outcome ?? null,
		projectId,
		supersedesRecordId: null,
	};
}

beforeEach(() => {
	fakeApi.records = [];
});

afterEach(() => {
	cleanup();
	fakeApi.addTextEvidence.mockReset();
	fakeApi.confirmFailureSource.mockReset();
	fakeApi.create.mockReset();
	fakeApi.finalizeOutcome.mockReset();
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

test("an observation with a file attached is refused with a message, not skipped silently", async () => {
	const user = userEvent.setup();
	fakeApi.records = [record()];
	renderView();

	await user.upload(
		await screen.findByLabelText(
			"Screenshot, recording or test result file (up to 5 MiB)"
		),
		new File(["frame"], "hero.png", { type: "image/png" })
	);
	await user.click(screen.getByRole("button", { name: "Add evidence" }));

	expect(
		await screen.findByText("An observation is text only.")
	).toBeInTheDocument();
	expect(fakeApi.addTextEvidence).not.toHaveBeenCalled();
});

test("the user finalizes the outcome and the re-read record shows it as final", async () => {
	const user = userEvent.setup();
	fakeApi.records = [record()];
	fakeApi.finalizeOutcome.mockImplementation(() => {
		fakeApi.records = [
			record([], {
				decisions: [
					{
						createdAt: "2026-11-11T10:06:00.000Z",
						failureSource: null,
						id: "55555555-5555-4555-8555-555555555555",
						kind: "outcome",
						outcome: "pass",
					},
				],
				outcome: "pass",
			}),
		];
		return Promise.resolve({ status: "created" });
	});
	renderView();

	// nothing is chosen for the user
	await user.click(
		await screen.findByRole("button", { name: "Finalize outcome" })
	);
	expect(
		await screen.findByText("Choose the outcome of this test.")
	).toBeVisible();
	expect(fakeApi.finalizeOutcome).not.toHaveBeenCalled();

	await user.selectOptions(
		screen.getByLabelText("Outcome", { selector: "select" }),
		"pass"
	);
	await user.click(screen.getByRole("button", { name: "Finalize outcome" }));

	expect(await screen.findByText("Pass")).toBeVisible();
	expect(fakeApi.finalizeOutcome).toHaveBeenCalledWith(
		expect.objectContaining({ outcome: "pass", projectId, recordId })
	);
	expect(
		screen.queryByRole("button", { name: "Finalize outcome" })
	).not.toBeInTheDocument();
});

test("a Fail shows Source Unknown as blocking and the user confirms the source", async () => {
	const user = userEvent.setup();
	fakeApi.records = [
		record([], { failureSource: "source_unknown", outcome: "fail" }),
	];
	fakeApi.confirmFailureSource.mockImplementation(() => {
		fakeApi.records = [
			record([], { failureSource: "asset_content", outcome: "fail" }),
		];
		return Promise.resolve({ status: "created" });
	});
	renderView();

	expect(await screen.findByText(sourceUnknownBlocksPattern)).toBeVisible();
	await user.selectOptions(
		screen.getByLabelText("Failure source"),
		"asset_content"
	);
	await user.click(
		screen.getByRole("button", { name: "Confirm failure source" })
	);

	expect(await screen.findByText(revalidationRequiredPattern)).toBeVisible();
	expect(fakeApi.confirmFailureSource).toHaveBeenCalledWith(
		expect.objectContaining({ failureSource: "asset_content", recordId })
	);
});

test("the retest picker lists only records that can be superseded", async () => {
	const withState = (
		id: string,
		gameBuild: string,
		state: { failureSource?: string | null; outcome?: string | null }
	) => ({ ...record([], state), gameBuild, id });
	fakeApi.records = [
		withState("a0000000-0000-4000-8000-000000000001", "build-pending", {}),
		withState("a0000000-0000-4000-8000-000000000002", "build-pass", {
			outcome: "pass",
		}),
		withState("a0000000-0000-4000-8000-000000000003", "build-unknown", {
			failureSource: "source_unknown",
			outcome: "fail",
		}),
		withState("a0000000-0000-4000-8000-000000000004", "build-classified", {
			failureSource: "asset_content",
			outcome: "fail",
		}),
		withState("a0000000-0000-4000-8000-000000000005", "build-inconclusive", {
			outcome: "inconclusive",
		}),
	];
	renderView();

	const picker = await screen.findByLabelText(
		"Retest or fix of an earlier record (optional)"
	);
	const labels = within(picker)
		.getAllByRole("option")
		.map((option) => option.textContent ?? "");
	expect(labels).toHaveLength(3);
	expect(labels[1]).toContain("build-classified");
	expect(labels[2]).toContain("build-inconclusive");
});

test("an invalid field is marked invalid and points at its error message", async () => {
	const user = userEvent.setup();
	renderView();
	await user.click(
		await screen.findByRole("button", {
			name: "Save Runtime Validation Record",
		})
	);

	const build = await screen.findByLabelText("Game build");
	expect(build).toHaveAttribute("aria-invalid", "true");
	const errorId = build.getAttribute("aria-describedby");
	expect(errorId).toBeTruthy();
	expect(document.getElementById(errorId ?? "")).toHaveTextContent(
		"Enter the game build."
	);
	expect(screen.getByLabelText("Export Bundle")).toHaveAttribute(
		"aria-invalid",
		"true"
	);
	// a valid field carries neither
	const adapter = screen.getByLabelText("Adapter version (optional)");
	expect(adapter).not.toHaveAttribute("aria-invalid");
	expect(adapter).not.toHaveAttribute("aria-describedby");
});

test("the decision and evidence forms mark their invalid fields too", async () => {
	const user = userEvent.setup();
	fakeApi.records = [record()];
	renderView();

	await user.click(
		await screen.findByRole("button", { name: "Finalize outcome" })
	);
	const outcome = await screen.findByLabelText("Outcome", {
		selector: "select",
	});
	expect(outcome).toHaveAttribute("aria-invalid", "true");
	expect(
		document.getElementById(outcome.getAttribute("aria-describedby") ?? "")
	).toHaveTextContent("Choose the outcome of this test.");

	await user.click(screen.getByRole("button", { name: "Add evidence" }));
	const text = await screen.findByLabelText("Observation or test result text");
	expect(text).toHaveAttribute("aria-invalid", "true");
	expect(
		document.getElementById(text.getAttribute("aria-describedby") ?? "")
	).toHaveTextContent("Write the observation.");
});
