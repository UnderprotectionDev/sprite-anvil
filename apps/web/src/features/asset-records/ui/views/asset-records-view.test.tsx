// @vitest-environment jsdom

import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import { createVersionProductionEvidence } from "@sprite-anvil/api/production-provenance";
import type { RightsRecord } from "@sprite-anvil/api/rights-records";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
const identityCheckboxName = /^Independent product meaning/;
const deliveryIdentityCheckboxName = /^Delivery identity/;
const archivedRecordStatus = /Record status · Archived/;
const archivedPackageSummary = /Archived attack package/;
const fileBoundaryCopy =
	/different file or editable frame alone does not justify a new record/i;
const generalSupportCopy =
	"General Asset Support · No specialized profile evidence";
const recordCreatedCopy = /Record created/;
const versionFileName = /ash-knight\.png/;
const alternativeFileName = /ash-knight-alt\.png/;
const derivativeName = /Ash Knight idle/;
const referenceName = /Skeleton Warrior/;
const referenceNote = /Use the stance only\./;
const referenceHistoryRevision = /Revision 1/;
const productionSource = /Imported from the project archive/;
const productionEvidence = /Archive manifest entry/;
const unknownVersionProductionEvidence =
	createVersionProductionEvidence("unknown");
const userRelationshipLabel = /Received from team/;
const unknownHistory = /History unknown/;
const attestationDateLabel = /Attestation date:/;
const legacyAttestationCreatedAt = "2026-09-25T08:01:00.000Z";
const localizedLegacyAttestationDate = /^(?:24|25) Eyl 2026 \d{2}:\d{2}$/;
const unknownCanonicalVersion = /no recorded Canonical Design Version/;
const unresolvedSourceAssetVersion =
	/Source Asset Version was not found in the catalog\./;
const emptyAssetRecordMeasurements = {
	atlasDimensions: { confirmed: null, proposal: null },
	cellDimensions: { confirmed: null, proposal: null },
	displayScale: { confirmed: null, proposal: null },
	logicalResolution: { confirmed: null, proposal: null },
	sourceImageDimensions: { confirmed: null, proposal: null },
	visibleContentBounds: { confirmed: null, proposal: null },
};
const fractionalScaleWarning = /non-integer Display Scale/;
const illustrationScaleHint =
	/High-resolution illustrations are not subject to this rule/;
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
	createDerivative: vi.fn(),
	createFamily: vi.fn(),
	createVersion: vi.fn(),
	createReference: vi.fn(),
	createGenerationPackage: vi.fn(),
	generationPackages: [] as GenerationPackage[],
	generationPackagesError: null as Error | null,
	assetFamilyCatalog: {
		assetFamilies: [],
		assetRecords: [],
		relationships: [],
		subjectIdentities: [],
	} as AssetFamilyCatalog,
	assetVersionCatalog: {
		assetVersions: [],
		canonicalDesigns: [],
		compositeVersions: [],
		unitVersions: [],
	} as AssetVersionCatalog,
	rightsRecordCreate: vi.fn(),
	rightsRecords: [] as RightsRecord[],
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

const unusedMutation = vi.hoisted(() => ({
	mutationOptions: (options?: object) => ({
		...options,
		mutationFn: () => Promise.reject(new Error("unexpected write")),
	}),
}));

const mutationOf = vi.hoisted(
	() => (mutationFn: (input: never) => unknown) => ({
		mutationOptions: (options?: object) => ({ ...options, mutationFn }),
	})
);

