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
import { afterEach, beforeEach, expect, test, vi } from "vitest";
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
const legacyFamilyName = /Legacy family/;
const legacyWorldName = /Legacy world/;
const unknownCanonicalVersion = /Ana Tasarım Sürümü kayıtlı değil/;
const unexpectedNullValue = /null/;
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
	create: vi.fn(),
	updateMetadata: vi.fn(),
	detail: null as Record<string, unknown> | null,
	record: null as TestAssetRecord | null,
	records: [] as TestAssetRecord[],
	search: vi.fn(),
	searchResults: { records: [] as Record<string, unknown>[], totalCount: 0 },
	scopes: {
		themes: [] as Record<string, unknown>[],
		visualWorlds: [] as Record<string, unknown>[],
	},
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		assetRecords: {
			create: (input: unknown) => fakeApi.create(input),
			updateMetadata: (input: unknown) => fakeApi.updateMetadata(input),
		},
	},
	orpc: {
		assetRecords: {
			search: {
				queryKey: () => ["asset-record-search"],
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["asset-record-search", input],
					queryFn: () => fakeApi.search(input),
				}),
			},
			tracking: {
				queryKey: () => ["asset-record-detail"],
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
		contextScopes: {
			list: {
				queryOptions: () => ({
					queryKey: ["scope-catalog", projectId],
					queryFn: async () => fakeApi.scopes,
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
	fakeApi.create.mockReset();
	fakeApi.updateMetadata.mockReset();
	fakeApi.search.mockReset();
	fakeApi.searchResults = { records: [], totalCount: 0 };
	fakeApi.search.mockResolvedValue(fakeApi.searchResults);
	fakeApi.scopes = { themes: [], visualWorlds: [] };
});

beforeEach(() => {
	fakeApi.search.mockReset().mockResolvedValue(fakeApi.searchResults);
});

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
			focusVersionId="e14f4bcc-5e5d-4fb7-b976-c0980934fa21"
			projectId={projectId}
		/>
	);

	expect(
		await screen.findByRole("heading", { name: "Ash Knight" })
	).toBeVisible();
	expect(screen.getByText(versionFileName)).toBeVisible();
	expect(screen.getAllByText(alternativeFileName)).toHaveLength(2);
	expect(
		await screen.findByRole("status", {
			name: "Aradığınız sürüm: ash-knight-alt.png · Sürüm 2.",
		})
	).toBeVisible();
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

test("shows unknown legacy version and family metadata without inventing values", async () => {
	const versionId = "f7b32d26-6b7c-4e16-a578-dac3e0dab68b";
	fakeApi.detail = {
		record: assetRecord,
		tracking: {
			availableRecords: [],
			availableVersions: [],
			approvedVersion: {
				createdAt: "2026-09-25T08:01:00.000Z",
				fileName: null,
				id: versionId,
				reviewDisposition: "approved",
				sha256: null,
				versionNumber: 1,
			},
			alternatives: [],
			derivatives: [],
			family: {
				canonicalVersionId: null,
				id: "d2e8850c-393a-4b62-b6ad-188488d90c15",
				name: "Legacy family",
				useContext: "Legacy usage",
				visualWorldId: "02b966ed-b5a8-470a-84cb-74b44295cc3f",
				visualWorldName: "Legacy world",
			},
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
			focusVersionId={versionId}
			projectId={projectId}
		/>
	);

	expect(
		await screen.findByRole("status", {
			name: "Aradığınız sürüm: Sürüm 1.",
		})
	).toBeVisible();
	expect(screen.getByText(legacyFamilyName)).toBeVisible();
	expect(screen.getByText(legacyWorldName)).toBeVisible();
	expect(screen.getByText(unknownCanonicalVersion)).toBeVisible();
	expect(screen.queryByText(unexpectedNullValue)).not.toBeInTheDocument();
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
