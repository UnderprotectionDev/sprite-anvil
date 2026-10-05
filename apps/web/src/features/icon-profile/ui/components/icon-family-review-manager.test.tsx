// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type {
	IconFamilyReviewInput,
	IconFamilyReviewRecord,
} from "@sprite-anvil/api/icon-family-reviews";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { IconFamilyReviewManager } from "./icon-family-review-manager";

const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	client: { iconFamilyReviews: { save: mocks.save } },
	orpc: {
		iconFamilyReviews: {
			list: {
				queryOptions: () => ({
					queryKey: ["icon-family-reviews"],
					queryFn: mocks.list,
				}),
			},
		},
	},
}));

function getIconContract() {
	const iconContract = specializedProfileContractCatalog.find(
		(definition) => definition.profileId === "icon"
	);
	if (!iconContract) {
		throw new Error("The icon Specialized Profile Contract is required.");
	}
	return iconContract;
}

const contract = getIconContract();

const versionSummaries = [
	{
		assetRecordId: "record-health",
		assetRecordName: "Health potion",
		assetVersionId: "version-health",
		contentDigest: "a".repeat(64),
		contentLength: 120,
		contentType: "image/png" as const,
		versionNumber: 3,
	},
	{
		assetRecordId: "record-mana",
		assetRecordName: "Mana potion",
		assetVersionId: "version-mana",
		contentDigest: "b".repeat(64),
		contentLength: 96,
		contentType: "image/webp" as const,
		versionNumber: 2,
	},
];

let persistedReviews: IconFamilyReviewRecord[] = [];
const inventorySizeText = "Health potion · inventory-slot · 24 × 24 px";

function makeReview(input: IconFamilyReviewInput): IconFamilyReviewRecord {
	return {
		...input,
		contractSnapshot: contract,
		createdAt: "2026-10-05T09:00:00.000Z",
		reviewedByUserId: "user-1",
		versionPins: versionSummaries,
	};
}

type ManagerProps = ComponentProps<typeof IconFamilyReviewManager>;

const defaultAssetRecords: ManagerProps["assetRecords"] = [
	{
		assetCategory: "icon",
		availability: "active",
		id: "record-health",
		name: "Health potion",
	},
	{
		assetCategory: "icon",
		availability: "active",
		id: "record-mana",
		name: "Mana potion",
	},
];

const defaultVersions: ManagerProps["versions"] = [
	{
		id: versionSummaries[0].assetVersionId,
		...versionSummaries[0],
		assetFamilyId: "family-1",
		integrityVerified: true,
		previewUrl: "/assets/health-preview.png",
	},
	{
		id: versionSummaries[1].assetVersionId,
		...versionSummaries[1],
		assetFamilyId: "family-1",
		integrityVerified: true,
		previewUrl: "/assets/mana-preview.png",
	},
];

function createManager(
	queryClient: QueryClient,
	assetRecords: ManagerProps["assetRecords"],
	versions: ManagerProps["versions"]
) {
	return (
		<QueryClientProvider client={queryClient}>
			<IconFamilyReviewManager
				activation={{
					activatedAt: "2026-10-05T09:00:00.000Z",
					activatedByUserId: "user-1",
					contract,
					contractRevisionId: "contract-revision-7",
					projectId: "project-1",
				}}
				assetFamilyId="family-1"
				assetRecords={assetRecords}
				familyName="Potion icons"
				projectId="project-1"
				versions={versions}
			/>
		</QueryClientProvider>
	);
}

function mount(
	assetRecords: ManagerProps["assetRecords"] = defaultAssetRecords,
	versions: ManagerProps["versions"] = defaultVersions
) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return {
		...render(createManager(queryClient, assetRecords, versions)),
		renderManager: (
			nextAssetRecords: ManagerProps["assetRecords"],
			nextVersions: ManagerProps["versions"]
		) => createManager(queryClient, nextAssetRecords, nextVersions),
	};
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.resetAllMocks();
	persistedReviews = [];
});

