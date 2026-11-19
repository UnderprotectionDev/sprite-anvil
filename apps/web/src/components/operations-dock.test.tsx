// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OperationsDock } from "./operations-dock";

const fetchSummary = vi.fn();
vi.mock("@/utils/orpc", () => ({
	orpc: {
		backgroundOperations: {
			summary: {
				queryOptions: ({ input }: { input: { projectId: string } }) => ({
					queryKey: ["summary", input.projectId],
					queryFn: () => fetchSummary(input.projectId),
				}),
			},
		},
	},
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		params,
	}: {
		children: React.ReactNode;
		params: { projectId: string };
	}) => <a href={`/projects/${params.projectId}/operations`}>{children}</a>,
}));

afterEach(() => {
	cleanup();
	fetchSummary.mockReset();
});
const wrap = (child: React.ReactNode) => (
	<QueryClientProvider
		client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
	>
		{child}
	</QueryClientProvider>
);
it("shows loading, authoritative counts and the project operations link", async () => {
	let resolve!: (value: { active: number; failed: number }) => void;
	fetchSummary.mockReturnValue(
		new Promise((done) => {
			resolve = done;
		})
	);
	render(wrap(<OperationsDock projectId="p1" userId="u1" />));
	expect(screen.getByText("Loading operations…")).toBeTruthy();
	resolve({ active: 4, failed: 2 });
	expect(await screen.findByText("4 active · 2 failed")).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Operations" }).getAttribute("href")
	).toBe("/projects/p1/operations");
});
it("shows an error rather than fake zero counts", async () => {
	fetchSummary.mockRejectedValue(new Error("offline"));
	render(wrap(<OperationsDock projectId="p1" userId="u1" />));
	await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
	expect(screen.queryByText("0 active · 0 failed")).toBeNull();
});
it("isolates cached counts across accounts and projects and displays the empty state", async () => {
	fetchSummary
		.mockResolvedValueOnce({ active: 5, failed: 1 })
		.mockResolvedValue({ active: 0, failed: 0 });
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const rendered = render(
		<QueryClientProvider client={client}>
			<OperationsDock projectId="p1" userId="u1" />
		</QueryClientProvider>
	);
	expect(await screen.findByText("5 active · 1 failed")).toBeTruthy();
	rendered.rerender(
		<QueryClientProvider client={client}>
			<OperationsDock projectId="p1" userId="u2" />
		</QueryClientProvider>
	);
	expect(
		await screen.findByText("No active or failed operations.")
	).toBeTruthy();
	expect(screen.queryByText("5 active · 1 failed")).toBeNull();
	rendered.rerender(
		<QueryClientProvider client={client}>
			<OperationsDock projectId="p2" userId="u2" />
		</QueryClientProvider>
	);
	await waitFor(() => expect(fetchSummary).toHaveBeenCalledWith("p2"));
});
