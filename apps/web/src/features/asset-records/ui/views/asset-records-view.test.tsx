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
const archivedRecordStatus = /Kayıt durumu · Arşivlenmiş/;
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
const assetRecord = {
	availability: "active" as const,
	createdAt: "2026-09-25T08:00:00.000Z",
	id: "7ea123f0-2bd0-4b38-ab57-29477a1366e6",
	identityCriteria: ["independent_product_meaning"] as const,
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
	archive: vi.fn(),
	create: vi.fn(),
	detail: null as Record<string, unknown> | null,
	record: null as TestAssetRecord | null,
	records: [] as TestAssetRecord[],
	restore: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		assetRecords: {
			archive: (input: unknown) => fakeApi.archive(input),
			create: (input: unknown) => fakeApi.create(input),
			restore: (input: unknown) => fakeApi.restore(input),
		},
	},
	orpc: {
		assetRecords: {
			tracking: {
				queryOptions: () => ({
					queryKey: ["asset-record-detail", assetRecord.id],
					queryFn: async () =>
						fakeApi.detail ?? {
							record: fakeApi.record ?? assetRecord,
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
	fakeApi.archive.mockReset();
	fakeApi.create.mockReset();
	fakeApi.restore.mockReset();
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

test("archived Asset Records remain findable in the project list", async () => {
	const onOpenRecord = vi.fn();
	fakeApi.records = [{ ...assetRecord, availability: "archived" }];
	renderWithQueryClient(
		<AssetRecordsView onOpenRecord={onOpenRecord} projectId={projectId} />
	);

	expect(await screen.findByText(archivedRecordStatus)).toBeVisible();
	fireEvent.click(
		screen.getByRole("button", { name: "Ash Knight kaydını aç" })
	);
	expect(onOpenRecord).toHaveBeenCalledWith(assetRecord.id);
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

test("uses the canonical Erased availability value and Turkish label", async () => {
	fakeApi.record = { ...assetRecord, availability: "erased" };
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	expect(await screen.findByText("Silinmiş")).toBeVisible();
	expect(
		screen.queryByRole("button", { name: "Kaydı arşivle" })
	).not.toBeInTheDocument();
	expect(
		screen.queryByRole("button", { name: "Kaydı yeniden etkinleştir" })
	).not.toBeInTheDocument();
});

test("archives and restores an Asset Record without losing its detail view", async () => {
	const archivedRecord = { ...assetRecord, availability: "archived" as const };
	fakeApi.archive.mockImplementation(() => {
		fakeApi.record = archivedRecord;
		return archivedRecord;
	});
	fakeApi.restore.mockImplementation(() => {
		fakeApi.record = assetRecord;
		return assetRecord;
	});
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	fireEvent.click(await screen.findByRole("button", { name: "Kaydı arşivle" }));
	expect(fakeApi.archive).toHaveBeenCalledWith({
		assetRecordId: assetRecord.id,
		projectId,
	});
	expect(await screen.findByText("Arşivlenmiş")).toBeVisible();
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Kayıt arşivlendi."
	);

	fireEvent.click(
		screen.getByRole("button", { name: "Kaydı yeniden etkinleştir" })
	);
	expect(fakeApi.restore).toHaveBeenCalledWith({
		assetRecordId: assetRecord.id,
		projectId,
	});
	expect(await screen.findByText("Etkin")).toBeVisible();
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Kayıt yeniden etkinleştirildi."
	);
});

test("checks the current Availability before allowing an uncertain archive retry", async () => {
	fakeApi.archive.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	fireEvent.click(await screen.findByRole("button", { name: "Kaydı arşivle" }));
	expect(await screen.findByRole("alert")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));

	expect(await screen.findByText("Güncel kayıt durumu: Etkin.")).toBeVisible();
	expect(screen.getByRole("button", { name: "Kaydı arşivle" })).toBeEnabled();
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
