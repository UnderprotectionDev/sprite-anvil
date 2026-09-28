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
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { GenerationPackagePanel } from "./generation-package-panel";

const projectId = "c2edb5dc-a82f-42b2-84bb-a878ca20fabf";
const assetRecordId = "7ea123f0-2bd0-4b38-ab57-29477a1366e6";
const unitVersionId = "8c5f037c-b8cd-46f0-840a-890516e02f87";
const unitVersionLabel = /idle-01.*Sürüm 2/;
const targetTaskLabel = /Create a four-frame attack animation\./;
const referenceFeatureLabels =
	/Aktarılabilir: Poz veya hareket · Kaçınılacak: Kimlik/;
const fakeApi = vi.hoisted(() => ({
	create: vi.fn(),
	packages: [] as GenerationPackage[],
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		generationPackages: {
			create: (input: unknown) => fakeApi.create(input),
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
						unitVersions: [
							{
								assetRecordId,
								assetVersionId: "ad800472-d38e-4076-835a-ae4f51cd7db6",
								createdAt: "2026-09-28T08:00:00.000Z",
								id: unitVersionId,
								projectId,
								sourceAssetVersionId: "ad800472-d38e-4076-835a-ae4f51cd7db6",
								unitKey: "idle-01",
								unitType: "frame",
								versionNumber: 2,
							},
						],
					}),
				}),
			},
		},
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
	fakeApi.create.mockReset();
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
		logicalResolution: {
			confirmed: { height: 80, width: 72 },
			proposal: null,
		},
		sourceImageDimensions: { confirmed: null, proposal: null },
		visibleContentBounds: { confirmed: null, proposal: null },
	},
	name: "Ash Knight attack",
	projectId,
	supportLevel: "general",
	tags: [],
};

function renderPanel(panelRecord = record) {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	return render(
		<QueryClientProvider client={queryClient}>
			<GenerationPackagePanel projectId={projectId} record={panelRecord} />
		</QueryClientProvider>
	);
}

test("does not infer target dimensions from confirmed source image pixels", () => {
	const recordWithoutLogicalResolution: AssetRecord = {
		...record,
		measurements: {
			...record.measurements,
			logicalResolution: { confirmed: null, proposal: null },
			sourceImageDimensions: {
				confirmed: { height: 160, width: 144 },
				proposal: null,
			},
		},
	};
	renderPanel(recordWithoutLogicalResolution);

	expect(screen.getByLabelText("Hedef genişlik (px)")).toHaveValue(null);
	expect(screen.getByLabelText("Hedef yükseklik (px)")).toHaveValue(null);
});

test("creates a Generation Package from the task form and shows the saved copy", async () => {
	fakeApi.create.mockImplementation((input: Record<string, unknown>) => {
		const created = {
			assetRecord: record,
			assetRecordId,
			avoidConstraints: input.avoidConstraints,
			canonicalDesign: null,
			changeConstraints: input.changeConstraints,
			createdAt: "2026-09-28T09:00:00.000Z",
			expectedOutputStructure: input.expectedOutputStructure,
			id: "7b73a4c6-835a-49ed-a84d-f63440351d07",
			lockedUnits: [
				{
					assetVersionId: "ad800472-d38e-4076-835a-ae4f51cd7db6",
					id: unitVersionId,
					sourceAssetVersionId: "ad800472-d38e-4076-835a-ae4f51cd7db6",
					unitKey: "idle-01",
					unitType: "frame",
					versionNumber: 2,
				},
			],
			preserveConstraints: input.preserveConstraints,
			productionContextSnapshot: {
				contextRevisionId: "60d3bf8c-1940-4c25-924f-b98122d5787f",
				generalArtDirection: "Readable silhouettes.",
				ruleContractVersion: "context-rule/1.0.0",
				rules: [],
				revisionNumber: 2,
				theme: null,
				visualWorld: null,
			},
			projectId,
			referenceRoles: [
				{
					assetRecordId: null,
					assetRecordName: null,
					assetVersionId: null,
					contentDigest: "b".repeat(64),
					contentType: "image/png",
					contextOverrideRationale: null,
					customPurpose: null,
					fileName: "pose-reference.png",
					forbiddenFeatures: ["identity"],
					id: "8de89a35-70c1-4ca2-9a18-4d467ed1a817",
					kind: "reference_image",
					notes: null,
					role: "pose",
					transferredFeatures: ["pose"],
					versionNumber: null,
				},
			],
			targetDimensions: input.targetDimensions,
			targetTask: input.targetTask,
		} as GenerationPackage;
		fakeApi.packages = [created];
		return created;
	});
	renderPanel();

	fireEvent.change(screen.getByLabelText("Üretim hedefi"), {
		target: { value: "Create a four-frame attack animation." },
	});
	fireEvent.change(screen.getByLabelText("Beklenen çıktı yapısı"), {
		target: { value: "A four-frame PNG sprite sheet." },
	});
	fireEvent.click(
		await screen.findByRole("checkbox", { name: unitVersionLabel })
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Üretim Paketini sabitle" })
	);

	await waitFor(() => expect(fakeApi.create).toHaveBeenCalledOnce());
	expect(fakeApi.create).toHaveBeenCalledWith(
		expect.objectContaining({
			assetRecordId,
			expectedOutputStructure: "A four-frame PNG sprite sheet.",
			lockedUnitVersionIds: [unitVersionId],
			projectId,
			targetDimensions: { height: 80, width: 72 },
			targetTask: "Create a four-frame attack animation.",
		})
	);
	const savedPackage = await screen.findByText(targetTaskLabel);
	expect(savedPackage).toBeVisible();
	fireEvent.click(savedPackage);
	expect(
		await screen.findByText("A four-frame PNG sprite sheet.")
	).toBeVisible();
	expect(screen.getByText(referenceFeatureLabels)).toBeVisible();
});
