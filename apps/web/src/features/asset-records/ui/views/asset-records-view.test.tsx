// @vitest-environment jsdom

import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
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
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { AssetRecordDetailView, AssetRecordsView } from "./asset-records-view";

const errorToast = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
	toast: { dismiss: vi.fn(), error: errorToast },
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

const projectId = "c2edb5dc-a82f-42b2-84bb-a878ca20fabf";
const identityCheckboxName = /^Bağımsız ürün anlamı/;
const archivedRecordStatus = /Kayıt durumu · Arşivlenmiş/;
const archivedPackageSummary = /Archived attack package/;
const fileBoundaryCopy =
	/dosya veya düzenlenebilir kare olması tek başına yeni kayıt gerekçesi değildir/i;
const generalSupportCopy = "Genel Varlık Desteği · Özel profil kanıtı yok";
const recordCreatedCopy = /Kayıt oluşturuldu/;
const versionFileName = /ash-knight\.png/;
const alternativeFileName = /ash-knight-alt\.png/;
const derivativeName = /Ash Knight idle/;
const referenceName = /Skeleton Warrior/;
const referenceNote = /Use the stance only\./;
const referenceHistoryRevision = /Revizyon 1/;
const productionSource = /Imported from the project archive/;
const productionEvidence = /Archive manifest entry/;
const userRelationshipLabel = /Ekipten alındı/;
const unknownHistory = /Geçmiş bilinmiyor/;
const attestationDateLabel = /Beyan tarihi:/;
const legacyAttestationCreatedAt = "2026-09-25T08:01:00.000Z";
const localizedLegacyAttestationDate = /^(?:24|25) Eyl 2026 \d{2}:\d{2}$/;
const unknownCanonicalVersion = /Ana Tasarım Sürümü kayıtlı değil/;
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
type TestAssetRecord = Omit<AssetRecord, "identityCriteria"> & {
	identityCriteria: readonly string[];
};

const fakeApi = vi.hoisted(() => ({
	archive: vi.fn(),
	create: vi.fn(),
	createVersion: vi.fn(),
	createReference: vi.fn(),
	createGenerationPackage: vi.fn(),
	generationPackages: [] as GenerationPackage[],
	detail: null as Record<string, unknown> | null,
	measurements: null as Record<string, unknown> | null,
	recordsError: null as Error | null,
	trackingError: null as Error | null,
	record: null as TestAssetRecord | null,
	records: [] as TestAssetRecord[],
	search: vi.fn(),
	searchResults: { records: [] as Record<string, unknown>[], totalCount: 0 },
	updateMetadata: vi.fn(),
	scopes: {
		themes: [] as Record<string, unknown>[],
		visualWorlds: [] as Record<string, unknown>[],
	},
	restore: vi.fn(),
	updateMeasurements: vi.fn(),
	referenceBoard: {
		assetVersionReferences: [],
		conflicts: [],
		effectiveForbiddenFeatures: [],
		effectiveTransferredFeatures: [],
		imageReferences: [],
	},
}));

