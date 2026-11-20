// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { ImportInboxView } from "./import-inbox-view";

const projectId = "2f467c8e-bd77-4aec-855f-52f10cb2d60b";
const entryId = "d09499d0-90f5-4b16-9177-ec86c424c68e";
const sidecarEntryId = "7f66826f-e349-4c22-a281-fbf3fd1d27a8";
const secondSidecarEntryId = "4ea102e6-77db-453b-ab97-a8bc50f64c0d";
const fakeApi = vi.hoisted(() => ({
	entries: [] as Record<string, unknown>[],
	fetch: vi.fn(),
	listEntries: vi.fn(),
	listProposals: vi.fn(),
	createProposal: vi.fn(),
}));
const unresolvedStatusPattern = /Awaiting linking/u;
const uncertainUploadPattern = /Could not verify the upload result/u;
const supportReferencePattern = /Support reference:/u;
const opaqueSidecarPattern = /opaque-sidecar/u;
const textureMetadataPattern = /texture-metadata/u;
const pivotProposalPattern = /Pivot · walk\.png/u;
const pivotDecisionPattern = /Pivot · walk.png/u;
const halfPivotPattern = /0\.5/u;
const quarterPivotPattern = /0\.25/u;
const changedPivotValuesPattern =
	/Changed: Pivot · walk\.png · .*"x":0\.5.* → .*"x":0\.75/u;

vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	// The oRPC utils pass a second options argument; forward the input only.
	const client = {
		assetFamilies: { list: async () => ({}) },
		imports: {
			listEntries: (input: unknown) => fakeApi.listEntries(input),
			listSourceMetadataMappingProposals: (input: unknown) =>
				fakeApi.listProposals(input),
			createSourceMetadataMappingProposal: (input: unknown) =>
				fakeApi.createProposal(input),
			getSourceMetadataMappingFinalization: async () => null,
			finalizeSourceMetadataMapping: () =>
				Promise.reject(new Error("Unexpected finalization")),
		},
	};
	return { client, orpc: createTanstackQueryUtils(client as never) };
});

vi.mock("@/env", () => ({
	ENV: { VITE_SERVER_URL: "http://localhost:3000" },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		Link: ({ children, to }: { children: ReactNode; to: string }) => (
			<a href={to}>{children}</a>
		),
	};
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	fakeApi.entries = [];
	fakeApi.fetch.mockReset();
	fakeApi.listEntries.mockReset();
	fakeApi.listProposals.mockReset();
	fakeApi.createProposal.mockReset();
});

beforeEach(() => {
	fakeApi.listEntries.mockImplementation(async () =>
		structuredClone(fakeApi.entries)
	);
	fakeApi.listProposals.mockResolvedValue([]);
});

test("clears the selected source files when the project changes", async () => {
	const queryClient = createQueryClient();
	const inbox = (id: string) => (
		<QueryClientProvider client={queryClient}>
			<ImportInboxView projectId={id} />
		</QueryClientProvider>
	);
	const { rerender } = render(inbox(projectId));
	const input = await screen.findByLabelText("Files");
	fireEvent.change(input, {
		target: { files: [new File([new Uint8Array([1])], "old-project.png")] },
	});
	expect(
		screen.getByRole("list", { name: "Selected files" })
	).toBeInTheDocument();
	rerender(inbox(crypto.randomUUID()));
	expect(screen.queryByRole("list", { name: "Selected files" })).toBeNull();
});

test("keeps the same upload ID for a file the server explicitly rejected", async () => {
	fakeApi.fetch.mockResolvedValue(new Response(null, { status: 400 }));
	vi.stubGlobal("fetch", fakeApi.fetch);
	render(
		<QueryClientProvider client={createQueryClient()}>
			<ImportInboxView projectId={projectId} />
		</QueryClientProvider>
	);
	fireEvent.change(await screen.findByLabelText("Files"), {
		target: { files: [new File([new Uint8Array([1])], "retry.png")] },
	});
	const submit = screen.getByRole("button", {
		name: "Add files to Import Inbox",
	});
	fireEvent.click(submit);
	await screen.findByRole("alert", { name: "Upload errors" });
	fireEvent.click(submit);
	await waitFor(() => expect(fakeApi.fetch).toHaveBeenCalledTimes(2));
	const [first, second] = fakeApi.fetch.mock.calls;
	expect(first?.[1]?.headers).toHaveProperty(
		"Idempotency-Key",
		expect.any(String)
	);
	expect(second?.[1]?.headers).toEqual(first?.[1]?.headers);
});

