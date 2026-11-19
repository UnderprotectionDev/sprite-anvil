// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { PermanentErasureView } from "./permanent-erasure-view";

const versionText = /version-1/u;

const api = vi.hoisted(() => ({ prepare: vi.fn(), approve: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		assetRecords: {
			list: {
				queryOptions: () => ({
					queryKey: ["records"],
					queryFn: async () => [{ id: "asset-1", name: "Hero" }],
				}),
			},
		},
		backgroundOperations: {
			list: {
				queryOptions: () => ({
					queryKey: ["operations"],
					queryFn: async () => ({ operations: [] }),
				}),
			},
		},
		permanentErasure: {
			approveErasure: { mutationOptions: () => ({ mutationFn: api.approve }) },
			getDeletionReceipt: {
				queryOptions: () => ({
					queryKey: ["receipt"],
					queryFn: async () => null,
				}),
			},
			prepareImpactReport: {
				mutationOptions: () => ({ mutationFn: api.prepare }),
			},
		},
	},
}));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
test("selects an Asset Record and displays the prepared impact", async () => {
	api.prepare.mockResolvedValue({
		status: "created",
		report: {
			counts: {
				managedCopies: 1,
				bundles: 0,
				archives: 0,
				containerFiles: 0,
				fulfilments: 0,
			},
			managedCopies: [
				{ assetVersionId: "version-1", byteSize: 42, sha256: "abc" },
			],
			containers: [],
			fulfilments: [],
			backup: { status: "unpublished" },
			externalCopies: { statement: "External copies cannot be recalled." },
		},
	});
	const user = userEvent.setup();
	render(
		<QueryClientProvider client={new QueryClient()}>
			<PermanentErasureView projectId="project-1" />
		</QueryClientProvider>
	);
	await screen.findByRole("option", { name: "Hero" });
	await user.selectOptions(screen.getByLabelText("Asset Record"), "asset-1");
	await user.click(
		screen.getByRole("button", { name: "Prepare Erasure Impact Report" })
	);
	await waitFor(() =>
		expect(api.prepare).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "project-1",
				assetRecordId: "asset-1",
				idempotencyKey: expect.any(String),
			}),
			expect.anything()
		)
	);
	expect(
		await screen.findByText("External copies cannot be recalled.")
	).toBeInTheDocument();
	expect(screen.getByText(versionText)).toBeInTheDocument();
	expect(
		screen.getByText("A backup retention schedule has not been published.")
	).toBeInTheDocument();
});

test("reports preparation errors and reuses the key on retry", async () => {
	api.prepare.mockReset();
	api.prepare.mockRejectedValue(new Error("Cannot prepare report"));
	const user = userEvent.setup();
	render(
		<QueryClientProvider client={new QueryClient()}>
			<PermanentErasureView projectId="project-1" />
		</QueryClientProvider>
	);
	await screen.findByRole("option", { name: "Hero" });
	await user.selectOptions(screen.getByLabelText("Asset Record"), "asset-1");
	await user.click(
		screen.getByRole("button", { name: "Prepare Erasure Impact Report" })
	);
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Cannot prepare report"
	);
	await user.click(
		screen.getByRole("button", { name: "Prepare Erasure Impact Report" })
	);
	await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(2));
	expect(api.prepare.mock.calls[0][0]).toEqual(api.prepare.mock.calls[1][0]);
});

