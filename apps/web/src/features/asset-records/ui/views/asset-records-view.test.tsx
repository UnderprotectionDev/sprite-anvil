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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { AssetRecordDetailView, AssetRecordsView } from "./asset-records-view";

const projectId = "c2edb5dc-a82f-42b2-84bb-a878ca20fabf";
const identityCheckboxName = /^Bağımsız ürün anlamı/;
const fileBoundaryCopy =
	/dosya veya düzenlenebilir kare olması tek başına yeni kayıt gerekçesi değildir/i;
const generalSupportCopy = "Genel Varlık Desteği · Özel profil kanıtı yok";
const productionHistoryCopy = "Henüz üretim geçmişi yok.";
const recordCreatedCopy = /Kayıt oluşturuldu/;
const assetRecord = {
	availability: "active" as const,
	createdAt: "2026-09-25T08:00:00.000Z",
	id: "7ea123f0-2bd0-4b38-ab57-29477a1366e6",
	identityCriteria: ["independent_product_meaning"] as const,
	name: "Ash Knight",
	projectId,
	supportLevel: "general" as const,
};

const fakeApi = vi.hoisted(() => ({
	create: vi.fn(),
	record: null as
		| (Omit<typeof assetRecord, "availability"> & {
				availability: "active" | "archived" | "erased";
		  })
		| null,
	records: [] as (typeof assetRecord)[],
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		assetRecords: {
			create: (input: unknown) => fakeApi.create(input),
		},
	},
	orpc: {
		assetRecords: {
			get: {
				queryOptions: () => ({
					queryKey: ["asset-record", assetRecord.id],
					queryFn: async () => fakeApi.record ?? assetRecord,
				}),
			},
			list: {
				queryOptions: () => ({
					queryKey: ["asset-records", projectId],
					queryFn: async () => fakeApi.records,
				}),
			},
		},
		projects: {
			get: {
				queryOptions: () => ({
					queryKey: ["project", projectId],
					queryFn: async () => ({ id: projectId, name: "Forest Quest" }),
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.records = [];
	fakeApi.record = null;
	fakeApi.create.mockReset();
});

function renderWithQueryClient(node: React.ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
	);
}

test("creates a durable Asset Record from its independent product identity", async () => {
	const onOpenRecord = vi.fn();
	fakeApi.create.mockResolvedValue(assetRecord);
	renderWithQueryClient(
		<AssetRecordsView onOpenRecord={onOpenRecord} projectId={projectId} />
	);

	await screen.findByRole("heading", { name: "Forest Quest" });
	fireEvent.change(screen.getByLabelText("Varlık adı"), {
		target: { value: "Ash Knight" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: identityCheckboxName }));
	fireEvent.click(screen.getByRole("button", { name: "Varlık kaydı oluştur" }));

	await waitFor(() =>
		expect(onOpenRecord).toHaveBeenCalledWith(assetRecord.id)
	);
	expect(fakeApi.create).toHaveBeenCalledWith({
		id: expect.any(String),
		identityCriteria: ["independent_product_meaning"],
		name: "Ash Knight",
		projectId,
	});
	expect(screen.getByText(fileBoundaryCopy)).toBeVisible();
});

test("uncertain creates require a confirmed list check and reuse the same identity", async () => {
	const onOpenRecord = vi.fn();
	fakeApi.create
		.mockRejectedValueOnce(new TypeError("Failed to fetch"))
		.mockResolvedValueOnce(assetRecord);
	renderWithQueryClient(
		<AssetRecordsView onOpenRecord={onOpenRecord} projectId={projectId} />
	);

	await screen.findByRole("heading", { name: "Forest Quest" });
	fireEvent.change(screen.getByLabelText("Varlık adı"), {
		target: { value: "Ash Knight" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: identityCheckboxName }));
	fireEvent.click(screen.getByRole("button", { name: "Varlık kaydı oluştur" }));

	const identity = fakeApi.create.mock.calls[0]?.[0].id;
	expect(await screen.findByRole("alert")).toBeVisible();
	expect(
		screen.getByRole("button", { name: "Varlık kaydı oluştur" })
	).toBeDisabled();
	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Varlık kaydı oluştur" })
		).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Varlık kaydı oluştur" }));

	await waitFor(() =>
		expect(onOpenRecord).toHaveBeenCalledWith(assetRecord.id)
	);
	expect(fakeApi.create.mock.calls[1]?.[0].id).toBe(identity);
});

test("shows the tracking areas on the Asset Record without inventing evidence", async () => {
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	expect(
		await screen.findByRole("heading", { name: "Ash Knight" })
	).toBeVisible();
	for (const [title, emptyState] of [
		["Onaylı sürüm", "Henüz onaylı sürüm yok."],
		["Alternatifler", "Henüz alternatif sürüm yok."],
		["Türetilmiş varlıklar", "Bu kayda bağlı türetilmiş varlık yok."],
		["Referanslar", "Kayıtlı referans yok."],
		[
			"Kalite",
			"Değerlendirilmedi. Genel Varlık Desteği özel profil kanıtı üretmez.",
		],
	] as const) {
		const section = screen.getByRole("heading", { name: title }).parentElement;
		expect(section).not.toBeNull();
		expect(within(section as HTMLElement).getByText(emptyState)).toBeVisible();
	}
	expect(screen.getByText(generalSupportCopy)).toBeVisible();
	const productionHistory = screen.getByRole("heading", {
		name: "Üretim geçmişi",
	}).parentElement;
	expect(
		within(productionHistory as HTMLElement).getByText(productionHistoryCopy)
	).toBeVisible();
	expect(screen.getByText(recordCreatedCopy)).toBeVisible();
});

test("uses the canonical Erased availability value and Turkish label", async () => {
	fakeApi.record = { ...assetRecord, availability: "erased" };
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	expect(await screen.findByText("Silinmiş")).toBeVisible();
});
