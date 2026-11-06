// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { BackgroundOperationsView } from "./background-operations-view";

const projectId = "project-operations";
const triggerAndAttempt = /Requested from the export panel · Attempt 1 of 3/;

function operation(overrides: Record<string, unknown>) {
	return {
		attemptCount: 1,
		createdAt: new Date().toISOString(),
		failureSummary: null,
		finishedAt: null,
		id: "operation-1",
		kind: "export",
		maxAttempts: 3,
		progressPercent: null,
		progressStep: null,
		projectId,
		resultSummary: null,
		scopeSummary: "Export bundle for Ash Knight",
		scopeTargetId: null,
		startedAt: null,
		status: "running",
		triggerSummary: "Requested from the export panel",
		triggeredByUserId: "user-1",
		updatedAt: new Date().toISOString(),
		...overrides,
	};
}

const fakeApi = vi.hoisted(() => ({
	listError: null as Error | null,
	operations: [] as Record<string, unknown>[],
}));

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		backgroundOperations: {
			list: {
				queryOptions: () => ({
					queryFn: () => {
						if (fakeApi.listError) {
							return Promise.reject(fakeApi.listError);
						}
						return Promise.resolve({
							operations: structuredClone(fakeApi.operations),
						});
					},
					queryKey: ["background-operations", projectId],
				}),
			},
		},
	},
}));

vi.mock("sonner", () => ({ toast: { dismiss: vi.fn(), error: vi.fn() } }));

afterEach(() => {
	cleanup();
	fakeApi.listError = null;
	fakeApi.operations = [];
});

function renderView() {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<BackgroundOperationsView projectId={projectId} />
		</QueryClientProvider>
	);
}

test("shows the authoritative record: kind, scope, trigger, status and attempts", async () => {
	fakeApi.operations = [operation({ status: "pending", attemptCount: 0 })];
	renderView();

	await screen.findByText("Export: Export bundle for Ash Knight");
	expect(screen.getByText("Pending")).toBeInTheDocument();
	expect(screen.getByText(triggerAndAttempt)).toBeInTheDocument();
});

test("shows no progress for an operation that has not waited a second", async () => {
	fakeApi.operations = [operation({})];
	renderView();

	await screen.findByText("Running");
	expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

test("shows progress once a running operation has waited more than a second", async () => {
	fakeApi.operations = [
		operation({
			createdAt: new Date(Date.now() - 5000).toISOString(),
			progressPercent: 40,
			progressStep: "Packing frames",
		}),
	];
	renderView();

	const bar = await screen.findByRole("progressbar");
	expect(bar).toHaveAttribute("aria-valuenow", "40");
	expect(screen.getByText("Packing frames (40%)")).toBeInTheDocument();
});

test("shows a completed result and a failed result the user can read", async () => {
	fakeApi.operations = [
		operation({
			id: "operation-done",
			resultSummary: "Exported 12 frames.",
			status: "completed",
		}),
		operation({
			attemptCount: 3,
			failureSummary: "The storage was busy. It failed after 3 attempts.",
			id: "operation-failed",
			kind: "archive",
			scopeSummary: "Archive Forest Quest",
			status: "failed",
		}),
	];
	renderView();

	await screen.findByText("Exported 12 frames.");
	expect(screen.getByRole("alert")).toHaveTextContent(
		"The storage was busy. It failed after 3 attempts."
	);
	expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

test("offers a retry when the record cannot be loaded", async () => {
	fakeApi.listError = new Error("offline");
	renderView();

	expect(
		await screen.findByText("Background operations could not be loaded.")
	).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
});