vi.mock("@/env", () => ({
	ENV: { VITE_SERVER_URL: "https://app.example.test" },
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		assetRecords: {
			archive: (input: unknown) => fakeApi.archive(input),
			create: (input: unknown) => fakeApi.create(input),
			createVersion: (input: unknown) => fakeApi.createVersion(input),
			restore: (input: unknown) => fakeApi.restore(input),
			updateMetadata: (input: unknown) => fakeApi.updateMetadata(input),
			updateMeasurements: (input: unknown) => fakeApi.updateMeasurements(input),
			createReference: (input: unknown) => fakeApi.createReference(input),
		},
		generationPackages: {
			create: (input: unknown) => fakeApi.createGenerationPackage(input),
		},
	},
	orpc: {
		assetVersions: {
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["asset-versions", input],
					queryFn: async () => ({
						assetVersions: [],
						canonicalDesigns: [],
						compositeVersions: [],
						unitVersions: [],
					}),
				}),
			},
		},
		generationPackages: {
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["generation-packages", input],
					queryFn: async () => fakeApi.generationPackages,
				}),
			},
		},
		assetRecords: {
			search: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["asset-record-search", input],
					queryFn: () => fakeApi.search(input),
				}),
			},
			get: {
				queryOptions: () => ({
					queryKey: ["asset-record", assetRecord.id],
					queryFn: async () =>
						fakeApi.record ?? {
							...assetRecord,
							measurements:
								fakeApi.measurements ?? emptyAssetRecordMeasurements,
						},
				}),
			},
			tracking: {
				queryOptions: () => ({
					queryKey: ["asset-record-detail", assetRecord.id],
					queryFn: () => {
						if (fakeApi.trackingError) {
							return Promise.reject(fakeApi.trackingError);
						}
						return Promise.resolve(
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
									manualImportEvidenceRequiredVersionIds: [],
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
							}
						);
					},
				}),
			},
			list: {
				queryOptions: () => ({
					queryKey: ["asset-records", projectId],
					queryFn: () => {
						if (fakeApi.recordsError) {
							return Promise.reject(fakeApi.recordsError);
						}
						return Promise.resolve(fakeApi.records);
					},
				}),
			},
		},
		referenceProduction: {
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["reference-board", input],
					queryFn: async () => fakeApi.referenceBoard,
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
		contextScopes: {
			list: {
				queryOptions: () => ({
					queryKey: ["scope-catalog", projectId],
					queryFn: async () => fakeApi.scopes,
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.records = [];
	fakeApi.recordsError = null;
	errorToast.mockClear();
	fakeApi.record = null;
	fakeApi.detail = null;
	fakeApi.measurements = null;
	fakeApi.trackingError = null;
	fakeApi.archive.mockReset();
	fakeApi.create.mockReset();
	fakeApi.createVersion.mockReset();
	fakeApi.createReference.mockReset();
	fakeApi.createGenerationPackage.mockReset();
	fakeApi.generationPackages = [];
	fakeApi.restore.mockReset();
	fakeApi.updateMeasurements.mockReset();
	fakeApi.updateMetadata.mockReset();
	fakeApi.search.mockReset();
	fakeApi.searchResults = { records: [], totalCount: 0 };
	fakeApi.scopes = { themes: [], visualWorlds: [] };
});

beforeEach(() => {
	fakeApi.search
		.mockReset()
		.mockImplementation(() => Promise.resolve(fakeApi.searchResults));
});

function renderWithQueryClient(node: React.ReactNode) {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	return {
		...render(
			<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
		),
		queryClient,
	};
}

test("filters Asset Records together and opens the matching version history", async () => {
	const onOpenRecord = vi.fn();
	const visualWorldId = "ca6d5c68-621e-493b-a01f-2c28d5c4f3ab";
	const themeId = "6e04ac4f-b180-42e7-bcce-8a7a53643113";
	const versionId = "4433a630-c542-4fc7-89a8-2874df8ddaaa";
	fakeApi.scopes = {
		visualWorlds: [{ id: visualWorldId, name: "Gameplay", projectId }],
		themes: [
			{
				id: themeId,
				name: "Dark Castle",
				projectId,
				visualWorldId,
			},
		],
	};
	fakeApi.searchResults = {
		records: [
			{
				record: {
					...assetRecord,
					assetCategory: "icon",
					availability: "archived",
					tags: ["inventory"],
					themeId,
					visualWorldId,
				},
				matchingVersions: [
					{
						fileName: "ash-knight-icon.webp",
						id: versionId,
						sourceImageHeight: 48,
						sourceImageWidth: 32,
						versionNumber: 3,
					},
				],
			},
		],
		totalCount: 1,
	};
	fakeApi.search.mockResolvedValue(fakeApi.searchResults);
	renderWithQueryClient(
		<AssetRecordsView onOpenRecord={onOpenRecord} projectId={projectId} />
	);

	await screen.findByRole("heading", { name: "Forest Quest" });
	fireEvent.change(screen.getByLabelText("Ada göre ara"), {
		target: { value: "Ash" },
	});
	fireEvent.change(screen.getByLabelText("Varlık kategorisi"), {
		target: { value: "icon" },
	});
	fireEvent.change(screen.getByLabelText("Görsel Dünya"), {
		target: { value: visualWorldId },
	});
	fireEvent.change(screen.getByLabelText("Tema"), {
		target: { value: themeId },
	});
	fireEvent.change(screen.getByLabelText("Kaynak Görsel genişliği (px)"), {
		target: { value: "32" },
	});
	fireEvent.change(screen.getByLabelText("Kaynak Görsel yüksekliği (px)"), {
		target: { value: "48" },
	});
	fireEvent.change(screen.getByLabelText("Etiket"), {
		target: { value: "inventory" },
	});
	fireEvent.change(screen.getByLabelText("Kayıt durumu"), {
		target: { value: "archived" },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Varlık kayıtlarını ara" })
	);

	await waitFor(() =>
		expect(fakeApi.search).toHaveBeenLastCalledWith({
			assetCategory: "icon",
			availability: "archived",
			name: "Ash",
			projectId,
			sourceImageHeight: 48,
			sourceImageWidth: 32,
			tag: "inventory",
			themeId,
			visualWorldId,
		})
	);
	expect(
		await screen.findByText("ash-knight-icon.webp · Sürüm 3 · 32 × 48 px")
	).toBeVisible();
	fireEvent.click(
		screen.getByRole("button", {
			name: "ash-knight-icon.webp sürüm 3 geçmişini aç",
		})
	);
	expect(onOpenRecord).toHaveBeenCalledWith(assetRecord.id, versionId);
	fireEvent.click(
		screen.getByRole("button", { name: "Ash Knight kaydını aç" })
	);
	expect(onOpenRecord).toHaveBeenCalledWith(assetRecord.id);
});

test("opens a measured legacy version when its file name is unknown", async () => {
	const onOpenRecord = vi.fn();
	const versionId = "4433a630-c542-4fc7-89a8-2874df8ddaaa";
	fakeApi.searchResults = {
		records: [
			{
				record: assetRecord,
				matchingVersions: [
					{
						fileName: null,
						id: versionId,
						sourceImageHeight: 48,
						sourceImageWidth: 32,
						versionNumber: 3,
					},
				],
			},
		],
		totalCount: 1,
	};
	fakeApi.search.mockResolvedValue(fakeApi.searchResults);
	renderWithQueryClient(
		<AssetRecordsView onOpenRecord={onOpenRecord} projectId={projectId} />
	);

	await screen.findByRole("heading", { name: "Forest Quest" });
	fireEvent.click(
		screen.getByRole("button", { name: "Varlık kayıtlarını ara" })
	);
	expect(await screen.findByText("Sürüm 3 · 32 × 48 px")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "sürüm 3 geçmişini aç" }));
	expect(onOpenRecord).toHaveBeenCalledWith(assetRecord.id, versionId);
});

test("shows the Generation Package workflow on an active Asset Record", async () => {
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	expect(
		await screen.findByRole("heading", { name: "Üretim Paketleri" })
	).toBeVisible();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Üretim Paketini sabitle" })
		).toBeEnabled()
	);
});

