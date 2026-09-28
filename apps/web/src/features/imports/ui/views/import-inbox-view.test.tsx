// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { ImportInboxView } from "./import-inbox-view";

const projectId = "2f467c8e-bd77-4aec-855f-52f10cb2d60b";
const entryId = "d09499d0-90f5-4b16-9177-ec86c424c68e";
const fakeApi = vi.hoisted(() => ({
	entries: [] as Record<string, unknown>[],
	fetch: vi.fn(),
}));
const unresolvedStatusPattern = /İlişkilendirme bekliyor/;
const uncertainUploadPattern = /Yükleme sonucu doğrulanamadı/;
const supportReferencePattern = /Destek Referansı:/;

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

	await screen.findByText("Henüz ilişkilendirme bekleyen dosya yok.");
	const file = new File(
		[new Uint8Array([65, 83, 69, 80, 82, 73, 84, 69])],
		"hero source.aseprite",
		{ type: "application/octet-stream" }
	);
	fireEvent.change(screen.getByLabelText("Dosyalar"), {
		target: { files: [file] },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Dosyaları Gelen Kutusuna Al" })
	);

	expect(await screen.findByText("hero source.aseprite")).toBeInTheDocument();
	expect(screen.getByText(unresolvedStatusPattern)).toBeInTheDocument();
	expect(screen.getByRole("link", { name: "Dosyayı indir" })).toHaveAttribute(
		"href",
		"http://localhost:3000/api/projects/" +
			projectId +
			"/import-inbox/" +
			entryId +
			"/file"
	);
	await waitFor(() => expect(fakeApi.fetch).toHaveBeenCalledTimes(3));
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

	await screen.findByText("Henüz ilişkilendirme bekleyen dosya yok.");
	const file = new File([], "empty source.aseprite", {
		type: "application/octet-stream",
	});
	fireEvent.change(screen.getByLabelText("Dosyalar"), {
		target: { files: [file] },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Dosyaları Gelen Kutusuna Al" })
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
	await screen.findByText("Henüz ilişkilendirme bekleyen dosya yok.");
	const file = new File(
		[new Uint8Array([65, 83, 69, 80, 82, 73, 84, 69])],
		"hero source.aseprite",
		{ type: "application/octet-stream" }
	);
	fireEvent.change(screen.getByLabelText("Dosyalar"), {
		target: { files: [file] },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Dosyaları Gelen Kutusuna Al" })
	);

	expect(await screen.findByText(uncertainUploadPattern)).toBeInTheDocument();
	expect(
		screen.getByText(`Destek Referansı: ${supportReference}`)
	).toBeInTheDocument();
	expect(await screen.findByText("hero source.aseprite")).toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Dosyaları Gelen Kutusuna Al" })
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
	await screen.findByText("Henüz ilişkilendirme bekleyen dosya yok.");
	const file = new File(
		[new Uint8Array([65, 83, 69, 80, 82, 73, 84, 69])],
		"hero source.aseprite",
		{ type: "application/octet-stream" }
	);
	fireEvent.change(screen.getByLabelText("Dosyalar"), {
		target: { files: [file] },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Dosyaları Gelen Kutusuna Al" })
	);

	expect(await screen.findByText(uncertainUploadPattern)).toBeInTheDocument();
	expect(screen.queryByText(supportReferencePattern)).not.toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Dosyaları Gelen Kutusuna Al" })
	).toBeDisabled();
});

test("shows the support reference for a failed inbox read and retries the query", async () => {
	const supportReference = "SUP-00000000-0000-4000-8000-000000000000";
	let readCount = 0;
	fakeApi.fetch.mockImplementation(
		(_input: RequestInfo | URL, init?: RequestInit) => {
			if (init?.method === "POST") {
				throw new Error("Unexpected upload");
			}
			readCount += 1;
			if (readCount === 1) {
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

	expect(
		await screen.findByText("Gelen kutusu yüklenemedi.")
	).toBeInTheDocument();
	expect(
		screen.getByText(`Destek Referansı: ${supportReference}`)
	).toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Yeniden dene" }));
	expect(
		await screen.findByText("Henüz ilişkilendirme bekleyen dosya yok.")
	).toBeInTheDocument();
	expect(readCount).toBe(2);
});
