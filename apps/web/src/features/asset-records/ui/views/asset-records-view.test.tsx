// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
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
const recordCreatedCopy = /Kayıt oluşturuldu/;
const versionFileName = /ash-knight\.png/;
const alternativeFileName = /ash-knight-alt\.png/;
const derivativeName = /Ash Knight idle/;
const referenceName = /Skeleton Warrior/;
const referenceNote = /Use the stance only\./;
const productionSource = /Imported from the project archive/;
const productionEvidence = /Archive manifest entry/;
const userRelationshipLabel = /Ekipten alındı/;
const unknownHistory = /Geçmiş bilinmiyor/;
const emptyAssetRecordMeasurements = {
	atlasDimensions: { confirmed: null, proposal: null },
	cellDimensions: { confirmed: null, proposal: null },
	displayScale: { confirmed: null, proposal: null },
	logicalResolution: { confirmed: null, proposal: null },
	sourceImageDimensions: { confirmed: null, proposal: null },
	visibleContentBounds: { confirmed: null, proposal: null },
};
const fractionalScaleWarning =
	/Piksel sanatında doğal sayı olmayan Gösterim Ölçeği/;
const illustrationScaleHint =
	/Yüksek çözünürlüklü illüstrasyonlar bu kurala zorlanmaz/;
const assetRecord = {
	availability: "active" as const,
	createdAt: "2026-09-25T08:00:00.000Z",
	id: "7ea123f0-2bd0-4b38-ab57-29477a1366e6",
	identityCriteria: ["independent_product_meaning"] as const,
	measurements: emptyAssetRecordMeasurements,
	name: "Ash Knight",
	projectId,
	supportLevel: "general" as const,
};
type TestAssetRecord = Omit<
	typeof assetRecord,
	"availability" | "identityCriteria"
> & {
	availability: "active" | "archived" | "erased";
	identityCriteria: readonly string[];
};