vi.mock("@/utils/orpc", () => ({
	client: {
		assetRecords: {
			archive: (input: unknown) => fakeApi.archive(input),
			create: (input: unknown) => fakeApi.create(input),
			createDerivative: (input: unknown) => fakeApi.createDerivative(input),
			createFamily: (input: unknown) => fakeApi.createFamily(input),
			createVersion: (input: unknown) => fakeApi.createVersion(input),
			restore: (input: unknown) => fakeApi.restore(input),
			updateMetadata: (input: unknown) => fakeApi.updateMetadata(input),
			updateMeasurements: (input: unknown) => fakeApi.updateMeasurements(input),
			createReference: (input: unknown) => fakeApi.createReference(input),
		},
		generationPackages: {
			create: (input: unknown) => fakeApi.createGenerationPackage(input),
		},
		rightsRecords: {
			create: (input: unknown) => fakeApi.rightsRecordCreate(input),
		},
	},
	orpc: {
		gameplayMetadata: {
			createPackage: unusedMutation,
			readPackage: unusedMutation,
			review: unusedMutation,
			write: unusedMutation,
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["gameplay-metadata", input],
					queryFn: async () => ({ frames: [], records: [] }),
				}),
			},
		},
		specializedProfileContracts: {
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["specialized-profile-contracts", input],
					queryFn: async () => ({ profiles: [] }),
				}),
			},
		},
		assetVersions: {
			createCompositeVersion: unusedMutation,
			previewBatchReview: unusedMutation,
			recordProviderGeneration: unusedMutation,
			review: unusedMutation,
			saveManualImportEvidence: unusedMutation,
			reviewBatch: unusedMutation,
			reviewCompositeVersion: unusedMutation,
			selectCanonicalDesign: unusedMutation,
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["asset-versions", input],
					queryFn: async () => fakeApi.assetVersionCatalog,
				}),
			},
		},
		assetFamilies: {
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["asset-families", input],
					queryFn: async () => fakeApi.assetFamilyCatalog,
				}),
			},
		},
		generationPackages: {
			create: mutationOf((input: unknown) =>
				fakeApi.createGenerationPackage(input)
			),
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["generation-packages", input],
					queryFn: () => {
						if (fakeApi.generationPackagesError) {
							return Promise.reject(fakeApi.generationPackagesError);
						}
						return Promise.resolve(fakeApi.generationPackages);
					},
				}),
			},
		},
		rightsRecords: {
			create: mutationOf((input: unknown) => fakeApi.rightsRecordCreate(input)),
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["rights-records", input],
					queryFn: async () =>
						fakeApi.rightsRecords.filter(
							(record) =>
								record.assetRecordId === input.assetRecordId &&
								record.projectId === input.projectId &&
								(record.referenceId ?? null) === (input.referenceId ?? null)
						),
				}),
				queryKey: ({ input }: { input: Record<string, unknown> }) => [
					"rights-records",
					input,
				],
			},
		},
		assetRecords: {
			updateReference: unusedMutation,
			archive: mutationOf((input: unknown) => fakeApi.archive(input)),
			create: mutationOf((input: unknown) => fakeApi.create(input)),
			createDerivative: mutationOf((input: unknown) =>
				fakeApi.createDerivative(input)
			),
			createFamily: mutationOf((input: unknown) => fakeApi.createFamily(input)),
			createManualImportVersion: unusedMutation,
			createReference: mutationOf((input: unknown) =>
				fakeApi.createReference(input)
			),
			createVersion: mutationOf((input: unknown) =>
				fakeApi.createVersion(input)
			),
			recordReview: unusedMutation,
			restore: mutationOf((input: unknown) => fakeApi.restore(input)),
			updateMetadata: mutationOf((input: unknown) =>
				fakeApi.updateMetadata(input)
			),
			updateMeasurements: mutationOf((input: unknown) =>
				fakeApi.updateMeasurements(input)
			),
			search: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["asset-record-search", input],
					queryFn: () => fakeApi.search(input),
				}),
			},
			get: {
				queryOptions: ({ input }: { input: { assetRecordId: string } }) => ({
					queryKey: ["asset-record", input.assetRecordId],
					queryFn: () => {
						if (input.assetRecordId !== assetRecord.id) {
							const found = fakeApi.records.find(
								(record) => record.id === input.assetRecordId
							);
							if (!found) {
								throw Object.assign(new Error("Not found"), {
									code: "NOT_FOUND",
								});
							}
							return found;
						}
						return (
							fakeApi.record ?? {
								...assetRecord,
								measurements:
									fakeApi.measurements ?? emptyAssetRecordMeasurements,
							}
						);
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
			listPage: {
				queryOptions: ({
					input,
				}: {
					input: { pagination: { offset: number; limit: number } };
				}) => ({
					queryKey: ["asset-records-page", projectId, input.pagination],
					queryFn: () => {
						if (fakeApi.recordsError) {
							throw fakeApi.recordsError;
						}
						const { offset, limit } = input.pagination;
						return {
							records: fakeApi.records
								.slice(offset, offset + limit)
								.map((record) => ({ record, matchingVersions: [] })),
							totalCount: fakeApi.records.length,
							nextOffset:
								offset + limit < fakeApi.records.length ? offset + limit : null,
						};
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
	fakeApi.createDerivative.mockReset();
	fakeApi.createFamily.mockReset();
	fakeApi.createVersion.mockReset();
	fakeApi.createReference.mockReset();
	fakeApi.createGenerationPackage.mockReset();
	fakeApi.rightsRecordCreate.mockReset();
	fakeApi.generationPackages = [];
	fakeApi.generationPackagesError = null;
	fakeApi.assetFamilyCatalog = {
		assetFamilies: [],
		assetRecords: [],
		relationships: [],
		subjectIdentities: [],
	};
	fakeApi.assetVersionCatalog = {
		assetVersions: [],
		canonicalDesigns: [],
		compositeVersions: [],
		unitVersions: [],
	};
	fakeApi.rightsRecords = [];
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
	fireEvent.click(screen.getByText("More filters"));
	fireEvent.change(screen.getByLabelText("Search by name"), {
		target: { value: "Ash" },
	});
	fireEvent.change(screen.getByLabelText("Asset category"), {
		target: { value: "icon" },
	});
	fireEvent.change(screen.getByLabelText("Visual World"), {
		target: { value: visualWorldId },
	});
	fireEvent.change(screen.getByLabelText("Theme"), {
		target: { value: themeId },
	});
	fireEvent.change(screen.getByLabelText("Source image width (px)"), {
		target: { value: "32" },
	});
	fireEvent.change(screen.getByLabelText("Source image height (px)"), {
		target: { value: "48" },
	});
	fireEvent.change(screen.getByLabelText("Tag"), {
		target: { value: "inventory" },
	});
	fireEvent.change(screen.getByLabelText("Record status"), {
		target: { value: "archived" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Search Asset Records" }));

	await waitFor(() =>
		expect(fakeApi.search).toHaveBeenLastCalledWith({
			pagination: { limit: 50, offset: 0 },
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
		await screen.findByText("ash-knight-icon.webp · Version 3 · 32 × 48 px")
	).toBeVisible();
	fireEvent.click(
		screen.getByRole("button", {
			name: "ash-knight-icon.webp open version 3 history",
		})
	);
	expect(onOpenRecord).toHaveBeenCalledWith(assetRecord.id, versionId);
	fireEvent.click(
		screen.getByRole("button", { name: "Ash Knight open record" })
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
	fireEvent.click(screen.getByRole("button", { name: "Search Asset Records" }));
	expect(await screen.findByText("Version 3 · 32 × 48 px")).toBeVisible();
	fireEvent.click(
		screen.getByRole("button", { name: "open version 3 history" })
	);
	expect(onOpenRecord).toHaveBeenCalledWith(assetRecord.id, versionId);
});

test("shows the Generation Package workflow on an active Asset Record", async () => {
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.click(
		await screen.findByRole("button", {
			name: "Production and import",
		})
	);

	expect(
		await screen.findByRole("heading", { name: "Generation Packages" })
	).toBeVisible();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Pin Generation Package" })
		).toBeEnabled()
	);
});

test("shows Rights Record versioning on an active Asset Record", async () => {
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Rights Records" })
	);

	expect(
		await screen.findByRole("heading", { name: "Rights Record" })
	).toBeVisible();
	expect(
		await screen.findByText("This Asset Record has no Rights Records yet.")
	).toBeVisible();
});

test("keeps dependent source rights visible when a linked package cannot load", async () => {
	const sourceAssetFamilyId = "ea366304-98c1-4712-8d0e-c24c42facaa3";
	const sourceAssetRecordId = "3e1b904a-5349-41b6-961a-981f3b456e2c";
	const sourceAssetVersionId = "642f2953-a177-4136-82a5-4fdd90c70ff4";
	const generationPackageId = "6b1bfa47-a40a-4aa9-95fd-340ac733820a";
	fakeApi.generationPackagesError = new Error("Paket recordsları okunamadı.");
	fakeApi.assetFamilyCatalog = {
		assetFamilies: [],
		assetRecords: [
			{
				assetFamilyId: sourceAssetFamilyId,
				createdAt: "2026-09-25T08:00:00.000Z",
				id: sourceAssetRecordId,
				name: "Base Body",
				projectId,
			},
		],
		relationships: [
			{
				assetFamilyId: sourceAssetFamilyId,
				createdAt: "2026-09-25T08:00:00.000Z",
				id: "ae960e61-f5a5-4b4b-b5d9-6422fc8b2bfa",
				projectId,
				sourceAssetRecordId,
				sourceAssetVersionId,
				targetAssetRecordId: assetRecord.id,
				type: "derivative",
			},
		],
		subjectIdentities: [],
	};
	fakeApi.assetVersionCatalog = {
		assetVersions: [
			{
				assetFamilyId: sourceAssetFamilyId,
				assetRecordId: sourceAssetRecordId,
				contentDigest: null,
				contentLength: 1,
				contentType: "image/png",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: sourceAssetVersionId,
				integrityVerified: false,
				previewUrl: "https://example.test/base-body.png",
				productionEvidence: unknownVersionProductionEvidence,
				projectId,
				reviewDisposition: "candidate",
				reviewEvents: [],
				versionNumber: 2,
			},
		],
		canonicalDesigns: [],
		compositeVersions: [],
		unitVersions: [],
	};
	fakeApi.detail = {
		record: assetRecord,
		tracking: {
			availableRecords: [],
			availableVersions: [],
			approvedVersion: null,
			alternatives: [],
			derivatives: [],
			family: null,
			manualImportEvidence: [
				{
					assetVersionId: "66f50fb8-d25b-47aa-a78f-5c70cbaf0474",
					createdAt: "2026-09-25T08:00:00.000Z",
					fileName: "ash-knight.png",
					generationInstruction: "Use the package.",
					generationPackageId,
					id: "a87de4c8-a72d-4d8c-b3e8-8845758cc1e9",
					revision: 1,
					sha256: "a".repeat(64),
					sourceSurface: "ChatGPT",
					versionNumber: 1,
				},
			],
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
	fakeApi.rightsRecords = [
		{
			assetRecordId: sourceAssetRecordId,
			assertedScope: "Base body declaration",
			createdAt: "2026-09-25T08:00:00.000Z",
			evidence: null,
			evidenceFile: null,
			id: "f4172194-3588-459f-9c06-0357f2e40e16",
			projectId,
			restrictions: null,
			rightsHolderOrProvider: null,
			source: "Base body source",
			state: "unknown",
			uncertainty: null,
			versionNumber: 1,
		},
	];

	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Rights Records" })
	);

	const lineage = await screen.findByRole("region", { name: "Rights Lineage" });
	expect(
		await within(lineage).findByRole("heading", {
			name: "Dependent source · Base Body · Derived",
		})
	).toBeVisible();
	expect(within(lineage).getByText("Base body declaration")).toBeVisible();
	expect(within(lineage).getByRole("alert")).toHaveTextContent(
		"Could not load Generation Package sources."
	);
});

test("shows a result's separate Rights Lineage and each source's versioned declarations", async () => {
	const canonicalAssetRecordId = "8b4b2f70-4cc4-42bc-a13f-45ec5751c2d4";
	const skeletonWarriorAssetRecordId = "c225bd21-8197-48bd-bbbf-4fe73ddc304f";
	const referenceAssetRecordId = "5c934b79-1c92-4e08-941a-3b7ae3639e21";
	const snapshotOnlyAssetRecordId = "bc73080c-aa91-47aa-b0bd-90b6771d4247";
	const dependentAssetRecordId = "3e1b904a-5349-41b6-961a-981f3b456e2c";
	const canonicalVersionId = "5fb91347-21d7-46e8-8a2d-4d3e7e2b3210";
	const referenceVersionId = "f98f3012-f74c-4ef9-b810-70c74146eb98";
	const dependentVersionId = "642f2953-a177-4136-82a5-4fdd90c70ff4";
	const referenceId = "b9f6f4a0-550d-4744-a533-cd9a34f1ec62";
	const otherReferenceId = "f32a55e6-5999-42f5-b579-d26ce0749aa9";
	const generationPackageId = "6b1bfa47-a40a-4aa9-95fd-340ac733820a";
	const unlinkedGenerationPackageId = "2c9c916b-49f2-41c7-b0c5-8adf0277db20";
	const unresolvedReferenceId = "d95726dd-1772-49fd-b113-2b93f44036e4";
	const unresolvedAssetVersionId = "64537111-438f-4a3f-8f78-cea158d5b80a";
	const secondReferenceImageId = "c07f8537-a86f-4602-8c37-e6f0586a3de0";
	const unassignedReferenceImageId = "9a14c286-78fc-4e73-89bd-a57a53364e25";
	const rightsRecord = (
		id: string,
		assetRecordId: string,
		input: Partial<RightsRecord> = {}
	): RightsRecord => ({
		assetRecordId,
		assertedScope: null,
		createdAt: "2026-09-25T08:00:00.000Z",
		evidence: null,
		evidenceFile: null,
		id,
		projectId,
		restrictions: null,
		rightsHolderOrProvider: null,
		source: null,
		state: "unknown",
		uncertainty: null,
		versionNumber: 1,
		...input,
	});
	const assetVersion = (
		id: string,
		assetRecordId: string,
		versionNumber: number
	): AssetVersionCatalog["assetVersions"][number] => ({
		assetFamilyId: "ea366304-98c1-4712-8d0e-c24c42facaa3",
		assetRecordId,
		contentDigest: null,
		contentLength: 1,
		contentType: "image/png",
		createdAt: "2026-09-25T08:00:00.000Z",
		id,
		integrityVerified: false,
		previewUrl: "https://example.test/asset-version.png",
		productionEvidence: unknownVersionProductionEvidence,
		projectId,
		reviewDisposition: "candidate",
		reviewEvents: [],
		versionNumber,
	});
	const resultVersionId = "66f50fb8-d25b-47aa-a78f-5c70cbaf0474";
	const packageRecord = {
		assetRecord: {
			...assetRecord,
			identityCriteria: [...assetRecord.identityCriteria],
		} as AssetRecord,
		assetRecordId: assetRecord.id,
		avoidConstraints: [],
		canonicalDesign: {
			assetFamilyId: "ea366304-98c1-4712-8d0e-c24c42facaa3",
			assetRecordId: canonicalAssetRecordId,
			assetVersionId: canonicalVersionId,
			canonicalDesignId: "506377d8-28ee-4692-8d26-51e65a87b6a1",
			contentDigest: null,
			contentType: "image/png" as const,
			versionNumber: 4,
		},
		changeConstraints: [],
		createdAt: "2026-09-25T08:00:00.000Z",
		expectedOutputStructure: "One image.",
		id: generationPackageId,
		lockedUnits: [],
		preserveConstraints: [],
		productionContextSnapshot: {
			contextRevisionId: "bca64acb-49a5-4440-a243-46c81d486d0d",
			generalArtDirection: "",
			ruleContractVersion: "context-rule/1.0.0" as const,
			rules: [],
			revisionNumber: 1,
			theme: null,
			visualWorld: null,
		},
		referenceRoles: [
			{
				assetRecordId: null,
				assetRecordName: "Skeleton Warrior",
				assetVersionId: referenceVersionId,
				contentDigest: null,
				contentType: null,
				contextOverrideRationale: null,
				customPurpose: null,
				fileName: null,
				forbiddenFeatures: [],
				id: "b2c810ec-7c45-4e4e-94b2-dd4ccbe0aa25",
				kind: "asset_version" as const,
				notes: "Use the stance only.",
				role: "pose" as const,
				transferredFeatures: ["pose" as const],
				versionNumber: 3,
			},
			{
				assetRecordId: referenceAssetRecordId,
				assetRecordName: null,
				assetVersionId: null,
				contentDigest: null,
				contentType: "image/png" as const,
				contextOverrideRationale: null,
				customPurpose: null,
				fileName: "palette-reference.png",
				forbiddenFeatures: [],
				id: referenceId,
				kind: "reference_image" as const,
				notes: null,
				role: "palette" as const,
				transferredFeatures: ["palette" as const],
				versionNumber: null,
			},
			{
				assetRecordId: referenceAssetRecordId,
				assetRecordName: null,
				assetVersionId: null,
				contentDigest: null,
				contentType: "image/png" as const,
				contextOverrideRationale: null,
				customPurpose: null,
				fileName: "palette-reference-detail.png",
				forbiddenFeatures: [],
				id: secondReferenceImageId,
				kind: "reference_image" as const,
				notes: null,
				role: "palette" as const,
				transferredFeatures: ["palette" as const],
				versionNumber: null,
			},
			{
				assetRecordId: assetRecord.id,
				assetRecordName: null,
				assetVersionId: null,
				contentDigest: null,
				contentType: "image/png" as const,
				contextOverrideRationale: null,
				customPurpose: null,
				fileName: "ash-knight-reference.png",
				forbiddenFeatures: [],
				id: unassignedReferenceImageId,
				kind: "reference_image" as const,
				notes: null,
				role: "palette" as const,
				transferredFeatures: ["palette" as const],
				versionNumber: null,
			},
			{
				assetRecordId: snapshotOnlyAssetRecordId,
				assetRecordName: "Unresolved Source",
				assetVersionId: unresolvedAssetVersionId,
				contentDigest: null,
				contentType: null,
				contextOverrideRationale: null,
				customPurpose: null,
				fileName: null,
				forbiddenFeatures: [],
				id: unresolvedReferenceId,
				kind: "asset_version" as const,
				notes: null,
				role: "style" as const,
				transferredFeatures: ["style" as const],
				versionNumber: 9,
			},
		],
		projectId,
		targetDimensions: { height: 64, width: 64 },
		targetTask: "Forest Quest portrait",
	} as GenerationPackage;
	fakeApi.generationPackages = [
		packageRecord,
		{
			...packageRecord,
			id: unlinkedGenerationPackageId,
			targetTask: "Unlinked package must not appear in this lineage",
		},
	];
	fakeApi.assetVersionCatalog = {
		assetVersions: [
			assetVersion(canonicalVersionId, canonicalAssetRecordId, 4),
			assetVersion(referenceVersionId, skeletonWarriorAssetRecordId, 3),
			assetVersion(dependentVersionId, dependentAssetRecordId, 2),
		],
		canonicalDesigns: [],
		compositeVersions: [],
		unitVersions: [],
	};
	fakeApi.assetFamilyCatalog = {
		assetFamilies: [],
		assetRecords: [
			{
				assetFamilyId: "ea366304-98c1-4712-8d0e-c24c42facaa3",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: canonicalAssetRecordId,
				name: "Primary Design",
				projectId,
			},
			{
				assetFamilyId: "ea366304-98c1-4712-8d0e-c24c42facaa3",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: skeletonWarriorAssetRecordId,
				name: "Skeleton Warrior",
				projectId,
			},
			{
				assetFamilyId: "ea366304-98c1-4712-8d0e-c24c42facaa3",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: referenceAssetRecordId,
				name: "Palette Reference",
				projectId,
			},
			{
				assetFamilyId: "ea366304-98c1-4712-8d0e-c24c42facaa3",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: dependentAssetRecordId,
				name: "Base Body",
				projectId,
			},
		],
		relationships: [
			{
				assetFamilyId: "ea366304-98c1-4712-8d0e-c24c42facaa3",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: "ae960e61-f5a5-4b4b-b5d9-6422fc8b2bfa",
				projectId,
				sourceAssetRecordId: dependentAssetRecordId,
				sourceAssetVersionId: dependentVersionId,
				targetAssetRecordId: assetRecord.id,
				type: "derivative" as const,
			},
			{
				assetFamilyId: "ea366304-98c1-4712-8d0e-c24c42facaa3",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: "f009943f-71f2-4b54-a59f-b84ad19285c4",
				projectId,
				sourceAssetRecordId: assetRecord.id,
				sourceAssetVersionId: null,
				targetAssetRecordId: "7784675c-091b-46b2-a709-61a45ffc215c",
				type: "derivative" as const,
			},
		],
		subjectIdentities: [],
	} as AssetFamilyCatalog;
	fakeApi.detail = {
		record: assetRecord,
		tracking: {
			availableRecords: [],
			availableVersions: [],
			approvedVersion: null,
			alternatives: [],
			derivatives: [],
			family: null,
			manualImportEvidence: [
				{
					assetVersionId: resultVersionId,
					createdAt: "2026-09-25T08:00:00.000Z",
					fileName: "ash-knight.png",
					generationInstruction: "Use the package.",
					generationPackageId,
					id: "a87de4c8-a72d-4d8c-b3e8-8845758cc1e9",
					revision: 1,
					sha256: "a".repeat(64),
					sourceSurface: "ChatGPT",
					versionNumber: 1,
				},
			],
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
	fakeApi.rightsRecords = [
		rightsRecord("8d070973-ad31-4e0e-a88d-a8df6c947a4e", assetRecord.id, {
			assertedScope: "Prototype use only",
			id: "8d070973-ad31-4e0e-a88d-a8df6c947a4e",
			source: "Result declaration",
			state: "unknown",
		}),
		rightsRecord(
			"b406d1d9-5621-4d99-99cb-5cc86ae52326",
			canonicalAssetRecordId,
			{
				assertedScope: "Earlier primary design statement",
				id: "b406d1d9-5621-4d99-99cb-5cc86ae52326",
				source: "Earlier design source",
				state: "assertion_only",
				versionNumber: 1,
			}
		),
		rightsRecord(
			"6c5203e8-a563-4f01-81ea-73b13c015351",
			canonicalAssetRecordId,
			{
				assertedScope: "Primary design statement",
				id: "6c5203e8-a563-4f01-81ea-73b13c015351",
				source: "Design source",
				state: "documented",
				versionNumber: 2,
			}
		),
		rightsRecord(
			"0257e45a-8a21-4d64-8862-9a03d30f5f07",
			skeletonWarriorAssetRecordId,
			{
				assertedScope: "Pose reference declaration",
				id: "0257e45a-8a21-4d64-8862-9a03d30f5f07",
				source: "Pose artist",
				state: "assertion_only",
				versionNumber: 1,
			}
		),
		rightsRecord(
			"fdc31ccd-ed3a-41e9-a5be-5501747eb3bd",
			referenceAssetRecordId,
			{
				assertedScope: "Commercial use declared",
				id: "fdc31ccd-ed3a-41e9-a5be-5501747eb3bd",
				referenceId,
				restrictions: "Do not redistribute the reference image.",
				source: "Reference image source",
				state: "restricted",
				versionNumber: 2,
			}
		),
		rightsRecord("fb13c433-1fd8-433d-9762-8f36078c7d62", assetRecord.id, {
			assertedScope: "Current record reference declaration",
			id: "fb13c433-1fd8-433d-9762-8f36078c7d62",
			referenceId: unassignedReferenceImageId,
			source: "Current record reference source",
			state: "documented",
		}),
		rightsRecord(
			"cc2fc0bd-5f10-4da0-9bef-d6b6c41675b5",
			referenceAssetRecordId,
			{
				assertedScope: "Other reference declaration must stay separate",
				id: "cc2fc0bd-5f10-4da0-9bef-d6b6c41675b5",
				referenceId: otherReferenceId,
				source: "Other reference source",
				state: "documented",
				versionNumber: 1,
			}
		),
		rightsRecord(
			"8a62c266-e5ba-4d78-9e8e-6878b51f806a",
			snapshotOnlyAssetRecordId,
			{
				assertedScope: "Snapshot-only source declaration",
				id: "8a62c266-e5ba-4d78-9e8e-6878b51f806a",
				source: "Archived source record",
				state: "documented",
			}
		),
		rightsRecord(
			"f4172194-3588-459f-9c06-0357f2e40e16",
			dependentAssetRecordId,
			{
				assertedScope: "Base body declaration",
				id: "f4172194-3588-459f-9c06-0357f2e40e16",
				source: "Base body source",
				state: "unknown",
			}
		),
	];
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Rights Records" })
	);

	const lineage = await screen.findByRole("region", { name: "Rights Lineage" });
	const resultRightsRecord = screen.getByRole("region", {
		name: "Rights Record",
	});
	await waitFor(() => {
		expect(
			within(resultRightsRecord).getByLabelText("Declared permission scope")
		).toHaveValue("Prototype use only");
	});
	await waitFor(() => {
		expect(
			within(lineage).queryByText("Rights Lineage kaynakları yükleniyor…")
		).not.toBeInTheDocument();
		expect(
			within(lineage).queryAllByText("Loading Rights Record history…")
		).toHaveLength(0);
	});
	expect(
		within(lineage).getByRole("heading", {
			name: "Canonical Design · Primary Design · Version 4",
		})
	).toBeVisible();
	expect(
		within(lineage).getByRole("heading", {
			name: "Reference · Transfer pose or motion only · Skeleton Warrior · Version 3",
		})
	).toBeVisible();
	expect(
		within(lineage).getByRole("heading", {
			name: "Reference · palette-reference.png",
		})
	).toBeVisible();
	expect(
		within(lineage).getByRole("heading", {
			name: "Reference · palette-reference-detail.png",
		})
	).toBeVisible();
	expect(
		within(lineage).getByRole("heading", {
			name: "Reference · ash-knight-reference.png",
		})
	).toBeVisible();
	expect(
		within(lineage).getByRole("heading", {
			name: "Reference · Transfer drawing or rendering style only · Unresolved Source · Version 9",
		})
	).toBeVisible();
	expect(
		within(lineage).getByRole("heading", {
			name: "Dependent source · Base Body · Derived",
		})
	).toBeVisible();
	expect(within(lineage).getByText("Primary design statement")).toBeVisible();
	expect(
		within(lineage).getByText("Earlier primary design statement")
	).toBeVisible();
	expect(within(lineage).getByText("Pose reference declaration")).toBeVisible();
	expect(within(lineage).getByText("Commercial use declared")).toBeVisible();
	expect(
		within(lineage).getByText("Current record reference declaration")
	).toBeVisible();
	expect(
		within(lineage).queryByText(
			"Referans görselinin Asset Record kataloğunda bulunamadı."
		)
	).not.toBeInTheDocument();
	expect(
		within(lineage).getByText("Do not redistribute the reference image.")
	).toBeVisible();
	expect(within(lineage).getByText("Base body declaration")).toBeVisible();
	expect(
		within(lineage).getByText("Snapshot-only source declaration")
	).toBeVisible();
	expect(
		within(lineage).queryByText(
			"Other reference declaration must stay separate"
		)
	).not.toBeInTheDocument();
	expect(
		within(lineage).queryByText(
			"Unlinked package must not appear in this lineage"
		)
	).not.toBeInTheDocument();
	expect(within(lineage).getByText(unresolvedSourceAssetVersion)).toBeVisible();
	expect(
		within(lineage).getByText(
			"The result’s own Rights Record is shown separately above. Source declarations do not automatically transfer to a Derived Asset; this view does not determine a license’s legal validity."
		)
	).toBeVisible();
});

test("starts a clean Rights Record draft when the detail view switches records", async () => {
	const secondAssetRecordId = "8b4b2f70-4cc4-42bc-a13f-45ec5751c2d4";
	fakeApi.rightsRecords = [
		{
			assetRecordId: assetRecord.id,
			assertedScope: "Paid game releases",
			createdAt: "2026-09-29T10:00:00.000Z",
			evidence: "License reference",
			evidenceFile: null,
			id: "1a88feeb-c978-4f3f-a321-f5a120651ec7",
			projectId,
			restrictions: null,
			rightsHolderOrProvider: "Example Studio",
			source: "https://example.test/source",
			state: "documented",
			uncertainty: null,
			versionNumber: 1,
		},
	];
	const { queryClient } = renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Rights Records" })
	);

	await waitFor(() =>
		expect(screen.getByLabelText("Source")).toHaveValue(
			"https://example.test/source"
		)
	);

	const secondAssetRecord = {
		...assetRecord,
		id: secondAssetRecordId,
		name: "Skeleton Warrior",
	};
	fakeApi.record = secondAssetRecord;
	queryClient.setQueryData(["asset-record", assetRecord.id], secondAssetRecord);
	fireEvent.click(
		await screen.findByRole("button", { name: "Rights Records" })
	);

	await waitFor(() => expect(screen.getByLabelText("Source")).toHaveValue(""));
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
	fireEvent.click(
		await screen.findByRole("button", {
			name: "Production and import",
		})
	);

	expect(
		await screen.findByRole("heading", { name: "Generation Packages" })
	).toBeVisible();
	expect(await screen.findByText(archivedPackageSummary)).toBeVisible();
	expect(
		screen.getByText(
			"A new Generation Package cannot be created for an archived Asset Record."
		)
	).toBeVisible();
	expect(
		screen.queryByRole("button", { name: "Pin Generation Package" })
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
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);

	await screen.findByRole("heading", { name: "Ash Knight" });
	fireEvent.change(screen.getByLabelText("Asset category"), {
		target: { value: "icon" },
	});
	fireEvent.change(screen.getByLabelText("Visual World"), {
		target: { value: visualWorldId },
	});
	const themeSelect = screen.getByLabelText("Theme", { selector: "select" });
	expect(themeSelect).toHaveDisplayValue("No Theme selected");
	expect(
		screen.getByRole("option", { name: "Dark Castle" })
	).toBeInTheDocument();
	expect(
		screen.queryByRole("option", { name: "Store Banner" })
	).not.toBeInTheDocument();
	fireEvent.change(themeSelect, { target: { value: themeId } });
	fireEvent.change(screen.getByLabelText("Tags"), {
		target: { value: "inventory" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));

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
		"Asset Record metadata saved."
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
	fireEvent.click(await screen.findByRole("button", { name: "All records" }));

	await waitFor(() => expect(errorToast).toHaveBeenCalledTimes(1));
	expect(errorToast.mock.calls[0]?.[0]).toBe("Data could not be loaded.");
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Could not load Asset Records."
	);
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
	fireEvent.click(
		await screen.findByRole("button", {
			name: "New Asset Record",
		})
	);

	await screen.findByRole("dialog", { name: "New Asset Record" });
	fireEvent.change(screen.getByLabelText("Asset name"), {
		target: { value: "Ash Knight" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: identityCheckboxName }));
	fireEvent.click(screen.getByRole("button", { name: "Create Asset Record" }));

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
	fireEvent.click(
		await screen.findByRole("button", {
			name: "New Asset Record",
		})
	);

	await screen.findByRole("dialog", { name: "New Asset Record" });
	fireEvent.change(screen.getByLabelText("Asset name"), {
		target: { value: "Ash Knight" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: identityCheckboxName }));
	fireEvent.click(screen.getByRole("button", { name: "Create Asset Record" }));

	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	const identity = fakeApi.create.mock.calls[0]?.[0].id;
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Create Asset Record" })
	).toBeDisabled();
	fireEvent.click(screen.getByRole("button", { name: "Check status" }));
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Create Asset Record" })
		).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Create Asset Record" }));

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
	fireEvent.click(await screen.findByRole("button", { name: "All records" }));

	expect(await screen.findByText(archivedRecordStatus)).toBeVisible();
	fireEvent.click(
		screen.getByRole("button", { name: "Ash Knight open record" })
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
				productionEvidence: unknownVersionProductionEvidence,
				reviewDisposition: "approved",
				sha256: "a".repeat(64),
				versionNumber: 1,
			},
			alternatives: [
				{
					createdAt: "2026-09-25T08:02:00.000Z",
					fileName: "ash-knight-alt.png",
					id: "e14f4bcc-5e5d-4fb7-b976-c0980934fa21",
					productionEvidence: unknownVersionProductionEvidence,
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
	fireEvent.click(
		screen.getByRole("button", { name: "Production and import" })
	);
	expect(screen.getByText(referenceName)).toBeVisible();
	expect(
		screen
			.getAllByText(referenceNote)
			.some((element) => element.tagName === "P")
	).toBe(true);
	fireEvent.click(screen.getByText("Rule history"));
	const historyDisclosure = screen.getByText("Rule history").closest("details");
	if (!historyDisclosure) {
		throw new Error("Reference history disclosure was not rendered");
	}
	expect(
		within(historyDisclosure).getByText(referenceHistoryRevision)
	).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Versions and files" }));
	expect(
		screen.getByText("File format signature matched (2 version).")
	).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Record details" }));
	expect(screen.getByText(generalSupportCopy)).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Versions and files" }));
	expect(screen.getByText(productionSource)).toBeVisible();
	expect(screen.getByText(productionEvidence)).toBeVisible();
	expect(
		screen.getByText(
			"Unknown production history: The original generation instruction is unavailable."
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
	expect(screen.getAllByText(userRelationshipLabel)[0]).toBeVisible();
	expect(screen.getByText(unknownHistory)).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Record details" }));
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
	await screen.findByRole("heading", { name: "Create Candidate Version" });
	const uploadedFile = new File([new Uint8Array([1, 2, 3])], "legacy.png", {
		type: "image/png",
	});
	Object.defineProperty(uploadedFile, "arrayBuffer", {
		value: async () => new Uint8Array([1, 2, 3]).buffer,
	});

	fireEvent.change(screen.getByLabelText("PNG or WebP file"), {
		target: { files: [uploadedFile] },
	});
	fireEvent.change(screen.getByLabelText("Known source"), {
		target: { value: "Project archive" },
	});
	fireEvent.change(screen.getByLabelText("Your relationship to the asset"), {
		target: { value: "received_from_team" },
	});
	const unknownHistoryInput = screen.getByLabelText(
		"Unknown production history"
	);
	expect(unknownHistoryInput).toBeRequired();
	fireEvent.change(unknownHistoryInput, {
		target: { value: "The original generation instruction is unavailable." },
	});
	fireEvent.change(screen.getByLabelText("Supporting evidence"), {
		target: { value: "The team archive manifest lists this image." },
	});
	const submitButton = screen.getByRole("button", {
		name: "Save Candidate Version",
	});
	expect(submitButton).toBeEnabled();
	fireEvent.submit(submitButton.closest("form") as HTMLFormElement);
	await waitFor(() => expect(fakeApi.createVersion).toHaveBeenCalled());

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Candidate Version saved."
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
			"Unknown production history: The original generation instruction is unavailable."
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
				productionEvidence: unknownVersionProductionEvidence,
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

	expect(await screen.findByText("Filename unknown · Version 1")).toBeVisible();
	expect(screen.getByText(unknownCanonicalVersion)).toBeVisible();
	expect(
		screen.queryByLabelText("Derived Asset Record")
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
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);

	await screen.findByRole("heading", { name: "Ash Knight" });
	for (const heading of [
		"Source Image Dimensions",
		"Logical Resolution",
		"Cell Dimensions",
		"Visible Content Bounds",
		"Display Scale",
		"Atlas Dimensions",
	]) {
		expect(screen.getByRole("heading", { name: heading })).toBeVisible();
	}
	fireEvent.change(
		screen.getByLabelText("Source Image Dimensions — Proposal — Width (px)"),
		{ target: { value: "512" } }
	);
	fireEvent.change(
		screen.getByLabelText("Source Image Dimensions — Proposal — Height (px)"),
		{ target: { value: "256" } }
	);
	fireEvent.change(
		screen.getByLabelText("Logical Resolution — Confirmed value — Width (px)"),
		{ target: { value: "72" } }
	);
	fireEvent.change(
		screen.getByLabelText("Logical Resolution — Confirmed value — Height (px)"),
		{ target: { value: "80" } }
	);
	fireEvent.click(screen.getByRole("button", { name: "Save dimensions" }));

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Dimensions saved."
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
			screen.getByLabelText("Source Image Dimensions — Proposal — Width (px)")
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
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);

	await screen.findByRole("heading", { name: "Ash Knight" });

	for (const [label, value] of [
		["Logical Resolution — Proposal — Width (px)", "32"],
		["Logical Resolution — Proposal — Height (px)", "32"],
		["Visible Content Bounds — Proposal — X (px)", "3"],
		["Visible Content Bounds — Proposal — Y (px)", "4"],
		["Visible Content Bounds — Proposal — Width (px)", "30"],
		["Visible Content Bounds — Proposal — Height (px)", "10"],
	] as const) {
		fireEvent.change(screen.getByLabelText(label), { target: { value } });
	}
	const coordinateSpace = screen.getByLabelText(
		"Visible Content Bounds — Proposal — Koordinat temeli"
	);
	fireEvent.change(coordinateSpace, {
		target: { value: "logicalResolution" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save dimensions" }));

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"The Visible Content Boundary cannot exceed the width of its coordinate basis."
	);
	expect(fakeApi.updateMeasurements).not.toHaveBeenCalled();

	fireEvent.change(
		screen.getByLabelText("Visible Content Bounds — Proposal — X (px)"),
		{ target: { value: "2" } }
	);
	fireEvent.click(screen.getByRole("button", { name: "Save dimensions" }));

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Dimensions saved."
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
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);

	await screen.findByRole("heading", { name: "Ash Knight" });
	const width = screen.getByLabelText(
		"Source Image Dimensions — Proposal — Width (px)"
	);
	const height = screen.getByLabelText(
		"Source Image Dimensions — Proposal — Height (px)"
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
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);

	await screen.findByRole("heading", { name: "Ash Knight" });
	const width = screen.getByLabelText(
		"Source Image Dimensions — Proposal — Width (px)"
	);
	fireEvent.change(width, { target: { value: "512" } });
	fireEvent.change(
		screen.getByLabelText("Source Image Dimensions — Proposal — Height (px)"),
		{ target: { value: "256" } }
	);
	fireEvent.click(screen.getByRole("button", { name: "Save dimensions" }));

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
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);

	await screen.findByRole("heading", { name: "Ash Knight" });
	fireEvent.change(screen.getByLabelText("Display Scale — Proposal — Scale"), {
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
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);

	expect(await screen.findByText("Erased")).toBeVisible();
	expect(
		screen.queryByRole("heading", { name: "Asset Record metadata" })
	).not.toBeInTheDocument();
	expect(
		screen.getByText(
			"An erased record's dimensions cannot be viewed or changed."
		)
	).toBeVisible();
	expect(
		screen.queryByRole("region", { name: "Image dimensions" })
	).not.toBeInTheDocument();
	expect(
		screen.queryByLabelText("Source Image Dimensions — Proposal — Width (px)")
	).not.toBeInTheDocument();
	expect(
		screen.queryByRole("button", { name: "Archive record" })
	).not.toBeInTheDocument();
	expect(
		screen.queryByRole("button", { name: "Reactivate record" })
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
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);

	fireEvent.click(
		await screen.findByRole("button", { name: "Archive record" })
	);
	await waitFor(() =>
		expect(fakeApi.archive).toHaveBeenCalledWith({
			assetRecordId: assetRecord.id,
			projectId,
		})
	);
	expect(await screen.findByText("Archived")).toBeVisible();
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Record archived."
	);

	fireEvent.click(screen.getByRole("button", { name: "Reactivate record" }));
	await waitFor(() =>
		expect(fakeApi.restore).toHaveBeenCalledWith({
			assetRecordId: assetRecord.id,
			projectId,
		})
	);
	expect(await screen.findByText("Active")).toBeVisible();
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Record reactivated."
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
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);

	expect(
		await screen.findByRole("heading", { name: "Ash Knight" })
	).toBeVisible();
	expect(screen.getByRole("button", { name: "Archive record" })).toBeEnabled();
	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	fireEvent.click(screen.getByRole("button", { name: "Rights Records" }));
	expect(
		within(
			screen.getByRole("region", { name: "Rights Lineage", hidden: true })
		).getByRole("alert")
	).toHaveTextContent("Could not load Asset Record source history.");
	expect(
		queryClient
			.getQueryCache()
			.find({ queryKey: ["asset-record-detail", assetRecord.id] })?.meta
	).toBeUndefined();

	fireEvent.click(screen.getByRole("button", { name: "Record details" }));
	fireEvent.click(screen.getByRole("button", { name: "Archive record" }));
	expect(await screen.findByText("Archived")).toBeVisible();
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Record archived."
	);

	fireEvent.click(screen.getByRole("button", { name: "Reactivate record" }));
	expect(await screen.findByText("Active")).toBeVisible();
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Record reactivated."
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
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);

	fireEvent.click(
		await screen.findByRole("button", { name: "Archive record" })
	);
	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Check status" }));

	expect(
		await screen.findByText("Current record status: Active.")
	).toBeVisible();
	expect(screen.getByRole("button", { name: "Archive record" })).toBeEnabled();
});

test("labels legacy Asset Records whose identity criteria were not recorded", async () => {
	fakeApi.record = { ...assetRecord, identityCriteria: [] };
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Versions and files" })
	);

	expect(await screen.findByText("No rationale saved")).toBeVisible();
});

const approvedVersionForFamily = {
	createdAt: "2026-09-25T08:01:00.000Z",
	fileName: "ash-knight.png",
	id: "f7b32d26-6b7c-4e16-a578-dac3e0dab68b",
	productionEvidence: unknownVersionProductionEvidence,
	reviewDisposition: "approved",
	sha256: null,
	versionNumber: 1,
};
const familyWorldId = "742cbe57-ecb0-4616-8d1f-71723ad8cd62";
const derivedRecordId = "5d0f6a1e-6d55-4c39-8f39-3c3d0b9a2f11";

function trackingDetail(tracking: Record<string, unknown>) {
	return {
		record: assetRecord,
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
			...tracking,
		},
	};
}

test("creates an Asset Family from the approved version with trimmed values", async () => {
	fakeApi.detail = trackingDetail({
		approvedVersion: approvedVersionForFamily,
		visualWorlds: [{ id: familyWorldId, name: "Gameplay" }],
	});
	fakeApi.createFamily.mockResolvedValue({ id: "family" });
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	const createButton = await screen.findByRole("button", {
		name: "Create family",
	});
	expect(createButton).toBeDisabled();
	fireEvent.change(screen.getByLabelText("Family name"), {
		target: { value: "  Ash family  " },
	});
	fireEvent.change(
		screen.getByLabelText("Usage context", {
			selector: "#family-use-context",
		}),
		{
			target: { value: "   " },
		}
	);
	fireEvent.change(
		screen.getByLabelText("Visual World", { selector: "#family-world" }),
		{ target: { value: familyWorldId } }
	);
	expect(createButton).toBeDisabled();
	fireEvent.change(
		screen.getByLabelText("Usage context", {
			selector: "#family-use-context",
		}),
		{
			target: { value: " Combat sprite " },
		}
	);
	expect(createButton).toBeEnabled();
	fireEvent.click(createButton);

	await waitFor(() =>
		expect(fakeApi.createFamily).toHaveBeenCalledWith({
			assetRecordId: assetRecord.id,
			canonicalVersionId: approvedVersionForFamily.id,
			id: expect.any(String),
			name: "Ash family",
			projectId,
			useContext: "Combat sprite",
			visualWorldId: familyWorldId,
		})
	);
	expect(await screen.findByText("Asset Family saved.")).toBeVisible();
});

test("reuses the Asset Family request identity when an uncertain create is retried", async () => {
	fakeApi.detail = trackingDetail({
		approvedVersion: approvedVersionForFamily,
		visualWorlds: [{ id: familyWorldId, name: "Gameplay" }],
	});
	fakeApi.createFamily
		.mockRejectedValueOnce(new TypeError("Failed to fetch"))
		.mockResolvedValueOnce({ id: "family" });
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.change(await screen.findByLabelText("Family name"), {
		target: { value: "Ash family" },
	});
	fireEvent.change(
		screen.getByLabelText("Usage context", {
			selector: "#family-use-context",
		}),
		{
			target: { value: "Combat sprite" },
		}
	);
	fireEvent.change(
		screen.getByLabelText("Visual World", { selector: "#family-world" }),
		{ target: { value: familyWorldId } }
	);
	fireEvent.click(screen.getByRole("button", { name: "Create family" }));
	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.getByRole("button", { name: "Create family" })).toBeDisabled();
	expect(screen.getByLabelText("Family name")).toHaveValue("Ash family");
	fireEvent.click(screen.getByRole("button", { name: "Check status" }));
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Create family" })).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Create family" }));
	await waitFor(() => expect(fakeApi.createFamily).toHaveBeenCalledTimes(2));
	expect(fakeApi.createFamily.mock.calls[1]?.[0].id).toBe(
		fakeApi.createFamily.mock.calls[0]?.[0].id
	);
});

test("links a derivative with keyboard-selected dependency facets", async () => {
	const user = userEvent.setup();
	fakeApi.detail = trackingDetail({
		approvedVersion: approvedVersionForFamily,
		availableRecords: [
			{ assetFamilyId: null, id: derivedRecordId, name: "Ash Knight idle" },
		],
		family: {
			canonicalVersionId: approvedVersionForFamily.id,
			id: "2e289929-ad8b-4b76-b7c5-e18b001d8214",
			name: "Ash Knight gameplay",
			useContext: "Combat sprite",
			visualWorldId: familyWorldId,
			visualWorldName: "Gameplay",
		},
	});
	fakeApi.createDerivative.mockResolvedValue({ id: "derivative" });
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	const linkButton = await screen.findByRole("button", {
		name: "Link derivative",
	});
	expect(linkButton).toBeDisabled();
	fireEvent.change(screen.getByLabelText("Derived Asset Record"), {
		target: { value: derivedRecordId },
	});
	expect(linkButton).toBeDisabled();
	const silhouette = screen.getByRole("checkbox", { name: "Silhouette" });
	silhouette.focus();
	await user.keyboard(" ");
	expect(silhouette).toBeChecked();
	await user.click(screen.getByRole("checkbox", { name: "Palette" }));
	await user.click(screen.getByRole("checkbox", { name: "Palette" }));
	expect(screen.getByRole("checkbox", { name: "Palette" })).not.toBeChecked();
	expect(linkButton).toBeEnabled();
	fireEvent.click(linkButton);

	await waitFor(() =>
		expect(fakeApi.createDerivative).toHaveBeenCalledWith({
			canonicalVersionId: approvedVersionForFamily.id,
			dependencyFacets: ["silhouette"],
			derivedAssetRecordId: derivedRecordId,
			id: expect.any(String),
			projectId,
			sourceAssetRecordId: assetRecord.id,
		})
	);
	expect(await screen.findByText("Derived Asset link saved.")).toBeVisible();
});

test("keeps the candidate version save disabled until missing history is described", async () => {
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	await screen.findByRole("heading", { name: "Create Candidate Version" });
	const submitButton = screen.getByRole("button", {
		name: "Save Candidate Version",
	});
	const uploadedFile = new File([new Uint8Array([1])], "legacy.png", {
		type: "image/png",
	});
	fireEvent.change(screen.getByLabelText("PNG or WebP file"), {
		target: { files: [uploadedFile] },
	});
	fireEvent.change(screen.getByLabelText("Unknown production history"), {
		target: { value: "   " },
	});
	expect(submitButton).toBeDisabled();
	fireEvent.change(screen.getByLabelText("PNG or WebP file"), {
		target: {
			files: [
				new File([new Uint8Array([1])], "legacy.gif", { type: "image/gif" }),
			],
		},
	});
	fireEvent.change(screen.getByLabelText("Unknown production history"), {
		target: { value: "Instruction unavailable." },
	});
	expect(submitButton).toBeDisabled();
	fireEvent.change(screen.getByLabelText("PNG or WebP file"), {
		target: { files: [uploadedFile] },
	});
	expect(submitButton).toBeEnabled();
});

test("keeps an unsaved metadata draft when switching workspace sections", async () => {
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);
	await screen.findByRole("heading", { name: "Asset Record metadata" });
	fireEvent.change(screen.getByLabelText("Tags"), {
		target: { value: "unfinished-edit" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Versions and files" }));
	fireEvent.click(screen.getByRole("button", { name: "Record details" }));

	expect(screen.getByLabelText("Tags")).toHaveValue("unfinished-edit");
	expect(fakeApi.updateMetadata).not.toHaveBeenCalled();
});

test("sends normalized unique metadata tags and keeps the draft when saving fails", async () => {
	fakeApi.updateMetadata.mockRejectedValue(new Error("write failed"));
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);
	await screen.findByRole("heading", { name: "Asset Record metadata" });
	fireEvent.change(screen.getByLabelText("Tags"), {
		target: { value: " Envanter, nadir ,envanter,, " },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));

	await waitFor(() =>
		expect(fakeApi.updateMetadata).toHaveBeenCalledWith({
			assetCategory: null,
			assetRecordId: assetRecord.id,
			projectId,
			tags: ["envanter", "nadir"],
			themeId: null,
			visualWorldId: null,
		})
	);
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Could not save Asset Record metadata."
	);
	expect(screen.getByLabelText("Tags")).toHaveValue(
		" Envanter, nadir ,envanter,, "
	);
	expect(screen.getByLabelText("Theme", { selector: "select" })).toBeDisabled();
});

test("clears a measurement validation error as soon as a value changes", async () => {
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);
	await screen.findByRole("heading", { name: "Ash Knight" });
	for (const [label, value] of [
		["Logical Resolution — Proposal — Width (px)", "32"],
		["Logical Resolution — Proposal — Height (px)", "32"],
		["Visible Content Bounds — Proposal — X (px)", "3"],
		["Visible Content Bounds — Proposal — Y (px)", "4"],
		["Visible Content Bounds — Proposal — Width (px)", "30"],
		["Visible Content Bounds — Proposal — Height (px)", "10"],
	] as const) {
		fireEvent.change(screen.getByLabelText(label), { target: { value } });
	}
	fireEvent.change(
		screen.getByLabelText(
			"Visible Content Bounds — Proposal — Koordinat temeli"
		),
		{ target: { value: "logicalResolution" } }
	);
	fireEvent.click(screen.getByRole("button", { name: "Save dimensions" }));
	expect(await screen.findByRole("alert")).toBeVisible();

	fireEvent.change(
		screen.getByLabelText("Visible Content Bounds — Proposal — X (px)"),
		{ target: { value: "2" } }
	);
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	expect(fakeApi.updateMeasurements).not.toHaveBeenCalled();
});

test("shows the generic measurement error for an incomplete pair without sending it", async () => {
	renderWithQueryClient(
		<AssetRecordDetailView
			assetRecordId={assetRecord.id}
			projectId={projectId}
		/>
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "Record details" })
	);
	await screen.findByRole("heading", { name: "Ash Knight" });
	fireEvent.change(
		screen.getByLabelText("Atlas Dimensions — Confirmed value — Width (px)"),
		{ target: { value: "64" } }
	);
	fireEvent.submit(
		screen
			.getByRole("button", { name: "Save dimensions" })
			.closest("form") as HTMLFormElement
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Could not save dimensions. Check the values and try again."
	);
	expect(fakeApi.updateMeasurements).not.toHaveBeenCalled();
});

