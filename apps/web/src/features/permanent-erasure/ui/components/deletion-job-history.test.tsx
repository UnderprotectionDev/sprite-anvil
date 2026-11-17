// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { DeletionJobHistory } from "./deletion-job-history";

const assetPattern = /Asset A/;
const otherPattern = /other/;
const openPattern = /Open Deletion Receipt/;
const digestPattern = /receipt-digest/;

const api = vi.hoisted(() => ({ list: vi.fn(), receipt: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		backgroundOperations: {
			list: {
				queryOptions: ({ input }: { input: unknown }) => ({
					queryKey: ["operations", input],
					queryFn: () => api.list(input),
				}),
			},
		},
		permanentErasure: {
			getDeletionReceipt: {
				queryOptions: ({ input }: { input: unknown }) => ({
					queryKey: ["receipt", input],
					queryFn: () => api.receipt(input),
				}),
			},
		},
	},
}));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
test("reopens a completed project's receipt after mounting and reports read errors", async () => {
	api.list.mockResolvedValue({
		operations: [
			{
				id: "job-1",
				kind: "deletion",
				status: "completed",
				scopeTargetId: "receipt-1",
				scopeSummary: "Asset A",
			},
			{
				id: "other",
				kind: "export",
				status: "completed",
				scopeTargetId: "other",
			},
		],
	});
	api.receipt
		.mockRejectedValueOnce(new Error("Receipt unavailable"))
		.mockResolvedValue({
			reportDigest: "report-digest",
			receiptDigest: "receipt-digest",
			counts: {
				managedCopies: 1,
				bundles: 0,
				archives: 0,
				containerFiles: 0,
				fulfilments: 0,
			},
			backup: { status: "scheduled", purgeDueAt: "2030-01-01" },
		});
	const user = userEvent.setup();
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<DeletionJobHistory projectId="project-1" />
		</QueryClientProvider>
	);
	expect(await screen.findByText(assetPattern)).toBeInTheDocument();
	expect(screen.queryByText(otherPattern)).not.toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: openPattern }));
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Receipt unavailable"
	);
	await user.click(screen.getByRole("button", { name: "Retry receipt" }));
	expect(await screen.findByText(digestPattern)).toBeInTheDocument();
	expect(api.list).toHaveBeenCalledWith({ projectId: "project-1" });
	expect(api.receipt).toHaveBeenCalledWith({
		projectId: "project-1",
		receiptId: "receipt-1",
	});
});