test("shows saved Generation Packages on archived Asset Records without enabling creation", async () => {
	fakeApi.record = { ...assetRecord, availability: "archived" };
	fakeApi.generationPackages = [
		{
			assetRecord: {
				...assetRecord,
				availability: "archived",
				identityCriteria: [...assetRecord.identityCriteria],
			} as AssetRecord,
			assetRecordId: assetRecord.id,
			avoidConstraints: [],
			canonicalDesign: null,
			changeConstraints: [],
			createdAt: "2026-09-28T09:00:00.000Z",
			expectedOutputStructure: "A four-frame PNG sprite sheet.",
			id: "7b73a4c6-835a-49ed-a84d-f63440351d07",
			lockedUnits: [],
			preserveConstraints: [],
			productionContextSnapshot: {
				contextRevisionId: "60d3bf8c-1940-4c25-924f-b98122d5787f",
				generalArtDirection: "Readable silhouettes.",
				ruleContractVersion: "context-rule/1.0.0",
				rules: [],
				revisionNumber: 2,
				theme: null,
				visualWorld: null,
			},
			referenceRoles: [],
			projectId,
			targetDimensions: { height: 80, width: 72 },
			targetTask: "Archived attack package",
		} as GenerationPackage,
	];
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	expect(
		await screen.findByRole("heading", { name: "Üretim Paketleri" })
	).toBeVisible();
	expect(await screen.findByText(archivedPackageSummary)).toBeVisible();
	expect(
		screen.getByText(
			"Arşivlenmiş Varlık Kaydında yeni Üretim Paketi oluşturulamaz."
		)
	).toBeVisible();
	expect(
		screen.queryByRole("button", { name: "Üretim Paketini sabitle" })
	).not.toBeInTheDocument();
});