test("requires a non-blank name and an identity criterion before creating an Asset Record", async () => {
	const user = userEvent.setup();
	const onOpenRecord = vi.fn();
	fakeApi.create.mockResolvedValue(assetRecord);
	renderWithQueryClient(
		<AssetRecordsView onOpenRecord={onOpenRecord} projectId={projectId} />
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "New Asset Record" })
	);
	await screen.findByRole("dialog", { name: "New Asset Record" });
	const createButton = screen.getByRole("button", {
		name: "Create Asset Record",
	});
	fireEvent.change(screen.getByLabelText("Asset name"), {
		target: { value: "   " },
	});
	const criterion = screen.getByRole("checkbox", {
		name: identityCheckboxName,
	});
	criterion.focus();
	await user.keyboard(" ");
	expect(criterion).toBeChecked();
	expect(createButton).toBeDisabled();
	fireEvent.change(screen.getByLabelText("Asset name"), {
		target: { value: "  Ash Knight  " },
	});
	await user.keyboard(" ");
	expect(criterion).not.toBeChecked();
	expect(createButton).toBeDisabled();
	fireEvent.click(criterion);
	fireEvent.click(
		screen.getByRole("checkbox", { name: deliveryIdentityCheckboxName })
	);
	expect(createButton).toBeEnabled();
	fireEvent.click(createButton);

	await waitFor(() =>
		expect(onOpenRecord).toHaveBeenCalledWith(assetRecord.id)
	);
	expect(fakeApi.create).toHaveBeenCalledWith({
		id: expect.any(String),
		identityCriteria: ["independent_product_meaning", "delivery_identity"],
		name: "Ash Knight",
		projectId,
	});
});

