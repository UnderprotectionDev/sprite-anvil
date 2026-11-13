// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { PlatformEquivalenceReportView } from "./platform-equivalence-report-view";

const projectId = "11111111-1111-4111-8111-111111111111";
const bundleId = "22222222-2222-4222-8222-222222222222";
const webRunId = "33333333-3333-4333-8333-333333333333";
const reportId = "44444444-4444-4444-8444-444444444444";
const digest = "a".repeat(64);

const fakeApi = vi.hoisted(() => ({
	createReport: vi.fn(),
	overview: { reports: [] as unknown[], runs: [] as unknown[] },
	recordRun: vi.fn(),
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
									manifestDigest: digest,
								},
							],
							latestBundleId: bundleId,
						}),
					queryKey: ["export-bundles"],
				}),
			},
		},
		platformEquivalence: {
			createReport: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.createReport(input),
				}),
			},
			overview: {
				key: () => ["platform-equivalence"],
				queryOptions: () => ({
					queryFn: () => Promise.resolve(structuredClone(fakeApi.overview)),
					queryKey: ["platform-equivalence", "overview"],
				}),
			},
			recordRun: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.recordRun(input),
				}),
			},
		},
	},
}));

vi.mock("sonner", () => ({ toast: { dismiss: vi.fn(), error: vi.fn() } }));

const section = { differences: [], result: "not_compared" };
const webRunPattern = /Web application ·/;
const reportNamePattern = /Platform Equivalence Report/;
const interimPattern = /Phase 3 interim evidence/;
const openPattern = /^Open:/;

const runInput = {
	adapterVersion: null,
	assetFamilyIds: [],
	contextRevisionId: "ctx-1",
	deliveryTargetRevisionId: null,
	profileRevisionId: "r-1",
};

function runOf(
	surface: "desktop" | "web",
	id: string,
	createdAt: string,
	inputDigest = digest
) {
	return {
		bundleId,
		createdAt,
		evidence: { input: runInput, inputDigest, sections: {} },
		id,
		projectId,
		surface,
		surfaceIdentity: "client_declared",
	};
}

function webRun() {
	return runOf("web", webRunId, "2026-11-12T10:00:00.000Z");
}

function report() {
	return {
		claimsFullAcceptance: false,
		comparison: {
			differingInputs: [],
			inputs: {
				desktop: null,
				web: { bundleId, input: runInput, inputDigest: digest },
			},
			missingSurfaces: ["desktop"],
			outcome: "missing_surface",
			sections: [
				{ ...section, section: "authoritative_record" },
				{ ...section, section: "quality_evidence" },
				{ ...section, section: "engine_neutral_package" },
			],
		},
		createdAt: "2026-11-12T11:00:00.000Z",
		desktopRunId: null,
		id: reportId,
		notEvaluated: [
			"delivery_refresh_lock",
			"divergence",
			"reference_acceptance_scenarios",
			"extended_acceptance_scenarios",
		],
		phase: "phase_3_interim",
		projectId,
		surfaceIdentity: "client_declared",
		webRunId,
	};
}

beforeEach(() => {
	fakeApi.overview = { reports: [], runs: [] };
});

afterEach(() => {
	cleanup();
	fakeApi.createReport.mockReset();
	fakeApi.recordRun.mockReset();
});

function renderView() {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<PlatformEquivalenceReportView projectId={projectId} />
		</QueryClientProvider>
	);
}

test("a recorded run is shown from the re-read overview as a declared web run", async () => {
	const user = userEvent.setup();
	fakeApi.recordRun.mockImplementation(() => {
		fakeApi.overview = { reports: [], runs: [webRun()] };
		return Promise.resolve({ run: webRun(), status: "created" });
	});
	renderView();

	await user.selectOptions(
		await screen.findByLabelText("Export Bundle"),
		bundleId
	);
	await user.click(screen.getByRole("button", { name: "Record run" }));

	expect(await screen.findByText(webRunPattern)).toBeInTheDocument();
	expect(fakeApi.recordRun).toHaveBeenCalledWith(
		expect.objectContaining({ bundleId, projectId, surface: "web" })
	);
});

test("a blank bundle is refused before anything is sent", async () => {
	const user = userEvent.setup();
	renderView();
	await user.click(await screen.findByRole("button", { name: "Record run" }));

	expect(
		await screen.findByText("Choose the Export Bundle this run used.")
	).toBeInTheDocument();
	expect(fakeApi.recordRun).not.toHaveBeenCalled();
});

