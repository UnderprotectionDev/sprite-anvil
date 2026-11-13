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
const webRunPattern = /Web app ·/;
const reportNamePattern = /Platform Equivalence Report/;
const interimPattern = /Phase 3 interim evidence/;
const openPattern = /^Open:/;

function webRun() {
	return {
		bundleId,
		createdAt: "2026-11-12T10:00:00.000Z",
		evidence: {
			input: {
				adapterVersion: null,
				assetFamilyIds: [],
				contextRevisionId: "ctx-1",
				deliveryTargetRevisionId: null,
				profileRevisionId: "r-1",
			},
			inputDigest: digest,
			sections: {},
		},
		id: webRunId,
		projectId,
		surface: "web",
		surfaceIdentity: "client_declared",
	};
}

function report() {
	return {
		claimsFullAcceptance: false,
		comparison: {
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
			name: "Create report from latest runs",
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
	expect(
		screen.getByRole("button", { name: "Create report from latest runs" })
	).toBeDisabled();
	expect(
		screen.getByText("This project has no Platform Equivalence Report yet.")
	).toBeInTheDocument();
});

test("the screen shows the support gate closed: no supported platform and OV-08 to OV-11 open", async () => {
	renderView();

	const gate = await screen.findByRole("region", {
		name: "Platform support gate",
	});
	expect(
		within(gate).getByText(
			"No Supported Platform Matrix combination is published, so no platform is declared supported."
		)
	).toBeInTheDocument();
	expect(within(gate).getAllByText(openPattern)).toHaveLength(4);
});