test("shows selected icon versions together in a side-by-side family comparison", async () => {
	mocks.list.mockResolvedValue([]);

	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "İncelemeyi kaydet" })
		).toBeEnabled()
	);

	for (const [index, variant] of [
		"inventory-slot",
		"ability-wheel",
	].entries()) {
		fireEvent.change(
			within(
				screen.getByRole("group", {
					name: `Karşılaştırma öğesi ${index + 1}`,
				})
			).getByLabelText("Kullanım çeşidi"),
			{ target: { value: variant } }
		);
	}

	const familyComparison = screen.getByRole("region", {
		name: "İkon ailesini yan yana karşılaştırma",
	});
	const comparisonGrid = within(familyComparison).getByRole("group", {
		name: "İkon ailesi karşılaştırma ızgarası",
	});
	expect(comparisonGrid).toHaveStyle({
		gridTemplateColumns: "repeat(2, minmax(12rem, 1fr))",
	});

	const healthComparison = within(comparisonGrid).getByRole("article", {
		name: "Health potion · inventory-slot · 24 × 24 px",
	});
	const manaComparison = within(comparisonGrid).getByRole("article", {
		name: "Mana potion · ability-wheel · 64 × 64 px",
	});

	for (const label of ["Açık arka plan", "Koyu arka plan", "Gri tonlama"]) {
		expect(
			within(healthComparison).getByRole("img", {
				name: `Health potion · ${label}`,
			})
		).toBeInTheDocument();
		expect(
			within(manaComparison).getByRole("img", {
				name: `Mana potion · ${label}`,
			})
		).toBeInTheDocument();
	}
});

