// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ProjectArchivesView } from "./project-archives-view";

const heroFileLabel = /hero\.aseprite/;
const unavailableFileLabel = /missing\.aseprite/;
const download = vi.hoisted(() => vi.fn());
vi.mock("../../lib/download-project-archive", () => ({
	downloadProjectArchive: download,
}));
const api = vi.hoisted(() => ({
	create: vi.fn(),
	restore: vi.fn(),
	operations: vi.fn().mockResolvedValue({ operations: [] }),
	workingFiles: vi.fn().mockResolvedValue({
		files: [
			{
				id: "snapshot-1",
				fileName: "hero.aseprite",
				byteSize: 120,
				assetVersionId: "version-1",
				available: true,
			},
			{
				id: "snapshot-2",
				fileName: "missing.aseprite",
				byteSize: 80,
				assetVersionId: "version-2",
				available: false,
			},
		],
		nextCursor: null,
	}),
}));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		backgroundOperations: {
			list: {
				queryOptions: () => ({
					queryKey: ["operations"],
					queryFn: api.operations,
				}),
			},
		},
		projectArchives: {
			listWorkingFiles: {
				queryOptions: () => ({
					queryKey: ["working-files"],
					queryFn: api.workingFiles,
				}),
			},
			list: {
				queryOptions: () => ({
					queryKey: ["archives"],
					queryFn: async () => ({
						archives: [{ id: "archive", createdAt: "2026-01-01T00:00:00Z" }],
					}),
				}),
			},
			get: {
				queryOptions: () => ({
					queryKey: ["archive"],
					queryFn: async () => ({ manifest: { files: [] } }),
				}),
			},
			create: {
				mutationOptions: (options: object) => ({
					...options,
					mutationFn: api.create,
				}),
			},
			requestRestore: {
				mutationOptions: (options: object) => ({
					...options,
					mutationFn: api.restore,
				}),
			},
		},
	},
}));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	api.operations.mockResolvedValue({ operations: [] });
});
function show() {
	render(
		<QueryClientProvider
			client={
				new QueryClient({
					defaultOptions: {
						queries: { retry: false },
						mutations: { retry: false },
					},
				})
			}
		>
			<ProjectArchivesView projectId="project" />
		</QueryClientProvider>
	);
}
async function readyCreateButton() {
	const button = await screen.findByRole("button", {
		name: "Create Project Archive",
	});
	await waitFor(() => expect(button).not.toBeDisabled());
	return button;
}
test("creates an archive", async () => {
	api.create.mockResolvedValue({});
	show();
	fireEvent.click(await readyCreateButton());
	await waitFor(() => expect(api.create).toHaveBeenCalled());
});
test("restores an independent project", async () => {
	api.restore.mockResolvedValue({});
	show();
	fireEvent.change(await screen.findByLabelText("New project name"), {
		target: { value: "Restored" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Restore" }));
	await waitFor(() =>
		expect(api.restore).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Restored", archiveId: "archive" }),
			expect.anything()
		)
	);
});
test("shows creation errors", async () => {
	api.create.mockRejectedValue(new Error("Archive failed"));
	show();
	fireEvent.click(await readyCreateButton());
	expect(await screen.findByText("Archive failed")).toBeInTheDocument();
});
test("retries an uncertain creation with the same identity", async () => {
	api.create
		.mockRejectedValueOnce(new TypeError("Failed to fetch"))
		.mockResolvedValueOnce({});
	show();
	fireEvent.click(await readyCreateButton());
	fireEvent.click(
		await screen.findByRole("button", { name: "Retry creation" })
	);
	await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
	expect(api.create.mock.calls[1]?.[0]).toEqual(api.create.mock.calls[0]?.[0]);
});

test("reads the completed restore operation", async () => {
	api.operations.mockResolvedValue({
		operations: [
			{
				id: "op",
				kind: "restore",
				scopeSummary: "Restore archive",
				status: "completed",
				resultSummary: "Restored project ready",
				progressPercent: 100,
			},
		],
	});
	show();
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Restored project ready"
	);
});
test("locks the restore name and retries the same uncertain request", async () => {
	api.restore
		.mockRejectedValueOnce(new TypeError("Failed to fetch"))
		.mockResolvedValueOnce({ id: "op", status: "pending" });
	show();
	const name = await screen.findByLabelText("New project name");
	fireEvent.change(name, { target: { value: "Restored" } });
	fireEvent.click(screen.getByRole("button", { name: "Restore" }));
	const retry = await screen.findByRole("button", { name: "Retry restore" });
	expect(name).toBeDisabled();
	fireEvent.click(retry);
	await waitFor(() => expect(api.restore).toHaveBeenCalledTimes(2));
	expect(api.restore.mock.calls[1]?.[0]).toEqual(
		api.restore.mock.calls[0]?.[0]
	);
});

test("downloads the full portable archive and shows download errors", async () => {
	download
		.mockResolvedValueOnce(undefined)
		.mockRejectedValueOnce(new Error("Archive integrity verification failed"));
	show();
	fireEvent.click(
		await screen.findByRole("button", { name: "Download Project Archive" })
	);
	await waitFor(() =>
		expect(download).toHaveBeenCalledWith("project", "archive")
	);
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Download Project Archive" })
		).not.toBeDisabled()
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Download Project Archive" })
	);
	expect(
		await screen.findByText("Archive integrity verification failed")
	).toBeVisible();
});

test("selected available working files are sent with archive creation", async () => {
	api.create.mockResolvedValue({});
	show();
	expect(
		await screen.findByRole("checkbox", { name: unavailableFileLabel })
	).toHaveAttribute("aria-disabled", "true");
	fireEvent.click(await screen.findByRole("checkbox", { name: heroFileLabel }));
	fireEvent.click(
		screen.getByRole("button", { name: "Create Project Archive" })
	);
	await waitFor(() =>
		expect(api.create).toHaveBeenCalledWith(
			expect.objectContaining({ workingFileIds: ["snapshot-1"] }),
			expect.anything()
		)
	);
});

test("creation waits for the working-file catalog", async () => {
	api.workingFiles.mockImplementationOnce(
		() =>
			new Promise(() => {
				/* catalog intentionally remains pending */
			})
	);
	show();
	expect(
		await screen.findByRole("button", { name: "Create Project Archive" })
	).toBeDisabled();
	expect(screen.getByText("Loading working files…")).toBeVisible();
	expect(api.create).not.toHaveBeenCalled();
});