test("a report names what is not evaluated and never claims completion", async () => {
	const user = userEvent.setup();
	fakeApi.overview = { reports: [], runs: [webRun()] };
	fakeApi.createReport.mockImplementation(() => {
		fakeApi.overview = { reports: [report()], runs: [webRun()] };
		return Promise.resolve({ report: report(), status: "created" });
	});
	renderView();

	await user.click(
		await screen.findByRole("button", {
			name: "Create report",
		})
	);

	const card = await screen.findByRole("article", {
		name: reportNamePattern,
	});
	expect(fakeApi.createReport).toHaveBeenCalledWith(
		expect.objectContaining({ desktopRunId: null, projectId, webRunId })
	);
	expect(
		within(card).getByText("A surface has no run yet, so nothing was compared.")
	).toBeInTheDocument();
	expect(
		within(card).getByText("Missing run for: Desktop application.")
	).toBeInTheDocument();
	expect(within(card).getByText(digest.slice(0, 12))).toBeInTheDocument();
	expect(
		within(card).getByText("Delivery Refresh Lock: not evaluated")
	).toBeInTheDocument();
	expect(
		within(card).getByText(
			"Reference Acceptance Scenarios (RAS): not evaluated"
		)
	).toBeInTheDocument();
	expect(within(card).getByText(interimPattern)).toBeInTheDocument();
});

test("the screen has nothing to compare before any run exists", async () => {
	renderView();

	expect(
		await screen.findByText("No run has been recorded yet.")
	).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Create report" })).toBeDisabled();
	expect(
		screen.getByText("This project has no Platform Equivalence Report yet.")
	).toBeInTheDocument();
});

test("the screen shows the support gate closed: no supported platform and OV-08 to OV-11 open", async () => {
	renderView();

	const gate = await screen.findByRole("region", {
		name: "Platform Support Gate",
	});
	expect(
		within(gate).getByText(
			"No Supported Platform Matrix combination is published, so no platform is declared supported."
		)
	).toBeInTheDocument();
	expect(within(gate).getAllByText(openPattern)).toHaveLength(4);
});

test("the user picks the web and desktop run to compare, newest by default", async () => {
	const user = userEvent.setup();
	const olderWebId = "55555555-5555-4555-8555-555555555555";
	const desktopId = "66666666-6666-4666-8666-666666666666";
	fakeApi.overview = {
		reports: [],
		runs: [
			webRun(),
			runOf("web", olderWebId, "2026-11-11T10:00:00.000Z"),
			runOf("desktop", desktopId, "2026-11-11T12:00:00.000Z"),
		],
	};
	fakeApi.createReport.mockResolvedValue({
		report: report(),
		status: "created",
	});
	renderView();

	await user.click(
		await screen.findByRole("button", { name: "Create report" })
	);
	expect(fakeApi.createReport).toHaveBeenLastCalledWith(
		expect.objectContaining({ desktopRunId: desktopId, webRunId })
	);

	await user.selectOptions(
		screen.getByLabelText("Web application run"),
		olderWebId
	);
	await user.click(screen.getByRole("button", { name: "Create report" }));
	expect(fakeApi.createReport).toHaveBeenLastCalledWith(
		expect.objectContaining({ desktopRunId: desktopId, webRunId: olderWebId })
	);
});

test("a report from runs with different inputs names the inputs that differ and both digests", async () => {
	const otherDigest = "b".repeat(64);
	fakeApi.overview = {
		reports: [
			{
				...report(),
				comparison: {
					differingInputs: ["contextRevisionId"],
					inputs: {
						desktop: {
							bundleId,
							input: { ...runInput, contextRevisionId: "ctx-2" },
							inputDigest: otherDigest,
						},
						web: { bundleId, input: runInput, inputDigest: digest },
					},
					missingSurfaces: [],
					outcome: "inputs_differ",
					sections: report().comparison.sections,
				},
			},
		],
		runs: [webRun()],
	};
	renderView();

	const card = await screen.findByRole("article", { name: reportNamePattern });

	expect(
		within(card).getByText("Inputs that differ: Context Revision.")
	).toBeInTheDocument();
	expect(within(card).getByText(digest.slice(0, 12))).toBeInTheDocument();
	expect(within(card).getByText(otherDigest.slice(0, 12))).toBeInTheDocument();
});

test("a failed recording shows the failure and a retry replays the same key", async () => {
	const user = userEvent.setup();
	fakeApi.recordRun.mockRejectedValueOnce(new Error("network"));
	fakeApi.recordRun.mockResolvedValueOnce({ run: webRun(), status: "created" });
	renderView();

	await user.selectOptions(
		await screen.findByLabelText("Export Bundle"),
		bundleId
	);
	await user.click(screen.getByRole("button", { name: "Record run" }));
	expect(
		await screen.findByText("The run could not be recorded. Try again.")
	).toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "Record run" }));

	expect(await screen.findByText("Run recorded.")).toBeInTheDocument();
	const [first, second] = fakeApi.recordRun.mock.calls.map(
		([call]) => call.idempotencyKey
	);
	expect(first).toBe(second);
});
