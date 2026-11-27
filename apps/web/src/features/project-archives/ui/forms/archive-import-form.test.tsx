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
import { ArchiveImportForm } from "./archive-import-form";

const upload = vi.hoisted(() => vi.fn());
vi.mock("../../lib/upload-project-archive", () => ({
	uploadProjectArchive: upload,
}));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		backgroundOperations: {
			list: {
				queryOptions: ({ input }: { input: { projectId: string } }) => ({
					queryKey: ["operations", input.projectId],
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	upload.mockReset();
});

function submitArchive() {
	const client = new QueryClient();
	const scope = ["operations", "project"];
	const otherScope = ["operations", "other"];
	client.setQueryData(scope, { operations: [] });
	client.setQueryData(otherScope, { operations: [] });
	render(
		<QueryClientProvider client={client}>
			<ArchiveImportForm projectId="project" />
		</QueryClientProvider>
	);
	fireEvent.change(screen.getByLabelText("Project Archive ZIP"), {
		target: { files: [new File(["archive"], "project.zip")] },
	});
	fireEvent.change(screen.getByLabelText("Restored project name"), {
		target: { value: "Restored" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Upload and restore" }));
	return { client, scope, otherScope };
}

test("an accepted ZIP restore refreshes only the operation list for its project", async () => {
	upload.mockResolvedValue({ id: "accepted" });
	const { client, scope, otherScope } = submitArchive();
	await screen.findByText(
		"Restore requested. Follow its progress in Background Operations."
	);
	expect(client.getQueryState(scope)?.isInvalidated).toBe(true);
	expect(client.getQueryState(otherScope)?.isInvalidated).toBe(false);
});

test("a rejected ZIP does not invalidate operation lists", async () => {
	upload.mockRejectedValue(
		Object.assign(new Error("Invalid ZIP"), { status: 400 })
	);
	const { client, scope } = submitArchive();
	await screen.findByText("Invalid ZIP");
	expect(client.getQueryState(scope)?.isInvalidated).toBe(false);
});

test("uploads a portable ZIP and retries an unknown outcome with the same file and key", async () => {
	const error = Object.assign(new Error("Connection lost"), { status: 500 });
	upload
		.mockRejectedValueOnce(error)
		.mockResolvedValueOnce({ id: "operation", status: "pending" });
	const accepted = vi.fn();
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { mutations: { retry: false } } })
			}
		>
			<ArchiveImportForm onAccepted={accepted} projectId="project" />
		</QueryClientProvider>
	);
	const file = new File(["archive"], "project.zip", {
		type: "application/zip",
	});
	fireEvent.change(screen.getByLabelText("Project Archive ZIP"), {
		target: { files: [file] },
	});
	fireEvent.change(screen.getByLabelText("Restored project name"), {
		target: { value: "Restored world" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Upload and restore" }));
	await waitFor(() => expect(upload).toHaveBeenCalledOnce());
	expect(
		await screen.findByText(
			"The upload outcome is unknown. Retry the same archive and request."
		)
	).toBeVisible();
	expect(screen.getByLabelText("Restored project name")).toBeDisabled();
	fireEvent.click(screen.getByRole("button", { name: "Retry archive import" }));
	await waitFor(() => expect(accepted).toHaveBeenCalledOnce());
	expect(upload.mock.calls[1]?.[0]).toEqual(upload.mock.calls[0]?.[0]);
	expect(upload.mock.calls[0]?.[0]).toMatchObject({
		projectId: "project",
		file,
		name: "Restored world",
	});
	expect(
		await screen.findByText(
			"Restore requested. Follow its progress in Background Operations."
		)
	).toBeVisible();
});

test("explains missing archive/name without sending a request", async () => {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ArchiveImportForm projectId="project" />
		</QueryClientProvider>
	);
	fireEvent.click(screen.getByRole("button", { name: "Upload and restore" }));
	expect(
		await screen.findByText(
			"Choose a non-empty ZIP and enter a project name (up to 120 characters)."
		)
	).toBeVisible();
	expect(upload).not.toHaveBeenCalled();
});