const fakeApi = vi.hoisted(() => ({
	create: vi.fn(),
	detail: null as Record<string, unknown> | null,
	measurements: null as Record<string, unknown> | null,
	record: null as TestAssetRecord | null,
	records: [] as TestAssetRecord[],
	updateMeasurements: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		assetRecords: {
			create: (input: unknown) => fakeApi.create(input),
			updateMeasurements: (input: unknown) => fakeApi.updateMeasurements(input),
		},
	},
	orpc: {
		assetRecords: {
			tracking: {
				queryOptions: () => ({
					queryKey: ["asset-record-detail", assetRecord.id],
					queryFn: async () =>
						fakeApi.detail ?? {
							record: fakeApi.record ?? {
								...assetRecord,
								measurements:
									fakeApi.measurements ?? emptyAssetRecordMeasurements,
							},
							tracking: {
								availableRecords: [],
								availableVersions: [],
								approvedVersion: null,
								alternatives: [],
								derivatives: [],
								family: null,
								productionHistory: [],
								quality: {
									integrityStatus: "unavailable",
									profileStatus: "general_support",
									verifiedVersionCount: 0,
								},
								references: [],
								reviewEvents: [],
								visualWorlds: [],
							},
						},
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
	fakeApi.detail = null;
	fakeApi.measurements = null;
	fakeApi.create.mockReset();
	fakeApi.updateMeasurements.mockReset();
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

test("shows persisted versions, derivatives, references, quality, and provenance", async () => {
	fakeApi.detail = {
		record: assetRecord,
		tracking: {
			availableRecords: [],
			availableVersions: [],
			approvedVersion: {
				createdAt: "2026-09-25T08:01:00.000Z",
				fileName: "ash-knight.png",
				id: "f7b32d26-6b7c-4e16-a578-dac3e0dab68b",
				reviewDisposition: "approved",
				sha256: "a".repeat(64),
				versionNumber: 1,
			},
			alternatives: [
				{
					createdAt: "2026-09-25T08:02:00.000Z",
					fileName: "ash-knight-alt.png",
					id: "e14f4bcc-5e5d-4fb7-b976-c0980934fa21",
					reviewDisposition: "candidate",
					sha256: "b".repeat(64),
					versionNumber: 2,
				},
			],
			derivatives: [
				{
					assetRecordId: "c9fcd87d-fec8-44ad-9fe1-96ef32648c87",
					assetRecordName: "Ash Knight idle",
					canonicalVersionId: "f7b32d26-6b7c-4e16-a578-dac3e0dab68b",
					dependencyFacets: ["identity", "timing"],
					familyStatus: "unassigned",
					id: "cfd0e95b-88f8-4932-b69b-a91f780720ab",
				},
			],
			references: [
				{
					assetRecordName: "Skeleton Warrior",
					conflictFeatures: [],
					forbiddenFeatures: ["identity"],
					id: "ba27998f-bd24-4a72-a13e-498a39f4e17d",
					notes: "Use the stance only.",
					role: "pose",
					transferredFeatures: ["pose"],
					versionId: "e1245d53-fb9c-4dd1-9c2b-6c66c5d488a8",
					versionNumber: 3,
				},
			],
			quality: {
				integrityStatus: "format_signature_matched",
				profileStatus: "general_support",
				verifiedVersionCount: 2,
			},
			productionHistory: [
				{
					createdAt: "2026-09-25T08:01:00.000Z",
					historyUnknown: true,
					id: "0f3c648b-0b67-4b05-9f94-7c2bcd940949",
					kind: "legacy_asset_attestation",
					knownSource: "Imported from the project archive",
					supportingEvidence: "Archive manifest entry.",
					userRelationship: "received_from_team",
					versionNumber: 1,
				},
			],
			reviewEvents: [],
			visualWorlds: [],
		},
	};
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	expect(
		await screen.findByRole("heading", { name: "Ash Knight" })
	).toBeVisible();
	expect(screen.getByText(versionFileName)).toBeVisible();
	expect(screen.getByText(alternativeFileName)).toBeVisible();
	expect(screen.getByText(derivativeName)).toBeVisible();
	expect(screen.getByText(referenceName)).toBeVisible();
	expect(screen.getByText(referenceNote)).toBeVisible();
	expect(
		screen.getByText("Dosya biçim imzası eşleşti (2 sürüm).")
	).toBeVisible();
	expect(screen.getByText(generalSupportCopy)).toBeVisible();
	expect(screen.getByText(productionSource)).toBeVisible();
	expect(screen.getByText(productionEvidence)).toBeVisible();
	expect(screen.getByText(userRelationshipLabel)).toBeVisible();
	expect(screen.getByText(unknownHistory)).toBeVisible();
	expect(screen.getByText(recordCreatedCopy)).toBeVisible();
});

test("saves proposed and confirmed dimensions independently on an Asset Record", async () => {
	fakeApi.updateMeasurements.mockImplementation((input) => {
		fakeApi.measurements = input.measurements;
		return { ...assetRecord, measurements: input.measurements };
	});
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	await screen.findByRole("heading", { name: "Ash Knight" });
	for (const heading of [
		"Kaynak Görsel Ölçüsü",
		"Mantıksal Çözünürlük",
		"Hücre Ölçüsü",
		"Görünür İçerik Sınırı",
		"Gösterim Ölçeği",
		"Atlas Ölçüsü",
	]) {
		expect(screen.getByRole("heading", { name: heading })).toBeVisible();
	}
	fireEvent.change(
		screen.getByLabelText("Kaynak Görsel Ölçüsü — Öneri — Genişlik (px)"),
		{ target: { value: "512" } }
	);
	fireEvent.change(
		screen.getByLabelText("Kaynak Görsel Ölçüsü — Öneri — Yükseklik (px)"),
		{ target: { value: "256" } }
	);
	fireEvent.change(
		screen.getByLabelText(
			"Mantıksal Çözünürlük — Doğrulanmış değer — Genişlik (px)"
		),
		{ target: { value: "72" } }
	);
	fireEvent.change(
		screen.getByLabelText(
			"Mantıksal Çözünürlük — Doğrulanmış değer — Yükseklik (px)"
		),
		{ target: { value: "80" } }
	);
	fireEvent.click(screen.getByRole("button", { name: "Ölçüleri kaydet" }));

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Ölçüler kaydedildi."
	);
	expect(fakeApi.updateMeasurements).toHaveBeenCalledWith({
		assetRecordId: assetRecord.id,
		measurements: {
			...emptyAssetRecordMeasurements,
			sourceImageDimensions: {
				confirmed: null,
				proposal: { width: 512, height: 256 },
			},
			logicalResolution: {
				confirmed: { width: 72, height: 80 },
				proposal: null,
			},
		},
		projectId,
	});
	await waitFor(() =>
		expect(
			screen.getByLabelText("Kaynak Görsel Ölçüsü — Öneri — Genişlik (px)")
		).toHaveValue(512)
	);
});

test("requires a complete pair when a dimension value is started", async () => {
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	await screen.findByRole("heading", { name: "Ash Knight" });
	const width = screen.getByLabelText(
		"Kaynak Görsel Ölçüsü — Öneri — Genişlik (px)"
	);
	const height = screen.getByLabelText(
		"Kaynak Görsel Ölçüsü — Öneri — Yükseklik (px)"
	);

	expect(width).not.toBeRequired();
	expect(height).not.toBeRequired();
	fireEvent.change(width, { target: { value: "512" } });
	expect(width).toBeRequired();
	expect(height).toBeRequired();
	expect(fakeApi.updateMeasurements).not.toHaveBeenCalled();
});

test("retains dimension inputs and offers retry context when saving fails", async () => {
	fakeApi.updateMeasurements.mockRejectedValue(new Error("write failed"));
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	await screen.findByRole("heading", { name: "Ash Knight" });
	const width = screen.getByLabelText(
		"Kaynak Görsel Ölçüsü — Öneri — Genişlik (px)"
	);
	fireEvent.change(width, { target: { value: "512" } });
	fireEvent.change(
		screen.getByLabelText("Kaynak Görsel Ölçüsü — Öneri — Yükseklik (px)"),
		{ target: { value: "256" } }
	);
	fireEvent.click(screen.getByRole("button", { name: "Ölçüleri kaydet" }));

	expect(await screen.findByRole("alert")).toBeVisible();
	expect(width).toHaveValue(512);
	expect(fakeApi.updateMeasurements).toHaveBeenCalledTimes(1);
});

test("shows a conditional crispness notice for fractional display scale", async () => {
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	await screen.findByRole("heading", { name: "Ash Knight" });
	fireEvent.change(screen.getByLabelText("Gösterim Ölçeği — Öneri — Ölçek"), {
		target: { value: "2.5" },
	});

	expect(screen.getByText(fractionalScaleWarning)).toBeVisible();
	expect(screen.getByText(illustrationScaleHint)).toBeVisible();
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

test("labels legacy Asset Records whose identity criteria were not recorded", async () => {
	fakeApi.record = { ...assetRecord, identityCriteria: [] };
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	expect(await screen.findByText("Gerekçe kaydedilmemiş")).toBeVisible();
});