test("locks the Asset Record draft while an uncertain create is unresolved", async () => {
	const user = userEvent.setup();
	fakeApi.create.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	renderWithQueryClient(
		<AssetRecordsView onOpenRecord={vi.fn()} projectId={projectId} />
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "New Asset Record" })
	);
	await screen.findByRole("dialog", { name: "New Asset Record" });
	fireEvent.change(screen.getByLabelText("Asset name"), {
		target: { value: "Ash Knight" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: identityCheckboxName }));
	fireEvent.click(screen.getByRole("button", { name: "Create Asset Record" }));

	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.getByLabelText("Asset name")).toBeDisabled();
	expect(screen.getByLabelText("Asset name")).toHaveValue("Ash Knight");
	const criterion = screen.getByRole("checkbox", {
		name: identityCheckboxName,
	});
	expect(criterion).toBeChecked();
	await user.click(criterion);
	expect(criterion).toBeChecked();
});

test("pages the Asset Record catalog without dropping later records", async () => {
	fakeApi.records = Array.from({ length: 51 }, (_, index) => ({
		...assetRecord,
		id: `catalog-${index}`,
		name: `Catalog ${index}`,
	}));
	renderWithQueryClient(
		<AssetRecordsView onOpenRecord={vi.fn()} projectId={projectId} />
	);
	fireEvent.click(await screen.findByRole("button", { name: "All records" }));
	expect(await screen.findByText("Catalog 0")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Next" }));
	expect(await screen.findByText("Catalog 50")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Previous" }));
	expect(await screen.findByText("Catalog 0")).toBeVisible();
});

test("checks an uncertain create by its identity even when the record is beyond the first page", async () => {
	const onOpenRecord = vi.fn();
	fakeApi.records = Array.from({ length: 50 }, (_, index) => ({
		...assetRecord,
		id: `catalog-${index}`,
		name: `Catalog ${index}`,
	}));
	fakeApi.create.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	renderWithQueryClient(
		<AssetRecordsView onOpenRecord={onOpenRecord} projectId={projectId} />
	);
	fireEvent.click(
		await screen.findByRole("button", { name: "New Asset Record" })
	);
	fireEvent.change(screen.getByLabelText("Asset name"), {
		target: { value: "Ash Knight" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: identityCheckboxName }));
	fireEvent.click(screen.getByRole("button", { name: "Create Asset Record" }));
	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	const id = fakeApi.create.mock.calls[0]?.[0].id;
	fakeApi.records.push({ ...assetRecord, id });
	fireEvent.click(screen.getByRole("button", { name: "Check status" }));
	await waitFor(() => expect(onOpenRecord).toHaveBeenCalledWith(id));
});