test("edits record metadata and limits Theme choices to the selected Visual World", async () => {
	const visualWorldId = "ca6d5c68-621e-493b-a01f-2c28d5c4f3ab";
	const unrelatedWorldId = "da6d5c68-621e-493b-a01f-2c28d5c4f3ab";
	const themeId = "6e04ac4f-b180-42e7-bcce-8a7a53643113";
	fakeApi.scopes = {
		visualWorlds: [
			{ id: visualWorldId, name: "Gameplay", projectId },
			{ id: unrelatedWorldId, name: "Marketing", projectId },
		],
		themes: [
			{ id: themeId, name: "Dark Castle", projectId, visualWorldId },
			{
				id: "7e04ac4f-b180-42e7-bcce-8a7a53643113",
				name: "Store Banner",
				projectId,
				visualWorldId: unrelatedWorldId,
			},
		],
	};
	fakeApi.updateMetadata.mockResolvedValue({
		...assetRecord,
		assetCategory: "icon",
		tags: ["inventory"],
		themeId,
		visualWorldId,
	});
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	await screen.findByRole("heading", { name: "Ash Knight" });
	fireEvent.change(screen.getByLabelText("Varlık kategorisi"), {
		target: { value: "icon" },
	});
	fireEvent.change(screen.getByLabelText("Görsel Dünya"), {
		target: { value: visualWorldId },
	});
	const themeSelect = screen.getByLabelText("Tema", { selector: "select" });
	expect(themeSelect).toHaveDisplayValue("Tema seçilmedi");
	expect(
		screen.getByRole("option", { name: "Dark Castle" })
	).toBeInTheDocument();
	expect(
		screen.queryByRole("option", { name: "Store Banner" })
	).not.toBeInTheDocument();
	fireEvent.change(themeSelect, { target: { value: themeId } });
	fireEvent.change(screen.getByLabelText("Etiketler"), {
		target: { value: "inventory" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Metadata’yı kaydet" }));

	await waitFor(() =>
		expect(fakeApi.updateMetadata).toHaveBeenCalledWith({
			assetCategory: "icon",
			assetRecordId: assetRecord.id,
			projectId,
			tags: ["inventory"],
			themeId,
			visualWorldId,
		})
	);
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Varlık kaydı metadata’sı kaydedildi."
	);
});

test("shows a failed Asset Record list load only in Sonner", async () => {
	fakeApi.recordsError = Object.assign(new Error("Internal server error"), {
		code: "INTERNAL_SERVER_ERROR",
		data: { supportReference: "SUP-7CFB1C3A-A7A3-4BC2-B748-B5065AA2314A" },
	});
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<AssetRecordsView onOpenRecord={vi.fn()} projectId={projectId} />
		</QueryClientProvider>
	);

	await waitFor(() => expect(errorToast).toHaveBeenCalledTimes(1));
	expect(errorToast.mock.calls[0]?.[0]).toBe("Data could not be loaded.");
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	expect(
		screen.queryByRole("button", { name: "Retry" })
	).not.toBeInTheDocument();
	const options = errorToast.mock.calls[0]?.[1] as {
		action: { label: string; onClick: () => void };
	};
	expect(options.action.label).toBe("Retry");
	fakeApi.recordsError = null;
	fakeApi.records = [assetRecord];
	options.action.onClick();
	expect(await screen.findByText("Ash Knight")).toBeVisible();
});

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
	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
					contextOverrideRationale: null,
					customPurpose: null,
					forbiddenFeatures: ["identity"],
					history: [
						{
							contextOverrideRationale: null,
							customPurpose: null,
							forbiddenFeatures: ["identity"],
							notes: "Use the stance only.",
							recordedAt: "2026-09-25T08:03:00.000Z",
							revision: 1,
							role: "pose",
							transferredFeatures: ["pose"],
						},
					],
					id: "ba27998f-bd24-4a72-a13e-498a39f4e17d",
					notes: "Use the stance only.",
					revision: 1,
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
					createdAt: legacyAttestationCreatedAt,
					historyUnknown: true,
					id: "0f3c648b-0b67-4b05-9f94-7c2bcd940949",
					kind: "legacy_asset_attestation",
					knownSource: "Imported from the project archive",
					supportingEvidence: "Archive manifest entry.",
					unknownHistoryDetails:
						"The original generation instruction is unavailable.",
					userRelationship: "received_from_team",
					versionNumber: 1,
				},
			],
			manualImportEvidenceRequiredVersionIds: [],
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
	expect(await screen.findByText(versionFileName)).toBeVisible();
	expect(screen.getByText(alternativeFileName)).toBeVisible();
	expect(screen.getByText(derivativeName)).toBeVisible();
	expect(screen.getByText(referenceName)).toBeVisible();
	expect(
		screen
			.getAllByText(referenceNote)
			.some((element) => element.tagName === "P")
	).toBe(true);
	fireEvent.click(screen.getByText("Kural geçmişi"));
	const historyDisclosure = screen
		.getByText("Kural geçmişi")
		.closest("details");
	if (!historyDisclosure) {
		throw new Error("Reference history disclosure was not rendered");
	}
	expect(
		within(historyDisclosure).getByText(referenceHistoryRevision)
	).toBeVisible();
	expect(
		screen.getByText("Dosya biçim imzası eşleşti (2 sürüm).")
	).toBeVisible();
	expect(screen.getByText(generalSupportCopy)).toBeVisible();
	expect(screen.getByText(productionSource)).toBeVisible();
	expect(screen.getByText(productionEvidence)).toBeVisible();
	expect(
		screen.getByText(
			"Bilinmeyen üretim geçmişi: The original generation instruction is unavailable."
		)
	).toBeVisible();
	const attestationTime = screen
		.getByText(attestationDateLabel)
		.querySelector("time");
	expect(attestationTime).toHaveAttribute(
		"dateTime",
		legacyAttestationCreatedAt
	);
	expect(attestationTime).toHaveTextContent(localizedLegacyAttestationDate);
	expect(screen.getByText(userRelationshipLabel)).toBeVisible();
	expect(screen.getByText(unknownHistory)).toBeVisible();
	expect(screen.getByText(recordCreatedCopy)).toBeVisible();
});

