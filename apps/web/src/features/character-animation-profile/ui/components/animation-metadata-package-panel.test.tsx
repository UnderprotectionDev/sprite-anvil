// @vitest-environment jsdom

import type { AnimationMetadataPackage } from "@sprite-anvil/api/animation-metadata-package";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { AnimationMetadataPackagePanel } from "./animation-metadata-package-panel";

const projectId = "animation-metadata-project";
const assetRecordId = "animation-metadata-record";
const compositeVersions = [
	{
		id: "composite-v1",
		projectId,
		assetRecordId,
		versionNumber: 1,
		reviewDisposition: "candidate" as const,
		reviewEvents: [],
		compositionMemberships: [],
		createdAt: "2026-10-01T08:00:00.000Z",
	},
	{
		id: "composite-v2",
		projectId,
		assetRecordId,
		versionNumber: 2,
		reviewDisposition: "candidate" as const,
		reviewEvents: [],
		compositionMemberships: [],
		createdAt: "2026-10-02T08:00:00.000Z",
	},
];
const fakeApi = vi.hoisted(() => ({
	createPackage: vi.fn(),
	readPackage: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		animationMetadataPackage: {
			createPackage: (input: unknown) => fakeApi.createPackage(input),
			readPackage: (input: unknown) => fakeApi.readPackage(input),
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
						unitVersions: [],
						compositeVersions,
					}),
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.createPackage.mockReset();
	fakeApi.readPackage.mockReset();
});

beforeEach(() => {
	fakeApi.createPackage.mockResolvedValue(packageValue);
	fakeApi.readPackage.mockResolvedValue(packageValue);
});

const packageValue = {
	format: "sprite-anvil.animation-metadata",
	schemaVersion: "1.0.0",
	contentDigest: "a".repeat(64),
	compositeVersion: {
		id: "composite-v1",
		projectId,
		assetRecordId,
		versionNumber: 1,
		createdAt: "2026-10-01T08:00:00.000Z",
		compositionMemberships: [],
	},
	unitVersions: [],
	assetVersionPins: [],
	frames: [],
	records: [],
} satisfies AnimationMetadataPackage;

const record = {
	assetCategory: "character_creature_animation",
	availability: "active",
	createdAt: "2026-10-01T08:00:00.000Z",
	id: assetRecordId,
	identityCriteria: ["independent_product_meaning"],
	measurements: {
		atlasDimensions: { confirmed: null, proposal: null },
		cellDimensions: { confirmed: null, proposal: null },
		displayScale: { confirmed: null, proposal: null },
		logicalResolution: { confirmed: null, proposal: null },
		sourceImageDimensions: { confirmed: null, proposal: null },
		visibleContentBounds: { confirmed: null, proposal: null },
	},
	name: "Ash Knight attack",
	projectId,
	supportLevel: "general",
	tags: [],
} as AssetRecord;

function renderPanel(panelRecord = record) {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	return render(
		<QueryClientProvider client={queryClient}>
			<AnimationMetadataPackagePanel
				projectId={projectId}
				record={panelRecord}
			/>
		</QueryClientProvider>
	);
}

test("exports and rereads an Animation Metadata Package for the selected historical Composite Version", async () => {
	const createObjectUrl = vi
		.spyOn(URL, "createObjectURL")
		.mockReturnValue("blob:animation-metadata");
	vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
	vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
		() => undefined
	);

	renderPanel();

	const compositeSelect = await screen.findByRole("combobox", {
		name: "Birleşik Sürüm",
	});
	fireEvent.change(compositeSelect, { target: { value: "composite-v1" } });
	fireEvent.click(
		screen.getByRole("button", { name: "Animasyon metadata paketini indir" })
	);

	await waitFor(() => expect(fakeApi.createPackage).toHaveBeenCalledOnce());
	expect(fakeApi.createPackage).toHaveBeenCalledWith({
		projectId,
		assetRecordId,
		compositeVersionId: "composite-v1",
	});
	expect(createObjectUrl).toHaveBeenCalledOnce();
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Animasyon metadata paketi indirildi."
	);

	const fileInput = screen.getByLabelText(
		"Animasyon metadata paketini yeniden oku"
	);
	const packageFile = new File(
		[JSON.stringify(packageValue)],
		"animation.json",
		{
			type: "application/json",
		}
	);
	fireEvent.change(fileInput, { target: { files: [packageFile] } });

	await waitFor(() => expect(fakeApi.readPackage).toHaveBeenCalledOnce());
	expect(fakeApi.readPackage).toHaveBeenCalledWith({
		projectId,
		assetRecordId,
		compositeVersionId: "composite-v1",
		package: packageValue,
	});
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Paket yeniden okundu; metadata ve kesin sürümler seçili Birleşik Sürümle eşleşiyor."
	);
	expect(
		screen.getByText(
			"Paket seçili bileşimin metadata'sını, kareye bağlı Oyun İçi Bilgilerini ve kesin sürüm kimliklerini taşır. Kare süreleri ve atlas bölgeleri ayrı Kimlik ve Yön Tutarlılığı İncelemesi kaydında kalır; görsel dosyalar ve tam Dışa Aktarım Paketi kapsam dışıdır."
		)
	).toBeVisible();
});

test("does not render the Animation Metadata Package for another asset category", () => {
	renderPanel({ ...record, assetCategory: "icon" });

	expect(
		screen.queryByRole("region", { name: "Animasyon Metadata Paketi" })
	).not.toBeInTheDocument();
});