test("saves the icon review and downloads its exact-version JSON archive without image bytes", async () => {
	mocks.list.mockImplementation(async () => persistedReviews);
	mocks.save.mockImplementation((input: IconFamilyReviewInput) => {
		const record = makeReview(input);
		persistedReviews = [record];
		return Promise.resolve(record);
	});
	const createObjectURL = vi.fn((_blob: Blob) => "blob:icon-family-review");
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		value: createObjectURL,
	});
	const downloadClick = vi
		.spyOn(HTMLAnchorElement.prototype, "click")
		.mockImplementation(() => undefined);

	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "İncelemeyi kaydet" })
		).toBeEnabled()
	);

	const firstItem = screen.getByRole("group", {
		name: "Karşılaştırma öğesi 1",
	});
	const secondItem = screen.getByRole("group", {
		name: "Karşılaştırma öğesi 2",
	});
	fireEvent.change(within(firstItem).getByLabelText("Kullanım çeşidi"), {
		target: { value: "inventory-slot" },
	});
	fireEvent.change(within(secondItem).getByLabelText("Kullanım çeşidi"), {
		target: { value: "ability-wheel" },
	});

	for (const label of [
		"Nesne ölçeği notu",
		"Işık yönü notu",
		"Kontur notu",
		"Ayrıntı yoğunluğu notu",
		"Durum veya nadirlik rengi notu",
	]) {
		fireEvent.change(screen.getByLabelText(label), {
			target: { value: `${label} gözlemi` },
		});
	}
	fireEvent.change(screen.getByLabelText("İnceleme gerekçesi"), {
		target: { value: "Küçük ölçekte health silueti zayıflıyor." },
	});

	for (const label of [
		"Health potion · Açık arka plan",
		"Health potion · Koyu arka plan",
		"Health potion · Gri tonlama",
		"Mana potion · Açık arka plan",
		"Mana potion · Koyu arka plan",
		"Mana potion · Gri tonlama",
	]) {
		expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
	}

	fireEvent.click(screen.getByRole("button", { name: "İncelemeyi kaydet" }));
	await screen.findByText("İnceleme kalıcı kayıttan doğrulandı.");
	const savedReviews = screen.getByRole("region", {
		name: "Kaydedilmiş ikon ailesi incelemeleri",
	});
	fireEvent.click(
		within(savedReviews).getByText("İnceleme ayrıntılarını göster")
	);
	expect(
		within(savedReviews).getByText("Küçük ölçekte health silueti zayıflıyor.")
	).toBeInTheDocument();
	expect(
		within(savedReviews).getByText("Nesne ölçeği notu gözlemi")
	).toBeInTheDocument();
	expect(within(savedReviews).getByText(inventorySizeText)).toBeInTheDocument();

	expect(mocks.save).toHaveBeenCalledWith(
		expect.objectContaining({
			assetFamilyId: "family-1",
			contractRevisionId: "contract-revision-7",
			grayscaleCompared: true,
			items: [
				expect.objectContaining({
					assetRecordId: "record-health",
					assetVersionId: "version-health",
					logicalSize: { height: 24, width: 24 },
					usageVariant: "inventory-slot",
				}),
				expect.objectContaining({
					assetRecordId: "record-mana",
					assetVersionId: "version-mana",
					logicalSize: { height: 64, width: 64 },
					usageVariant: "ability-wheel",
				}),
			],
			testedBackgrounds: ["light", "dark"],
		})
	);

	fireEvent.click(screen.getByRole("button", { name: "JSON arşivini indir" }));
	await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce());
	expect(downloadClick).toHaveBeenCalledOnce();
	const [archiveBlob] = createObjectURL.mock.calls[0] ?? [];
	if (!archiveBlob) {
		throw new Error("The JSON archive Blob was not created.");
	}
	const archive = JSON.parse(await archiveBlob.text());
	expect(archive).toMatchObject({
		archiveType: "sprite-anvil.icon-family-review",
		exportedAt: expect.any(String),
		schemaVersion: 1,
		record: {
			assetFamilyId: "family-1",
			contractSnapshot: expect.objectContaining({ profileId: "icon" }),
			id: expect.any(String),
			comparisons: expect.objectContaining({
				objectScale: expect.objectContaining({
					notes: "Nesne ölçeği notu gözlemi",
				}),
			}),
			items: [
				expect.objectContaining({ assetVersionId: "version-health" }),
				expect.objectContaining({ assetVersionId: "version-mana" }),
			],
			versionPins: versionSummaries,
		},
	});
	expect(JSON.stringify(archive)).not.toContain("previewUrl");
	expect(JSON.stringify(archive)).not.toContain("health-preview.png");
});

test("offers a fresh read when saving succeeds but the persisted list cannot be reloaded", async () => {
	mocks.list
		.mockResolvedValueOnce([])
		.mockRejectedValueOnce(new Error("Temporary read failure"))
		.mockImplementation(async () => persistedReviews);
	mocks.save.mockImplementation((input: IconFamilyReviewInput) => {
		const record = makeReview(input);
		persistedReviews = [record];
		return Promise.resolve(record);
	});

	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "İncelemeyi kaydet" })
		).toBeEnabled()
	);

	for (const [index, variant] of [
		"inventory-slot",
		"ability-wheel",
	].entries()) {
		fireEvent.change(
			within(
				screen.getByRole("group", {
					name: `Karşılaştırma öğesi ${index + 1}`,
				})
			).getByLabelText("Kullanım çeşidi"),
			{ target: { value: variant } }
		);
	}
	for (const label of [
		"Nesne ölçeği notu",
		"Işık yönü notu",
		"Kontur notu",
		"Ayrıntı yoğunluğu notu",
		"Durum veya nadirlik rengi notu",
	]) {
		fireEvent.change(screen.getByLabelText(label), {
			target: { value: `${label} gözlemi` },
		});
	}
	fireEvent.change(screen.getByLabelText("İnceleme gerekçesi"), {
		target: { value: "Kesin sürüm karşılaştırması." },
	});

	fireEvent.click(screen.getByRole("button", { name: "İncelemeyi kaydet" }));
	await screen.findByText(
		"İnceleme kaydedildi; ancak kalıcı kayıt yeniden okunamadı. Güncel kayıtları kontrol edin."
	);

	const rereadButton = screen.getByRole("button", {
		name: "Güncel kayıtları kontrol et",
	});
	fireEvent.click(rereadButton);
	await screen.findByText("İnceleme kalıcı kayıttan doğrulandı.");
	expect(mocks.save).toHaveBeenCalledOnce();
});