test("records the user's missing legacy history details with the asset version", async () => {
	fakeApi.detail = {
		record: assetRecord,
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
	};
	fakeApi.createVersion.mockImplementation((value) => {
		const input = value as {
			assetRecordId: string;
			fileName: string;
			historyUnknown: true;
			id: string;
			knownSource: string | null;
			supportingEvidence: string | null;
			unknownHistoryDetails: string;
			userRelationship: string;
		};
		const detail = fakeApi.detail as {
			record: typeof assetRecord;
			tracking: Record<string, unknown> & {
				availableVersions: Record<string, unknown>[];
				productionHistory: Record<string, unknown>[];
			};
		};
		fakeApi.detail = {
			...detail,
			tracking: {
				...detail.tracking,
				availableVersions: [
					{
						assetRecordId: input.assetRecordId,
						assetRecordName: assetRecord.name,
						fileName: input.fileName,
						id: input.id,
						reviewDisposition: "candidate",
						versionNumber: 1,
					},
				],
				productionHistory: [
					{
						createdAt: legacyAttestationCreatedAt,
						historyUnknown: input.historyUnknown,
						id: "b1b9ae6d-c2c0-41d5-b9b9-c4acbfb83f90",
						kind: "legacy_asset_attestation",
						knownSource: input.knownSource,
						supportingEvidence: input.supportingEvidence,
						unknownHistoryDetails: input.unknownHistoryDetails,
						userRelationship: input.userRelationship,
						versionNumber: 1,
					},
				],
			},
		};
		return {
			createdAt: legacyAttestationCreatedAt,
			fileName: input.fileName,
			id: input.id,
			reviewDisposition: "candidate",
			sha256: "a".repeat(64),
			sourceImageHeight: 1,
			sourceImageWidth: 1,
			versionNumber: 1,
		};
	});

	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	await screen.findByRole("heading", { name: "Ash Knight" });
	await screen.findByRole("heading", { name: "Aday sürüm oluştur" });
	const uploadedFile = new File([new Uint8Array([1, 2, 3])], "legacy.png", {
		type: "image/png",
	});
	Object.defineProperty(uploadedFile, "arrayBuffer", {
		value: async () => new Uint8Array([1, 2, 3]).buffer,
	});

	fireEvent.change(screen.getByLabelText("PNG veya WebP dosyası"), {
		target: { files: [uploadedFile] },
	});
	fireEvent.change(screen.getByLabelText("Bilinen kaynak"), {
		target: { value: "Project archive" },
	});
	fireEvent.change(screen.getByLabelText("Varlıkla ilişkiniz"), {
		target: { value: "received_from_team" },
	});
	const unknownHistoryInput = screen.getByLabelText(
		"Bilinmeyen üretim geçmişi"
	);
	expect(unknownHistoryInput).toBeRequired();
	fireEvent.change(unknownHistoryInput, {
		target: { value: "The original generation instruction is unavailable." },
	});
	fireEvent.change(screen.getByLabelText("Destekleyici kanıt"), {
		target: { value: "The team archive manifest lists this image." },
	});
	const submitButton = screen.getByRole("button", {
		name: "Aday sürümü kaydet",
	});
	expect(submitButton).toBeEnabled();
	fireEvent.submit(submitButton.closest("form") as HTMLFormElement);
	await waitFor(() => expect(fakeApi.createVersion).toHaveBeenCalled());

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Aday Sürüm kaydedildi."
	);
	expect(fakeApi.createVersion).toHaveBeenCalledWith(
		expect.objectContaining({
			historyUnknown: true,
			knownSource: "Project archive",
			supportingEvidence: "The team archive manifest lists this image.",
			unknownHistoryDetails:
				"The original generation instruction is unavailable.",
			userRelationship: "received_from_team",
		})
	);
	expect(
		screen.getByText(
			"Bilinmeyen üretim geçmişi: The original generation instruction is unavailable."
		)
	).toBeVisible();
	const attestationTime = screen
		.getByText(attestationDateLabel)
		.querySelector("time");
	expect(attestationTime).toHaveAttribute(
		"dateTime",
		legacyAttestationCreatedAt
	);
	expect(attestationTime).toHaveTextContent(localizedLegacyAttestationDate);
});