test("uploads a source file and shows the persisted unresolved Import Inbox Entry", async () => {
	fakeApi.fetch.mockImplementation(
		(_input: RequestInfo | URL, init?: RequestInit) => {
			if (init?.method === "POST") {
				const headers = init.headers as Record<string, string>;
				const file = init.body as File;
				const entry = {
					createdAt: "2026-09-28T09:00:00.000Z",
					contentLength: file.size,
					fileName: decodeURIComponent(headers["X-Import-Inbox-File-Name"]),
					id: entryId,
					projectId,
					sha256: "a".repeat(64),
					sourceContentType: headers["X-Import-Inbox-Source-Type"],
				};
				fakeApi.entries = [entry];
				return new Response(JSON.stringify(entry), { status: 201 });
			}
			return new Response(JSON.stringify(fakeApi.entries), { status: 200 });
		}
	);
	vi.stubGlobal("fetch", fakeApi.fetch);

	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ImportInboxView projectId={projectId} />
		</QueryClientProvider>
	);

	await screen.findByText("No files await linking yet.");
	const file = new File(
		[new Uint8Array([65, 83, 69, 80, 82, 73, 84, 69])],
		"hero source.aseprite",
		{ type: "application/octet-stream" }
	);
	fireEvent.change(screen.getByLabelText("Files"), {
		target: { files: [file] },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Add files to Import Inbox" })
	);

	expect(await screen.findByText("hero source.aseprite")).toBeInTheDocument();
	expect(screen.getByText(unresolvedStatusPattern)).toBeInTheDocument();
	fireEvent.click(screen.getByRole("tab", { name: "Pending files" }));
	expect(screen.getByRole("link", { name: "Download file" })).toHaveAttribute(
		"href",
		"http://localhost:3000/api/projects/" +
			projectId +
			"/import-inbox/" +
			entryId +
			"/file"
	);
	await waitFor(() => expect(fakeApi.listEntries).toHaveBeenCalledTimes(2));
	expect(fakeApi.fetch).toHaveBeenCalledTimes(1);
});

test("uploads and rereads an empty source file", async () => {
	fakeApi.fetch.mockImplementation(
		(_input: RequestInfo | URL, init?: RequestInit) => {
			if (init?.method === "POST") {
				const headers = init.headers as Record<string, string>;
				const file = init.body as File;
				const entry = {
					createdAt: "2026-09-28T09:00:00.000Z",
					contentLength: file.size,
					fileName: decodeURIComponent(headers["X-Import-Inbox-File-Name"]),
					id: entryId,
					projectId,
					sha256: "a".repeat(64),
					sourceContentType: headers["X-Import-Inbox-Source-Type"],
				};
				fakeApi.entries = [entry];
				return Promise.resolve(
					new Response(JSON.stringify(entry), { status: 201 })
				);
			}
			return Promise.resolve(
				new Response(JSON.stringify(fakeApi.entries), { status: 200 })
			);
		}
	);
	vi.stubGlobal("fetch", fakeApi.fetch);

	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ImportInboxView projectId={projectId} />
		</QueryClientProvider>
	);

	await screen.findByText("No files await linking yet.");
	const file = new File([], "empty source.aseprite", {
		type: "application/octet-stream",
	});
	fireEvent.change(screen.getByLabelText("Files"), {
		target: { files: [file] },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Add files to Import Inbox" })
	);

	expect(await screen.findByText("empty source.aseprite")).toBeInTheDocument();
	expect(screen.getByText("0 B")).toBeInTheDocument();
});

test("shows a support reference and checks the inbox after an uncertain server result", async () => {
	const supportReference = "SUP-00000000-0000-4000-8000-000000000000";
	let uploadCount = 0;
	fakeApi.fetch.mockImplementation(
		(_input: RequestInfo | URL, init?: RequestInit) => {
			if (init?.method === "POST") {
				uploadCount += 1;
				fakeApi.entries = [
					{
						createdAt: "2026-09-28T09:00:00.000Z",
						contentLength: 8,
						fileName: "hero source.aseprite",
						id: entryId,
						projectId,
						sha256: "a".repeat(64),
						sourceContentType: "application/octet-stream",
					},
				];
				return new Response(
					JSON.stringify({ error: "Internal Server Error", supportReference }),
					{ status: 500 }
				);
			}
			return new Response(JSON.stringify(fakeApi.entries), { status: 200 });
		}
	);
	vi.stubGlobal("fetch", fakeApi.fetch);

	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ImportInboxView projectId={projectId} />
		</QueryClientProvider>
	);
	await screen.findByText("No files await linking yet.");
	const file = new File(
		[new Uint8Array([65, 83, 69, 80, 82, 73, 84, 69])],
		"hero source.aseprite",
		{ type: "application/octet-stream" }
	);
	fireEvent.change(screen.getByLabelText("Files"), {
		target: { files: [file] },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Add files to Import Inbox" })
	);

	expect(await screen.findByText(uncertainUploadPattern)).toBeInTheDocument();
	expect(
		screen.getByText(`Support reference: ${supportReference}`)
	).toBeInTheDocument();
	expect(await screen.findByText("hero source.aseprite")).toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Add files to Import Inbox" })
	).toBeDisabled();
	expect(uploadCount).toBe(1);
});