test("offers an identical-id resend when an uncertain save never persisted", async () => {
	mocks.list
		.mockResolvedValueOnce([])
		.mockResolvedValueOnce([])
		.mockImplementation(async () => persistedReviews);
	let saveCalls = 0;
	mocks.save.mockImplementation((input: IconFamilyReviewInput) => {
		saveCalls += 1;
		if (saveCalls === 1) {
			return Promise.reject(new TypeError("Failed to fetch"));
		}
		const record = makeReview(input);
		persistedReviews = [record];
		return Promise.resolve(record);
	});

	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "İncelemeyi kaydet" })
		).toBeEnabled()
	);

	for (const [index, variant] of [
		"inventory-slot",
		"ability-wheel",
	].entries()) {
		fireEvent.change(
			within(
				screen.getByRole("group", {
					name: `Karşılaştırma öğesi ${index + 1}`,
				})
			).getByLabelText("Kullanım çeşidi"),
			{ target: { value: variant } }
		);
	}
	for (const label of [
		"Nesne ölçeği notu",
		"Işık yönü notu",
		"Kontur notu",
		"Ayrıntı yoğunluğu notu",
		"Durum veya nadirlik rengi notu",
	]) {
		fireEvent.change(screen.getByLabelText(label), {
			target: { value: `${label} gözlemi` },
		});
	}
	fireEvent.change(screen.getByLabelText("İnceleme gerekçesi"), {
		target: { value: "Belirsiz kaydetme sonrası yeniden gönderim." },
	});

	fireEvent.click(screen.getByRole("button", { name: "İncelemeyi kaydet" }));
	await screen.findByText(
		"Kaydetme sonucu doğrulanamadı. Güncel kayıtları kontrol edin; kayıt yoksa aynı incelemeyi yeniden gönderebilirsiniz."
	);

	fireEvent.click(
		screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
	);
	await screen.findByText(
		"İnceleme kalıcı listede görünmüyor. Sonuç belirsiz kaldı; aynı incelemeyi yeniden gönderebilir veya kayıtları tekrar kontrol edebilirsiniz."
	);

	const resendButton = screen.getByRole("button", {
		name: "Aynı incelemeyi yeniden gönder",
	});
	expect(resendButton).toBeEnabled();
	expect(
		screen.getByRole("button", { name: "İncelemeyi kaydet" })
	).toBeDisabled();
	fireEvent.click(resendButton);
	await screen.findByText("İnceleme kalıcı kayıttan doğrulandı.");

	expect(mocks.save).toHaveBeenCalledTimes(2);
	const first = mocks.save.mock.calls[0]?.[0] as IconFamilyReviewInput;
	const second = mocks.save.mock.calls[1]?.[0] as IconFamilyReviewInput;
	expect(second.id).toBe(first.id);
	expect(second).toEqual(first);
});

