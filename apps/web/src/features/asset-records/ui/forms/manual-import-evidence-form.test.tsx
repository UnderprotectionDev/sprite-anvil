// @vitest-environment jsdom

import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { ManualImportEvidenceForm } from "./manual-import-evidence-form";

const projectId = "c2edb5dc-a82f-42b2-84bb-a878ca20fabf";
const assetRecordId = "7ea123f0-2bd0-4b38-ab57-29477a1366e6";
const generationPackageId = "7b73a4c6-835a-49ed-a84d-f63440351d07";
const fakeApi = vi.hoisted(() => ({
	createManualImportVersion: vi.fn(),
	packages: [] as GenerationPackage[],
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		assetRecords: {
			createManualImportVersion: (input: unknown) =>
				fakeApi.createManualImportVersion(input),
		},
	},
	orpc: {
		generationPackages: {
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["generation-packages", input],
					queryFn: async () => fakeApi.packages,
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.createManualImportVersion.mockReset();
	fakeApi.packages = [];
});

const record: AssetRecord = {
	assetCategory: "character_creature_animation",
	availability: "active",
	createdAt: "2026-09-28T08:00:00.000Z",
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
};

const generationPackage = {
	assetRecordId,
	createdAt: "2026-09-28T09:00:00.000Z",
	id: generationPackageId,
	projectId,
	targetTask: "Create a four-frame attack animation.",
} as GenerationPackage;

test("saves the exact manual result and evidence against its Generation Package", async () => {
	const user = userEvent.setup();
	const onRefresh = vi.fn().mockResolvedValue(undefined);
	fakeApi.packages = [generationPackage];
	fakeApi.createManualImportVersion.mockResolvedValue({
		contentDigest: "a".repeat(64),
		contentLength: 3,
		contentType: "image/png",
		createdAt: "2026-09-28T09:01:00.000Z",
		fileName: "attack-result.png",
		id: "ad800472-d38e-4076-835a-ae4f51cd7db6",
		integrityVerified: true,
		projectId,
		reviewDisposition: "candidate",
		sourceKind: "manual_import",
		versionNumber: 1,
	});
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ManualImportEvidenceForm onRefresh={onRefresh} record={record} />
		</QueryClientProvider>
	);

	const file = new File([new Uint8Array([1, 2, 3])], "attack-result.png", {
		type: "image/png",
	});
	Object.defineProperty(file, "arrayBuffer", {
		value: async () => new Uint8Array([1, 2, 3]).buffer,
	});
	await screen.findByLabelText("Sonuç dosyası");
	await user.upload(screen.getByLabelText("Sonuç dosyası"), file);
	await user.selectOptions(
		screen.getByLabelText("Üretim Paketi"),
		generationPackageId
	);
	await user.type(screen.getByLabelText("Üretim yüzeyi"), "ComfyUI 0.3.22");
	const instruction =
		"Preserve the silhouette.\nChange only the cape material.";
	await user.type(screen.getByLabelText("Gerçek üretim talimatı"), instruction);
	expect(
		(screen.getByLabelText("Sonuç dosyası") as HTMLInputElement).files
	).toHaveLength(1);
	const form = screen
		.getByRole("button", {
			name: "Kanıtla birlikte aday sürümü kaydet",
		})
		.closest("form") as HTMLFormElement;
	fireEvent.submit(form);

	await waitFor(() =>
		expect(fakeApi.createManualImportVersion).toHaveBeenCalledWith(
			expect.objectContaining({
				assetRecordId,
				contentBase64: "AQID",
				contentType: "image/png",
				fileName: "attack-result.png",
				generationInstruction: instruction,
				generationPackageId,
				projectId,
				sourceSurface: "ComfyUI 0.3.22",
			})
		)
	);
	expect(onRefresh).toHaveBeenCalledOnce();
	expect(screen.getByRole("status")).toHaveTextContent(
		"Elle İçe Aktarma Kanıtı kaydedildi"
	);
});