test("does not retry an upload when the connection result is unknown", async () => {
	fakeApi.fetch.mockImplementation(
		(_input: RequestInfo | URL, init?: RequestInit) =>
			init?.method === "POST"
				? Promise.reject(new TypeError("Failed to fetch"))
				: Promise.resolve(new Response("[]", { status: 200 }))
	);
	vi.stubGlobal("fetch", fakeApi.fetch);

	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ImportInboxView projectId={projectId} />
		</QueryClientProvider>
	);
	await screen.findByText("No files await linking yet.");
	const file = new File(
		[new Uint8Array([65, 83, 69, 80, 82, 73, 84, 69])],
		"hero source.aseprite",
		{ type: "application/octet-stream" }
	);
	fireEvent.change(screen.getByLabelText("Files"), {
		target: { files: [file] },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Add files to Import Inbox" })
	);

	expect(await screen.findByText(uncertainUploadPattern)).toBeInTheDocument();
	expect(screen.queryByText(supportReferencePattern)).not.toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Add files to Import Inbox" })
	).toBeDisabled();
});

test("shows the support reference for a failed inbox read and retries the query", async () => {
	const supportReference = "SUP-00000000-0000-4000-8000-000000000000";
	let readCount = 0;
	fakeApi.listEntries.mockImplementation(() => {
		readCount += 1;
		if (readCount === 1) {
			return Promise.reject(
				new ORPCError("INTERNAL_SERVER_ERROR", {
					data: { supportReference },
				})
			);
		}
		return Promise.resolve(structuredClone(fakeApi.entries));
	});
	fakeApi.fetch.mockImplementation(() => {
		throw new Error("Unexpected upload");
	});
	vi.stubGlobal("fetch", fakeApi.fetch);

	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ImportInboxView projectId={projectId} />
		</QueryClientProvider>
	);

	expect(
		await screen.findByText("Could not load Import Inbox.")
	).toBeInTheDocument();
	expect(
		screen.getByText(`Support reference: ${supportReference}`)
	).toBeInTheDocument();
	fireEvent.click(screen.getByRole("tab", { name: "Pending files" }));
	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	expect(
		await screen.findByText("No files await linking yet.")
	).toBeInTheDocument();
	expect(readCount).toBe(2);
});