test("re-enables the form when the resent review fails with a definitive error", async () => {
	mocks.list.mockResolvedValue([]);
	let saveCalls = 0;
	mocks.save.mockImplementation(() => {
		saveCalls += 1;
		if (saveCalls === 1) {
			return Promise.reject(new TypeError("Failed to fetch"));
		}
		const conflict = new Error(
			"Specialized Profile Contract changed. Reload before reviewing."
		);
		(conflict as Error & { code: string }).code = "CONFLICT";
		return Promise.reject(conflict);
	});

	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "İncelemeyi kaydet" })
		).toBeEnabled()
	);

	for (const [index, variant] of [
		"inventory-slot",
		"ability-wheel",
	].entries()) {
		fireEvent.change(
			within(
				screen.getByRole("group", {
					name: `Karşılaştırma öğesi ${index + 1}`,
				})
			).getByLabelText("Kullanım çeşidi"),
			{ target: { value: variant } }
		);
	}
	for (const label of [
		"Nesne ölçeği notu",
		"Işık yönü notu",
		"Kontur notu",
		"Ayrıntı yoğunluğu notu",
		"Durum veya nadirlik rengi notu",
	]) {
		fireEvent.change(screen.getByLabelText(label), {
			target: { value: `${label} gözlemi` },
		});
	}
	fireEvent.change(screen.getByLabelText("İnceleme gerekçesi"), {
		target: { value: "Kesin sürüm karşılaştırması." },
	});

	fireEvent.click(screen.getByRole("button", { name: "İncelemeyi kaydet" }));
	await screen.findByText(
		"Kaydetme sonucu doğrulanamadı. Güncel kayıtları kontrol edin; kayıt yoksa aynı incelemeyi yeniden gönderebilirsiniz."
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
	);
	await screen.findByText(
		"İnceleme kalıcı listede görünmüyor. Sonuç belirsiz kaldı; aynı incelemeyi yeniden gönderebilir veya kayıtları tekrar kontrol edebilirsiniz."
	);

	fireEvent.click(
		screen.getByRole("button", { name: "Aynı incelemeyi yeniden gönder" })
	);
	await screen.findByText(
		"Specialized Profile Contract changed. Reload before reviewing."
	);
	expect(
		screen.getByRole("button", { name: "İncelemeyi kaydet" })
	).toBeEnabled();
	expect(
		screen.queryByRole("button", { name: "Aynı incelemeyi yeniden gönder" })
	).toBeNull();
});

test("marks previews that are scaled down from the requested logical size", async () => {
	mocks.list.mockResolvedValue([]);

	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "İncelemeyi kaydet" })
		).toBeEnabled()
	);

	const firstItem = screen.getByRole("group", {
		name: "Karşılaştırma öğesi 1",
	});
	fireEvent.change(
		within(firstItem).getByLabelText("Mantıksal genişlik (px)"),
		{
			target: { value: "512" },
		}
	);
	fireEvent.change(
		within(firstItem).getByLabelText("Mantıksal yükseklik (px)"),
		{ target: { value: "512" } }
	);

	const familyComparison = screen.getByRole("region", {
		name: "İkon ailesini yan yana karşılaştırma",
	});
	const comparisonGrid = within(familyComparison).getByRole("group", {
		name: "İkon ailesi karşılaştırma ızgarası",
	});
	const healthComparison = within(comparisonGrid).getByRole("article", {
		name: "Health potion · Kullanım çeşidi belirtilmedi · 512 × 512 px",
	});
	const manaComparison = within(comparisonGrid).getByRole("article", {
		name: "Mana potion · Kullanım çeşidi belirtilmedi · 64 × 64 px",
	});

	expect(
		within(healthComparison).getByRole("img", {
			name: "Health potion · Açık arka plan · 80 px'e ölçeklendi",
		})
	).toBeInTheDocument();
	expect(
		within(healthComparison).getByText("Gri tonlama · 80 px'e ölçeklendi")
	).toBeInTheDocument();
	expect(
		within(manaComparison).getByRole("img", {
			name: "Mana potion · Koyu arka plan",
		})
	).toBeInTheDocument();
});

test("loads comparison defaults when asset records arrive after the profile activation", async () => {
	mocks.list.mockResolvedValue([]);
	const { rerender, renderManager } = mount([], []);

	rerender(renderManager(defaultAssetRecords, defaultVersions));

	await waitFor(() => {
		expect(
			within(
				screen.getByRole("group", { name: "Karşılaştırma öğesi 1" })
			).getByLabelText("Varlık Sürümü")
		).toHaveValue("version-health");
		expect(
			within(
				screen.getByRole("group", { name: "Karşılaştırma öğesi 2" })
			).getByLabelText("Varlık Sürümü")
		).toHaveValue("version-mana");
	});
});