test("keeps unrecorded legacy version details explicit without choosing a Canonical Design", async () => {
	fakeApi.detail = {
		record: assetRecord,
		tracking: {
			availableRecords: [],
			availableVersions: [],
			approvedVersion: {
				createdAt: "2026-09-25T08:01:00.000Z",
				fileName: null,
				id: "f7b32d26-6b7c-4e16-a578-dac3e0dab68b",
				reviewDisposition: "approved",
				sha256: null,
				versionNumber: 1,
			},
			alternatives: [],
			derivatives: [],
			family: {
				canonicalVersionId: null,
				id: "2e289929-ad8b-4b76-b7c5-e18b001d8214",
				name: "Ash Knight gameplay",
				useContext: "Combat sprite",
				visualWorldId: "742cbe57-ecb0-4616-8d1f-71723ad8cd62",
				visualWorldName: "Gameplay",
			},
			manualImportEvidenceRequiredVersionIds: [],
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
	};
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	expect(
		await screen.findByText("Dosya adı bilinmiyor · Sürüm 1")
	).toBeVisible();
	expect(screen.getByText(unknownCanonicalVersion)).toBeVisible();
	expect(
		screen.queryByLabelText("Türetilmiş Asset Record")
	).not.toBeInTheDocument();
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

test("requires a Visible Content Bounds coordinate space and keeps bounds inside it", async () => {
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

	for (const [label, value] of [
		["Mantıksal Çözünürlük — Öneri — Genişlik (px)", "32"],
		["Mantıksal Çözünürlük — Öneri — Yükseklik (px)", "32"],
		["Görünür İçerik Sınırı — Öneri — X (px)", "3"],
		["Görünür İçerik Sınırı — Öneri — Y (px)", "4"],
		["Görünür İçerik Sınırı — Öneri — Genişlik (px)", "30"],
		["Görünür İçerik Sınırı — Öneri — Yükseklik (px)", "10"],
	] as const) {
		fireEvent.change(screen.getByLabelText(label), { target: { value } });
	}
	const coordinateSpace = screen.getByLabelText(
		"Görünür İçerik Sınırı — Öneri — Koordinat temeli"
	);
	fireEvent.change(coordinateSpace, {
		target: { value: "logicalResolution" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Ölçüleri kaydet" }));

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Görünür İçerik Sınırı seçilen koordinat temelinin genişliğini aşamaz."
	);
	expect(fakeApi.updateMeasurements).not.toHaveBeenCalled();

	fireEvent.change(
		screen.getByLabelText("Görünür İçerik Sınırı — Öneri — X (px)"),
		{ target: { value: "2" } }
	);
	fireEvent.click(screen.getByRole("button", { name: "Ölçüleri kaydet" }));

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Ölçüler kaydedildi."
	);
	expect(fakeApi.updateMeasurements).toHaveBeenCalledWith({
		assetRecordId: assetRecord.id,
		measurements: {
			...emptyAssetRecordMeasurements,
			logicalResolution: {
				confirmed: null,
				proposal: { width: 32, height: 32 },
			},
			visibleContentBounds: {
				confirmed: null,
				proposal: {
					coordinateSpace: "logicalResolution",
					x: 2,
					y: 4,
					width: 30,
					height: 10,
				},
			},
		},
		projectId,
	});
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
	fakeApi.record = {
		...assetRecord,
		availability: "erased",
		measurements: {
			...emptyAssetRecordMeasurements,
			sourceImageDimensions: {
				confirmed: null,
				proposal: { width: 512, height: 256 },
			},
		},
	};
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	expect(await screen.findByText("Silinmiş")).toBeVisible();
	expect(
		screen.queryByRole("heading", { name: "Varlık kaydı metadata’sı" })
	).not.toBeInTheDocument();
	expect(
		screen.getByText(
			"Silinmiş kaydın ölçüleri görüntülenemez veya değiştirilemez."
		)
	).toBeVisible();
	expect(
		screen.queryByRole("region", { name: "Görsel ölçüleri" })
	).not.toBeInTheDocument();
	expect(
		screen.queryByLabelText("Kaynak Görsel Ölçüsü — Öneri — Genişlik (px)")
	).not.toBeInTheDocument();
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

test("keeps Asset Record availability available when tracking details fail", async () => {
	fakeApi.trackingError = new Error("tracking schema is unavailable");
	const archivedRecord = { ...assetRecord, availability: "archived" as const };
	fakeApi.archive.mockImplementation(() => {
		fakeApi.record = archivedRecord;
		return archivedRecord;
	});
	fakeApi.restore.mockImplementation(() => {
		fakeApi.record = assetRecord;
		return assetRecord;
	});
	const { queryClient } = renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);

	expect(
		await screen.findByRole("heading", { name: "Ash Knight" })
	).toBeVisible();
	expect(screen.getByRole("button", { name: "Kaydı arşivle" })).toBeEnabled();
	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	expect(
		queryClient
			.getQueryCache()
			.find({ queryKey: ["asset-record-detail", assetRecord.id] })?.meta
	).toBeUndefined();

	fireEvent.click(screen.getByRole("button", { name: "Kaydı arşivle" }));
	expect(await screen.findByText("Arşivlenmiş")).toBeVisible();
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Kayıt arşivlendi."
	);

	fireEvent.click(
		screen.getByRole("button", { name: "Kaydı yeniden etkinleştir" })
	);
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
	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
