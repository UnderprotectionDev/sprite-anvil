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
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { ImportInboxView } from "./import-inbox-view";

const projectId = "2f467c8e-bd77-4aec-855f-52f10cb2d60b";
const entryId = "d09499d0-90f5-4b16-9177-ec86c424c68e";
const sidecarEntryId = "7f66826f-e349-4c22-a281-fbf3fd1d27a8";
const secondSidecarEntryId = "4ea102e6-77db-453b-ab97-a8bc50f64c0d";
const fakeApi = vi.hoisted(() => ({
	entries: [] as Record<string, unknown>[],
	fetch: vi.fn(),
}));
const unresolvedStatusPattern = /İlişkilendirme bekliyor/;
const uncertainUploadPattern = /Yükleme sonucu doğrulanamadı/;
const supportReferencePattern = /Destek Referansı:/;
const opaqueSidecarPattern = /opaque-sidecar/;
const textureMetadataPattern = /texture-metadata/;
const pivotProposalPattern = /Pivot · walk\.png/;
const pivotDecisionPattern = /Pivot · walk.png/;
const halfPivotPattern = /0\.5/;
const quarterPivotPattern = /0\.25/;

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
	fakeApi.fetch.mockImplementation(
		(input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith("/source-metadata-mapping-proposals")) {
				if (init?.method === "POST") {
					createInput = JSON.parse(String(init.body));
					savedProposals = [nextProposal, ...savedProposals];
					return new Response(JSON.stringify(nextProposal), { status: 201 });
				}
				return new Response(
					JSON.stringify(url.includes(`/${entryId}/`) ? savedProposals : []),
					{ status: 200 }
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

	await screen.findByText("opaque-sidecar");
	const sourcePanel = within(
		screen.getByRole("region", {
			name: "sheet.png için Kaynak Metadata Eşleme Önerisi",
		})
	);
	expect(
		sourcePanel.getByText(
			"En fazla 10 sidecar seçin. Her dosya 5 MiB, toplam boyut 8 MiB ile sınırlıdır."
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
			name: "Kaynak Metadata Eşleme Önerisi oluştur: sheet.png",
		})
	);
	expect(createInput).toEqual({
		sidecarEntryIds: [sidecarEntryId, secondSidecarEntryId],
	});
	await waitFor(() => expect(fakeApi.fetch).toHaveBeenCalledTimes(4));
	expect(screen.getByText("source-metadata-mapping/1.1.0")).toBeInTheDocument();
	expect(
		screen.getByText(
			"Varlık Ailesi bağlantısı: Bilinmiyor · kaynak kanıtı yok."
		)
	).toBeInTheDocument();
	expect(
		screen.getByText(
			"Gerekli Öğeler Listesi bağlantısı: Bilinmiyor · kaynak kanıtı yok."
		)
	).toBeInTheDocument();
	expect(
		screen.getByText("Oyun İçi Bilgiler: Bilinmiyor · proje bağlamı gerekli.")
	).toBeInTheDocument();
	expect(screen.getAllByText("Pivot · walk.png")).toHaveLength(2);
	expect(screen.getByText("Süre · walk.png")).toBeInTheDocument();
	expect(
		within(
			screen.getByRole("list", { name: "Önerilen kaynak alanları" })
		).getAllByText(pivotProposalPattern)
	).toHaveLength(2);
	expect(
		within(
			screen.getByRole("list", { name: "Önerilen kaynak alanları" })
		).getAllByText(halfPivotPattern)
	).toHaveLength(1);
	expect(
		within(
			screen.getByRole("list", { name: "Önerilen kaynak alanları" })
		).getAllByText(quarterPivotPattern)
	).toHaveLength(1);
	expect(screen.getByText("c".repeat(64))).toBeInTheDocument();
	expect(
		screen.getByText("1 alan çakışması var; öneri henüz kesinleşmedi.")
	).toBeInTheDocument();
	expect(screen.getAllByText("Çakışma")).toHaveLength(2);
	expect(
		screen.getByRole("combobox", { name: pivotDecisionPattern })
	).toHaveValue("");
	expect(
		screen.getByRole("button", {
			name: "Eşlemeyi kesinleştir ve Aday Sürüm oluştur",
		})
	).toBeDisabled();
	expect(fakeApi.fetch).toHaveBeenCalledWith(
		`http://localhost:3000/api/projects/${projectId}/import-inbox/${entryId}/source-metadata-mapping-proposals`,
		expect.objectContaining({ method: "POST" })
	);
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
			name: "Kaynak Metadata Eşleme Önerisi oluştur: sheet.png",
		})
	);
	expect(
		await screen.findByText("Önceki öneriye göre fark")
	).toBeInTheDocument();
	expect(
		screen.getByText("JSON sidecar kaynakları değişti.")
	).toBeInTheDocument();
	expect(screen.getByText("Değişti: Pivot · walk.png")).toBeInTheDocument();
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
			name: "Kaynak Metadata Eşleme Önerisi oluştur: sheet.png",
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
			name: "Güncel sözleşmeyle yeni öneri oluştur",
		})
	);
	await waitFor(() => expect(savedProposals).toHaveLength(4));
	expect(createInput).toEqual({
		sidecarEntryIds: [sidecarEntryId, secondSidecarEntryId],
	});
	expect(screen.getByText("source-metadata-mapping/1.0.0")).toBeInTheDocument();
});