test("an uncertain approval locks report preparation and retries the same input", async () => {
	api.prepare.mockResolvedValue({
		report: {
			id: "report",
			reportDigest: "digest",
			counts: {
				managedCopies: 0,
				bundles: 0,
				archives: 0,
				containerFiles: 0,
				fulfilments: 0,
			},
			managedCopies: [],
			containers: [],
			fulfilments: [],
			backup: { status: "unpublished" },
			externalCopies: { statement: "External copies remain." },
		},
	});
	api.approve.mockRejectedValue(
		Object.assign(new Error("Server error"), {
			code: "INTERNAL_SERVER_ERROR",
			status: 500,
		})
	);
	const user = userEvent.setup();
	render(
		<QueryClientProvider client={new QueryClient()}>
			<PermanentErasureView projectId="project-1" />
		</QueryClientProvider>
	);
	await screen.findByRole("option", { name: "Hero" });
	await user.selectOptions(screen.getByLabelText("Asset Record"), "asset-1");
	await user.click(
		screen.getByRole("button", { name: "Prepare Erasure Impact Report" })
	);
	await user.click(
		await screen.findByRole("checkbox", {
			name: "I understand erasure is irreversible",
		})
	);
	await user.click(
		screen.getByRole("checkbox", {
			name: "I understand external copies remain",
		})
	);
	await user.click(
		screen.getByRole("checkbox", { name: "I confirm these counts" })
	);
	await user.click(screen.getByRole("button", { name: "Approve Erasure" }));
	await screen.findByText(
		"The approval outcome is unknown. Retry the same approval."
	);
	expect(screen.getByLabelText("Asset Record")).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Prepare Erasure Impact Report" })
	).toBeDisabled();
	expect(
		screen.getByRole("checkbox", { name: "I confirm these counts" })
	).toHaveAttribute("aria-disabled", "true");
	await user.click(screen.getByRole("button", { name: "Retry approval" }));
	await waitFor(() => expect(api.approve).toHaveBeenCalledTimes(2));
	expect(api.approve.mock.calls[0][0]).toEqual(api.approve.mock.calls[1][0]);
});

test("a changed report rejection unlocks preparation and a new digest resets acknowledgements", async () => {
	const report = {
		id: "report",
		reportDigest: "digest",
		counts: {
			managedCopies: 0,
			bundles: 0,
			archives: 0,
			containerFiles: 0,
			fulfilments: 0,
		},
		managedCopies: [],
		containers: [],
		fulfilments: [],
		backup: { status: "unpublished" },
		externalCopies: { statement: "External copies remain." },
	};
	api.prepare
		.mockReset()
		.mockResolvedValueOnce({ report })
		.mockResolvedValueOnce({
			report: { ...report, reportDigest: "new-digest" },
		})
		.mockResolvedValueOnce({
			report: { ...report, id: "new-report", reportDigest: "new-digest" },
		});
	api.approve.mockReset().mockRejectedValue(
		Object.assign(new Error("Report changed"), {
			code: "BAD_REQUEST",
			status: 400,
		})
	);
	const user = userEvent.setup();
	render(
		<QueryClientProvider client={new QueryClient()}>
			<PermanentErasureView projectId="project-1" />
		</QueryClientProvider>
	);
	await screen.findByRole("option", { name: "Hero" });
	await user.selectOptions(screen.getByLabelText("Asset Record"), "asset-1");
	const prepare = screen.getByRole("button", {
		name: "Prepare Erasure Impact Report",
	});
	await user.click(prepare);
	await user.click(
		await screen.findByRole("checkbox", {
			name: "I understand erasure is irreversible",
		})
	);
	await user.click(
		screen.getByRole("checkbox", {
			name: "I understand external copies remain",
		})
	);
	await user.click(
		screen.getByRole("checkbox", { name: "I confirm these counts" })
	);
	await user.click(screen.getByRole("button", { name: "Approve Erasure" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("Report changed");
	expect(prepare).toBeEnabled();
	expect(screen.getByLabelText("Asset Record")).toBeEnabled();
	await user.click(prepare);
	await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(2));
	expect(api.prepare.mock.calls[1][0].idempotencyKey).not.toBe(
		api.prepare.mock.calls[0][0].idempotencyKey
	);
	await waitFor(() =>
		expect(
			screen.getByRole("checkbox", { name: "I confirm these counts" })
		).toHaveAttribute("aria-checked", "false")
	);
	await user.click(
		screen.getByRole("checkbox", { name: "I confirm these counts" })
	);
	await user.click(prepare);
	await waitFor(() => expect(api.prepare).toHaveBeenCalledTimes(3));
	await waitFor(() =>
		expect(
			screen.getByRole("checkbox", { name: "I confirm these counts" })
		).toHaveAttribute("aria-checked", "false")
	);
});
