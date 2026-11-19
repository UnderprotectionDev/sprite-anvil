// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ErasureApprovalPanel } from "./erasure-approval-panel";

const receiptPattern = /receipt-digest/u;
const datePattern = /2030-01-01/u;

const api = vi.hoisted(() => ({ approve: vi.fn(), receipt: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		permanentErasure: {
			approveErasure: { mutationOptions: () => ({ mutationFn: api.approve }) },
			getDeletionReceipt: {
				queryOptions: () => ({ queryKey: ["receipt"], queryFn: api.receipt }),
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
	},
}));

test("requires explicit acknowledgements before approval", async () => {
	const report = {
		id: "report",
		reportDigest: "digest",
		containers: [],
		managedCopies: [],
		fulfilments: [],
	} as never;
	const user = userEvent.setup();
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ErasureApprovalPanel projectId="project" report={report} />
		</QueryClientProvider>
	);
	await user.click(screen.getByRole("button", { name: "Approve Erasure" }));
	expect(api.approve).not.toHaveBeenCalled();
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

test("submits exact counts and displays the completed receipt", async () => {
	api.approve.mockResolvedValue({
		id: "operation",
		status: "completed",
		scopeTargetId: "receipt",
		progressPercent: 100,
	});
	api.receipt.mockResolvedValue({
		reportDigest: "digest",
		receiptDigest: "receipt-digest",
		counts: {
			managedCopies: 1,
			bundles: 1,
			archives: 0,
			containerFiles: 2,
			fulfilments: 0,
		},
		backup: { status: "scheduled", purgeDueAt: "2030-01-01" },
	});
	const report = {
		id: "report",
		reportDigest: "digest",
		containers: [{ id: "bundle", kind: "export_bundle", embeddedFileCount: 2 }],
		managedCopies: [{}],
		fulfilments: [],
	} as never;
	const user = userEvent.setup();
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ErasureApprovalPanel projectId="project" report={report} />
		</QueryClientProvider>
	);
	await user.click(
		screen.getByRole("checkbox", { name: "Export Bundle bundle" })
	);
	await user.click(
		screen.getByRole("checkbox", {
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
	await waitFor(() =>
		expect(api.approve).toHaveBeenCalledWith(
			{
				projectId: "project",
				reportId: "report",
				reportDigest: "digest",
				selectedContainerIds: ["bundle"],
				confirmed: {
					managedCopies: 1,
					bundles: 1,
					archives: 0,
					containerFiles: 2,
					fulfilments: 0,
				},
				acknowledgements: { irreversible: true, externalCopiesRemain: true },
				idempotencyKey: expect.any(String),
			},
			expect.anything()
		)
	);
	expect(await screen.findByText(receiptPattern)).toBeInTheDocument();
	expect(screen.getByText(datePattern)).toBeInTheDocument();
});