test("creates and rereads a source metadata proposal from explicitly selected sidecars", async () => {
	const sourceEntry = {
		createdAt: "2026-09-28T09:00:00.000Z",
		contentLength: 512,
		fileName: "sheet.png",
		id: entryId,
		projectId,
		sha256: "a".repeat(64),
		sourceContentType: "image/png",
	};
	const sidecarEntry = {
		createdAt: "2026-09-28T09:01:00.000Z",
		contentLength: 256,
		fileName: "opaque-sidecar",
		id: sidecarEntryId,
		projectId,
		sha256: "b".repeat(64),
		sourceContentType: "application/octet-stream",
	};
	const secondSidecarEntry = {
		createdAt: "2026-09-28T09:01:30.000Z",
		contentLength: 320,
		fileName: "texture-metadata",
		id: secondSidecarEntryId,
		projectId,
		sha256: "c".repeat(64),
		sourceContentType: "application/json",
	};
	const proposal = {
		contractVersion: "source-metadata-mapping/1.1.0",
		conflicts: [
			{
				candidates: [
					{
						field: "pivot",
						key: "walk.png",
						sourceEntryId: sidecarEntryId,
						sourceFileName: sidecarEntry.fileName,
						sourceFormat: "aseprite",
						sourcePath: "frames[0].pivot",
						value: { x: 0.5, y: 0.875 },
					},
					{
						field: "pivot",
						key: "walk.png",
						sourceEntryId: secondSidecarEntryId,
						sourceFileName: secondSidecarEntry.fileName,
						sourceFormat: "texture-packer",
						sourcePath: "frames.walk.png.pivot",
						value: { x: 0.25, y: 0.875 },
					},
				],
				field: "pivot",
				key: "walk.png",
			},
		],
		createdAt: "2026-09-28T09:02:00.000Z",
		diagnostics: [],
		fields: [
			{
				field: "pivot",
				key: "walk.png",
				sourceEntryId: sidecarEntryId,
				sourceFileName: sidecarEntry.fileName,
				sourceFormat: "aseprite",
				sourcePath: "frames[0].pivot",
				value: { x: 0.5, y: 0.875 },
			},
			{
				field: "pivot",
				key: "walk.png",
				sourceEntryId: secondSidecarEntryId,
				sourceFileName: secondSidecarEntry.fileName,
				sourceFormat: "texture-packer",
				sourcePath: "frames.walk.png.pivot",
				value: { x: 0.25, y: 0.875 },
			},
			{
				field: "duration",
				key: "walk.png",
				sourceEntryId: sidecarEntryId,
				sourceFileName: sidecarEntry.fileName,
				sourceFormat: "aseprite",
				sourcePath: "frames[0].duration",
				value: 100,
			},
		],
		id: "4b4a3a9d-fac0-40c7-8b72-3277308d01c4",
		projectId,
		suggestions: {
			assetFamilyLinks: {
				reason: "no-source-evidence",
				status: "unknown",
			},
			requiredSetLinks: {
				reason: "no-source-evidence",
				status: "unknown",
			},
			gameplayMetadata: {
				reason: "project-context-required",
				status: "unknown",
			},
		},
		sidecars: [
			{
				entryId: sidecarEntryId,
				fileName: sidecarEntry.fileName,
				format: "aseprite",
				jsonLayout: "array",
				sha256: sidecarEntry.sha256,
				version: "1.3",
			},
			{
				entryId: secondSidecarEntryId,
				fileName: secondSidecarEntry.fileName,
				format: "texture-packer",
				jsonLayout: "hash",
				sha256: secondSidecarEntry.sha256,
				version: "7.0",
			},
		],
		source: {
			entryId,
			fileName: sourceEntry.fileName,
			sha256: sourceEntry.sha256,
		},
	};
	let savedProposals: Record<string, unknown>[] = [];
	let nextProposal: Record<string, unknown> = proposal;
	let createInput: unknown;
	fakeApi.entries = [sourceEntry, sidecarEntry, secondSidecarEntry];
	fakeApi.listProposals.mockImplementation(
		async ({ entryId: listedEntryId }: { entryId: string }) =>
			listedEntryId === entryId ? savedProposals : []
	);
	fakeApi.createProposal.mockImplementation(({ input }: { input: unknown }) => {
		createInput = input;
		savedProposals = [nextProposal, ...savedProposals];
		return Promise.resolve(nextProposal);
	});
	vi.stubGlobal("fetch", fakeApi.fetch);

	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ImportInboxView projectId={projectId} />
		</QueryClientProvider>
	);

	await screen.findByText("opaque-sidecar");
	fireEvent.click(screen.getByRole("tab", { name: "Pending files" }));
	const sourcePanel = within(
		screen.getByRole("region", {
			name: "Source Metadata Mapping Proposal for sheet.png",
		})
	);
	expect(
		sourcePanel.getByText(
			"Select up to 10 sidecars. Each file is limited to 5 MiB and the total to 8 MiB."
		)
	).toBeInTheDocument();
	fireEvent.click(
		sourcePanel.getByRole("checkbox", { name: opaqueSidecarPattern })
	);
	fireEvent.click(
		sourcePanel.getByRole("checkbox", { name: textureMetadataPattern })
	);
	fireEvent.click(
		screen.getByRole("button", {
			name: "Create Source Metadata Mapping Proposal: sheet.png",
		})
	);
	await waitFor(() => expect(fakeApi.createProposal).toHaveBeenCalledTimes(1));
	expect(screen.getByText("source-metadata-mapping/1.1.0")).toBeInTheDocument();
	expect(
		screen.getByText("Asset Family link: Unknown · no source evidence.")
	).toBeInTheDocument();
	expect(
		screen.getByText("Required Set link: Unknown · no source evidence.")
	).toBeInTheDocument();
	expect(
		screen.getByText("Gameplay Metadata: Unknown · project context required.")
	).toBeInTheDocument();
	expect(screen.getAllByText("Pivot · walk.png")).toHaveLength(2);
	expect(screen.getByText("Duration · walk.png")).toBeInTheDocument();
	expect(
		within(
			screen.getByRole("list", { name: "Proposed source fields" })
		).getAllByText(pivotProposalPattern)
	).toHaveLength(2);
	expect(
		within(
			screen.getByRole("list", { name: "Proposed source fields" })
		).getAllByText(halfPivotPattern)
	).toHaveLength(1);
	expect(
		within(
			screen.getByRole("list", { name: "Proposed source fields" })
		).getAllByText(quarterPivotPattern)
	).toHaveLength(1);
	expect(screen.getByText("c".repeat(64))).toBeInTheDocument();
	expect(
		screen.getByText("Field conflicts: 1. The proposal is not finalized.")
	).toBeInTheDocument();
	expect(screen.getAllByText("Conflict")).toHaveLength(2);
	expect(
		screen.getByRole("combobox", { name: pivotDecisionPattern })
	).toHaveValue("");
	expect(
		screen.getByRole("button", {
			name: "Finalize mapping and create Candidate Version",
		})
	).toBeDisabled();
	expect(createInput).toEqual({
		sidecarEntryIds: [sidecarEntryId, secondSidecarEntryId],
	});
	expect(fakeApi.createProposal).toHaveBeenCalledWith({
		entryId,
		projectId,
		input: { sidecarEntryIds: [sidecarEntryId, secondSidecarEntryId] },
	});
	nextProposal = {
		...proposal,
		id: crypto.randomUUID(),
		createdAt: "2026-09-28T09:03:00.000Z",
		sidecars: proposal.sidecars.map((sidecar, index) =>
			index === 0 ? { ...sidecar, sha256: "d".repeat(64) } : sidecar
		),
		fields: proposal.fields.map((field, index) =>
			index === 0 ? { ...field, value: { x: 0.75, y: 0.875 } } : field
		),
	};
	fireEvent.click(
		screen.getByRole("button", {
			name: "Create Source Metadata Mapping Proposal: sheet.png",
		})
	);
	expect(
		await screen.findByText("Changes since previous proposal")
	).toBeInTheDocument();
	expect(screen.getByText("JSON sidecar sources changed.")).toBeInTheDocument();
	expect(screen.getByText(changedPivotValuesPattern)).toBeInTheDocument();
	const legacyProposal = {
		...proposal,
		id: crypto.randomUUID(),
		contractVersion: "source-metadata-mapping/1.0.0",
		createdAt: "2026-09-28T09:04:00.000Z",
		fields: proposal.fields.filter((field) => field.field !== "duration"),
	};
	nextProposal = legacyProposal;
	fireEvent.click(
		screen.getByRole("button", {
			name: "Create Source Metadata Mapping Proposal: sheet.png",
		})
	);
	expect(
		await screen.findByText("source-metadata-mapping/1.0.0")
	).toBeInTheDocument();
	nextProposal = {
		...proposal,
		id: crypto.randomUUID(),
		createdAt: "2026-09-28T09:05:00.000Z",
	};
	fireEvent.click(
		screen.getByRole("button", {
			name: "Create proposal with current contract",
		})
	);
	await waitFor(() => expect(savedProposals).toHaveLength(4));
	expect(createInput).toEqual({
		sidecarEntryIds: [sidecarEntryId, secondSidecarEntryId],
	});
	expect(screen.getByText("source-metadata-mapping/1.0.0")).toBeInTheDocument();
});

test("requests a bounded Import Inbox page and loads older entries on demand", async () => {
	const firstPage = Array.from({ length: 40 }, (_, index) => ({
		id: crypto.randomUUID(),
		projectId,
		fileName: `Source ${index}.aseprite`,
		createdAt: "2026-09-28T09:00:00.000Z",
		contentLength: 10,
		sha256: "a".repeat(64),
		sourceContentType: "application/octet-stream",
	}));
	fakeApi.listEntries.mockResolvedValueOnce(firstPage);
	render(
		<QueryClientProvider client={createQueryClient()}>
			<ImportInboxView projectId={projectId} />
		</QueryClientProvider>
	);
	fireEvent.click(await screen.findByRole("tab", { name: "Pending files" }));
	const load = await screen.findByRole("button", {
		name: "Load older entries",
	});
	expect(fakeApi.listEntries).toHaveBeenLastCalledWith({
		projectId,
		pageSize: 40,
	});
	fireEvent.click(load);
	await waitFor(() =>
		expect(fakeApi.listEntries).toHaveBeenLastCalledWith({
			projectId,
			pageSize: 40,
			beforeId: firstPage.at(-1)?.id,
		})
	);
});
