// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AssetFamilyComparisonRecord } from "@sprite-anvil/api/asset-family-comparisons";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AssetFamilyComparisonManager } from "./asset-family-comparison-manager";

const uncertainMessage = /Kaydetme sonucu doğrulanamadı/;
const existingRecordButtonName = /· 2 Varlık Sürümü/;
const closedCrateCheckboxName = /Kapalı sandık/;
const openCrateCheckboxName = /Açık sandık/;
const mocks = vi.hoisted(() => ({
	save: vi.fn(),
	list: vi.fn(),
}));
vi.mock("@/utils/orpc", () => ({
	client: { assetFamilyComparisons: { save: mocks.save } },
	orpc: {
		assetFamilyComparisons: {
			list: {
				queryOptions: () => ({
					queryKey: ["asset-family-comparisons"],
					queryFn: mocks.list,
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});

const profileId = "object_weapon_equipment_states";
const objectContract = specializedProfileContractCatalog.find(
	(candidate) => candidate.profileId === profileId
);
if (!objectContract) {
	throw new Error("Object and equipment profile contract is missing.");
}

const catalog = {
	assetVersions: [
		{
			id: "version-one",
			projectId: "project",
			assetFamilyId: "family",
			assetRecordId: "record-one",
			versionNumber: 1,
			previewUrl: "/preview-one.png",
		},
		{
			id: "version-two",
			projectId: "project",
			assetFamilyId: "family",
			assetRecordId: "record-two",
			versionNumber: 1,
			previewUrl: "/preview-two.png",
		},
	],
	canonicalDesigns: [],
	compositeVersions: [],
	unitVersions: [],
};

const assetRecords = [
	{
		id: "record-one",
		assetFamilyId: "family",
		name: "Kapalı sandık",
		assetCategory: profileId,
		availability: "active",
	},
	{
		id: "record-two",
		assetFamilyId: "family",
		name: "Açık sandık",
		assetCategory: profileId,
		availability: "active",
	},
];

function savedRecord(id: string): AssetFamilyComparisonRecord {
	return {
		id,
		projectId: "project",
		assetFamilyId: "family",
		contractRevisionId: "contract",
		contractSnapshot:
			objectContract as AssetFamilyComparisonRecord["contractSnapshot"],
		observations: {
			scale: "Her iki sürüm aynı oyun içi ölçeği kullanıyor.",
			perspective: "Perspektif düşük kuşbakışı.",
			materialLanguage: "Malzeme dili aynı.",
			stateDirectionDistinction: "Durumlar ayrışıyor.",
		},
		assetVersions: [
			{
				assetRecordId: "record-one",
				assetVersionId: "version-one",
				unitVersionIds: [],
			},
			{
				assetRecordId: "record-two",
				assetVersionId: "version-two",
				unitVersionIds: [],
			},
		],
		createdAt: "2026-10-05T10:00:00.000Z",
		reviewedByUserId: "user",
		versionPins: [
			{
				assetRecordId: "record-one",
				assetRecordName: "Kapalı sandık",
				assetVersionId: "version-one",
				contentDigest: "1".repeat(64),
				unitVersions: [],
				versionNumber: 1,
			},
			{
				assetRecordId: "record-two",
				assetRecordName: "Açık sandık",
				assetVersionId: "version-two",
				contentDigest: "2".repeat(64),
				unitVersions: [],
				versionNumber: 1,
			},
		],
	};
}

function mount() {
	mocks.list.mockResolvedValue([savedRecord("existing")]);
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<AssetFamilyComparisonManager
				activation={
					{
						contract: objectContract,
						contractRevisionId: "contract",
					} as never
				}
				assetFamilyId="family"
				assetRecords={assetRecords as never}
				catalog={catalog as never}
				familyName="Sandık"
				projectId="project"
			/>
		</QueryClientProvider>
	);
}

async function fillComparisonForm() {
	await waitFor(() =>
		expect(
			screen.getByRole("checkbox", { name: closedCrateCheckboxName })
		).toBeEnabled()
	);
	fireEvent.click(
		screen.getByRole("checkbox", { name: closedCrateCheckboxName })
	);
	fireEvent.click(
		screen.getByRole("checkbox", { name: openCrateCheckboxName })
	);
	fireEvent.change(screen.getByLabelText("Ölçek gözlemi"), {
		target: { value: "Her iki sürüm aynı oyun içi ölçeği kullanıyor." },
	});
	fireEvent.change(screen.getByLabelText("Perspektif gözlemi"), {
		target: { value: "Perspektif düşük kuşbakışı." },
	});
	fireEvent.change(screen.getByLabelText("Malzeme dili gözlemi"), {
		target: { value: "Malzeme dili aynı." },
	});
	fireEvent.change(screen.getByLabelText("Durum ve yön ayrışması gözlemi"), {
		target: { value: "Durumlar ayrışıyor." },
	});
}

test("an uncertain save cannot be bypassed by opening an older comparison", async () => {
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	mount();

	await fillComparisonForm();
	const saveButton = screen.getByRole("button", {
		name: "Karşılaştırmayı kaydet",
	});
	await waitFor(() => expect(saveButton).toBeEnabled());
	fireEvent.click(saveButton);
	await screen.findByText(uncertainMessage);

	expect(
		screen.getByRole("button", { name: "Karşılaştırmayı kaydet" })
	).toBeDisabled();
	const existingRecordButton = screen.getByRole("button", {
		name: existingRecordButtonName,
	});
	expect(existingRecordButton).toBeDisabled();
	fireEvent.click(existingRecordButton);
	expect(
		screen.queryByRole("button", { name: "Yeni karşılaştırma" })
	).not.toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Güncel karşılaştırmaları kontrol et" })
	).toBeEnabled();

	const pendingInput = mocks.save.mock.calls[0]?.[0] as { id: string };
	mocks.list.mockResolvedValueOnce([
		savedRecord(pendingInput.id),
		savedRecord("existing"),
	]);
	fireEvent.click(
		screen.getByRole("button", { name: "Güncel karşılaştırmaları kontrol et" })
	);
	await screen.findByText("Karşılaştırma kalıcı kayıttan doğrulandı.");
	expect(
		screen.getByRole("button", { name: "Yeni karşılaştırma" })
	).toBeEnabled();
});

test("starts a new comparison with cleared selections and observations", async () => {
	mocks.save.mockResolvedValue(savedRecord("fresh"));
	mount();

	await fillComparisonForm();
	const saveButton = screen.getByRole("button", {
		name: "Karşılaştırmayı kaydet",
	});
	await waitFor(() => expect(saveButton).toBeEnabled());
	fireEvent.click(saveButton);
	await screen.findByText("Karşılaştırma kalıcı kayıttan doğrulandı.");

	fireEvent.click(screen.getByRole("button", { name: "Yeni karşılaştırma" }));
	expect(
		screen.getByRole("checkbox", { name: closedCrateCheckboxName })
	).not.toBeChecked();
	expect(
		screen.getByRole("checkbox", { name: openCrateCheckboxName })
	).not.toBeChecked();
	expect(screen.getByLabelText("Ölçek gözlemi")).toHaveValue("");
	expect(screen.getByLabelText("Perspektif gözlemi")).toHaveValue("");
	expect(screen.getByLabelText("Malzeme dili gözlemi")).toHaveValue("");
	expect(screen.getByLabelText("Durum ve yön ayrışması gözlemi")).toHaveValue(
		""
	);
	expect(
		screen.getByRole("button", { name: "Karşılaştırmayı kaydet" })
	).toBeDisabled();
});
