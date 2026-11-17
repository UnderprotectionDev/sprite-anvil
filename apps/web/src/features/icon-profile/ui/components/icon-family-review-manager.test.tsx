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
vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	const client = {
		iconFamilyReviews: {
			// The oRPC utils pass a second options argument; assert on the input only.
			save: (input: unknown) => mocks.save(input),
			list: () => mocks.list(),
		},
	};
	return { client, orpc: createTanstackQueryUtils(client as never) };
});

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
		expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled()
	);

	for (const [index, variant] of [
		"inventory-slot",
		"ability-wheel",
	].entries()) {
		fireEvent.change(
			within(
				screen.getByRole("group", {
					name: `Comparison item ${index + 1}`,
				})
			).getByLabelText("Usage variant"),
			{ target: { value: variant } }
		);
	}

	const familyComparison = screen.getByRole("region", {
		name: "Compare icon family side by side",
	});
	const comparisonGrid = within(familyComparison).getByRole("group", {
		name: "Icon family comparison grid",
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

	for (const label of ["Light background", "Dark background", "Gri tonlama"]) {
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
		expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled()
	);

	const firstItem = screen.getByRole("group", {
		name: "Comparison item 1",
	});
	const secondItem = screen.getByRole("group", {
		name: "Comparison item 2",
	});
	fireEvent.change(within(firstItem).getByLabelText("Usage variant"), {
		target: { value: "inventory-slot" },
	});
	fireEvent.change(within(secondItem).getByLabelText("Usage variant"), {
		target: { value: "ability-wheel" },
	});

	for (const [label, value] of [
		["Object scale notes", "Nesne ölçeği notu gözlemi"],
		["Light direction notes", "Işık yönü notu gözlemi"],
		["Outline notes", "Kontur notu gözlemi"],
		["Detail density notes", "Ayrıntı yoğunluğu notu gözlemi"],
		["State or rarity color notes", "Durum veya nadirlik rengi notu gözlemi"],
	]) {
		fireEvent.change(screen.getByLabelText(label), {
			target: { value },
		});
	}
	fireEvent.change(screen.getByLabelText("Review rationale"), {
		target: { value: "Küçük ölçekte health silueti zayıflıyor." },
	});

	for (const label of [
		"Health potion · Light background",
		"Health potion · Dark background",
		"Health potion · Gri tonlama",
		"Mana potion · Light background",
		"Mana potion · Dark background",
		"Mana potion · Gri tonlama",
	]) {
		expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
	}

	fireEvent.click(screen.getByRole("button", { name: "Save review" }));
	await screen.findByText("Review verified from the saved record.");
	const savedReviews = screen.getByRole("region", {
		name: "Saved icon family reviews",
	});
	fireEvent.click(within(savedReviews).getByText("Show review details"));
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

	fireEvent.click(
		screen.getByRole("button", { name: "Download JSON archive" })
	);
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
		expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled()
	);

	for (const [index, variant] of [
		"inventory-slot",
		"ability-wheel",
	].entries()) {
		fireEvent.change(
			within(
				screen.getByRole("group", {
					name: `Comparison item ${index + 1}`,
				})
			).getByLabelText("Usage variant"),
			{ target: { value: variant } }
		);
	}
	for (const [label, value] of [
		["Object scale notes", "Nesne ölçeği notu gözlemi"],
		["Light direction notes", "Işık yönü notu gözlemi"],
		["Outline notes", "Kontur notu gözlemi"],
		["Detail density notes", "Ayrıntı yoğunluğu notu gözlemi"],
		["State or rarity color notes", "Durum veya nadirlik rengi notu gözlemi"],
	]) {
		fireEvent.change(screen.getByLabelText(label), {
			target: { value },
		});
	}
	fireEvent.change(screen.getByLabelText("Review rationale"), {
		target: { value: "Kesin sürüm karşılaştırması." },
	});

	fireEvent.click(screen.getByRole("button", { name: "Save review" }));
	await screen.findByText(
		"Review saved, but the saved record could not be reloaded. Check current records."
	);

	const rereadButton = screen.getByRole("button", {
		name: "Check current records",
	});
	fireEvent.click(rereadButton);
	await screen.findByText("Review verified from the saved record.");
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
		expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled()
	);

	for (const [index, variant] of [
		"inventory-slot",
		"ability-wheel",
	].entries()) {
		fireEvent.change(
			within(
				screen.getByRole("group", {
					name: `Comparison item ${index + 1}`,
				})
			).getByLabelText("Usage variant"),
			{ target: { value: variant } }
		);
	}
	for (const [label, value] of [
		["Object scale notes", "Nesne ölçeği notu gözlemi"],
		["Light direction notes", "Işık yönü notu gözlemi"],
		["Outline notes", "Kontur notu gözlemi"],
		["Detail density notes", "Ayrıntı yoğunluğu notu gözlemi"],
		["State or rarity color notes", "Durum veya nadirlik rengi notu gözlemi"],
	]) {
		fireEvent.change(screen.getByLabelText(label), {
			target: { value },
		});
	}
	fireEvent.change(screen.getByLabelText("Review rationale"), {
		target: { value: "Belirsiz kaydetme sonrası yeniden gönderim." },
	});

	fireEvent.click(screen.getByRole("button", { name: "Save review" }));
	await screen.findByText(
		"Could not verify the save result. Check current records; you can resubmit if the record is missing."
	);

	fireEvent.click(
		screen.getByRole("button", { name: "Check current records" })
	);
	await screen.findByText(
		"The review is not visible in the saved list. The result is uncertain; you can resubmit the same review or check records again."
	);

	const resendButton = screen.getByRole("button", {
		name: "Resubmit the same review",
	});
	expect(resendButton).toBeEnabled();
	expect(screen.getByRole("button", { name: "Save review" })).toBeDisabled();
	fireEvent.click(resendButton);
	await screen.findByText("Review verified from the saved record.");

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
		expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled()
	);

	for (const [index, variant] of [
		"inventory-slot",
		"ability-wheel",
	].entries()) {
		fireEvent.change(
			within(
				screen.getByRole("group", {
					name: `Comparison item ${index + 1}`,
				})
			).getByLabelText("Usage variant"),
			{ target: { value: variant } }
		);
	}
	for (const [label, value] of [
		["Object scale notes", "Nesne ölçeği notu gözlemi"],
		["Light direction notes", "Işık yönü notu gözlemi"],
		["Outline notes", "Kontur notu gözlemi"],
		["Detail density notes", "Ayrıntı yoğunluğu notu gözlemi"],
		["State or rarity color notes", "Durum veya nadirlik rengi notu gözlemi"],
	]) {
		fireEvent.change(screen.getByLabelText(label), {
			target: { value },
		});
	}
	fireEvent.change(screen.getByLabelText("Review rationale"), {
		target: { value: "Kesin sürüm karşılaştırması." },
	});

	fireEvent.click(screen.getByRole("button", { name: "Save review" }));
	await screen.findByText(
		"Could not verify the save result. Check current records; you can resubmit if the record is missing."
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Check current records" })
	);
	await screen.findByText(
		"The review is not visible in the saved list. The result is uncertain; you can resubmit the same review or check records again."
	);

	fireEvent.click(
		screen.getByRole("button", { name: "Resubmit the same review" })
	);
	await screen.findByText(
		"Specialized Profile Contract changed. Reload before reviewing."
	);
	expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled();
	expect(
		screen.queryByRole("button", { name: "Resubmit the same review" })
	).toBeNull();
});

test("marks previews that are scaled down from the requested logical size", async () => {
	mocks.list.mockResolvedValue([]);

	mount();
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled()
	);

	const firstItem = screen.getByRole("group", {
		name: "Comparison item 1",
	});
	fireEvent.change(within(firstItem).getByLabelText("Logical width (px)"), {
		target: { value: "512" },
	});
	fireEvent.change(within(firstItem).getByLabelText("Logical height (px)"), {
		target: { value: "512" },
	});

	const familyComparison = screen.getByRole("region", {
		name: "Compare icon family side by side",
	});
	const comparisonGrid = within(familyComparison).getByRole("group", {
		name: "Icon family comparison grid",
	});
	const healthComparison = within(comparisonGrid).getByRole("article", {
		name: "Health potion · Usage variant not specified · 512 × 512 px",
	});
	const manaComparison = within(comparisonGrid).getByRole("article", {
		name: "Mana potion · Usage variant not specified · 64 × 64 px",
	});

	expect(
		within(healthComparison).getByRole("img", {
			name: "Health potion · Light background · 80 scaled to px",
		})
	).toBeInTheDocument();
	expect(
		within(healthComparison).getByText("Gri tonlama · 80 scaled to px")
	).toBeInTheDocument();
	expect(
		within(manaComparison).getByRole("img", {
			name: "Mana potion · Dark background",
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
				screen.getByRole("group", { name: "Comparison item 1" })
			).getByLabelText("Asset Version")
		).toHaveValue("version-health");
		expect(
			within(
				screen.getByRole("group", { name: "Comparison item 2" })
			).getByLabelText("Asset Version")
		).toHaveValue("version-mana");
	});
});

function fillRequiredReviewFields() {
	for (const [index, variant] of [
		"inventory-slot",
		"ability-wheel",
	].entries()) {
		fireEvent.change(
			within(
				screen.getByRole("group", {
					name: `Comparison item ${index + 1}`,
				})
			).getByLabelText("Usage variant"),
			{ target: { value: variant } }
		);
	}
	for (const [label, value] of [
		["Object scale notes", "Nesne ölçeği notu gözlemi"],
		["Light direction notes", "Işık yönü notu gözlemi"],
		["Outline notes", "Kontur notu gözlemi"],
		["Detail density notes", "Ayrıntı yoğunluğu notu gözlemi"],
		["State or rarity color notes", "Durum veya nadirlik rengi notu gözlemi"],
	]) {
		fireEvent.change(screen.getByLabelText(label), {
			target: { value },
		});
	}
	fireEvent.change(screen.getByLabelText("Review rationale"), {
		target: { value: "Aile karşılaştırması gerekçesi." },
	});
}

test("shows the first review validation issue and does not save an invalid review", async () => {
	mocks.list.mockResolvedValue([]);

	mount();
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled()
	);
	fillRequiredReviewFields();
	const secondItem = screen.getByRole("group", {
		name: "Comparison item 2",
	});
	fireEvent.change(within(secondItem).getByLabelText("Asset Record"), {
		target: { value: "record-health" },
	});
	expect(within(secondItem).getByLabelText("Asset Version")).toHaveValue(
		"version-health"
	);

	fireEvent.click(screen.getByRole("button", { name: "Save review" }));

	expect(
		await screen.findByText("Compare at least two distinct icon Asset Records.")
	).toHaveAttribute("role", "status");
	expect(mocks.save).not.toHaveBeenCalled();

	fireEvent.change(within(secondItem).getByLabelText("Asset Record"), {
		target: { value: "record-mana" },
	});
	fireEvent.change(within(secondItem).getByLabelText("Logical width (px)"), {
		target: { value: "24" },
	});
	fireEvent.change(within(secondItem).getByLabelText("Logical height (px)"), {
		target: { value: "24" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save review" }));
	expect(
		await screen.findByText("Compare at least two distinct logical sizes.")
	).toBeInTheDocument();
	expect(
		screen.queryByText("Compare at least two distinct icon Asset Records.")
	).not.toBeInTheDocument();
	expect(mocks.save).not.toHaveBeenCalled();
});

test("saves added usage rows, removed rows, assessments, and the chosen outcome", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockImplementation((input: IconFamilyReviewInput) =>
		Promise.resolve(makeReview(input))
	);

	mount();
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled()
	);
	expect(
		screen.queryByRole("button", {
			name: "Comparison item 1 remove row",
		})
	).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Add usage variant" }));
	fireEvent.click(screen.getByRole("button", { name: "Add usage variant" }));
	const thirdItem = screen.getByRole("group", {
		name: "Comparison item 3",
	});
	expect(within(thirdItem).getByLabelText("Asset Record")).toHaveValue(
		"record-health"
	);
	expect(within(thirdItem).getByLabelText("Logical width (px)")).toHaveValue(
		48
	);
	fireEvent.click(
		screen.getByRole("button", {
			name: "Comparison item 4 remove row",
		})
	);
	expect(
		screen.queryByRole("group", { name: "Comparison item 4" })
	).not.toBeInTheDocument();

	fillRequiredReviewFields();
	fireEvent.change(within(thirdItem).getByLabelText("Usage variant"), {
		target: { value: "tooltip" },
	});
	fireEvent.change(within(thirdItem).getByLabelText("Logical height (px)"), {
		target: { value: "32" },
	});
	fireEvent.change(screen.getByLabelText("Outline assessment"), {
		target: { value: "needs_follow_up" },
	});
	fireEvent.change(screen.getByLabelText("State or rarity color assessment"), {
		target: { value: "identity_changed" },
	});
	fireEvent.change(screen.getByLabelText("Review result"), {
		target: { value: "consistent" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save review" }));

	await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
	expect(mocks.save).toHaveBeenCalledWith({
		assetFamilyId: "family-1",
		comparisons: {
			detailDensity: {
				assessment: "consistent",
				notes: "Ayrıntı yoğunluğu notu gözlemi",
			},
			lightingDirection: {
				assessment: "consistent",
				notes: "Işık yönü notu gözlemi",
			},
			objectScale: {
				assessment: "consistent",
				notes: "Nesne ölçeği notu gözlemi",
			},
			outline: { assessment: "needs_follow_up", notes: "Kontur notu gözlemi" },
			stateOrRarityColor: {
				assessment: "identity_changed",
				notes: "Durum veya nadirlik rengi notu gözlemi",
			},
		},
		contractRevisionId: "contract-revision-7",
		grayscaleCompared: true,
		id: expect.any(String),
		items: [
			{
				assetRecordId: "record-health",
				assetVersionId: "version-health",
				logicalSize: { height: 24, width: 24 },
				usageVariant: "inventory-slot",
			},
			{
				assetRecordId: "record-mana",
				assetVersionId: "version-mana",
				logicalSize: { height: 64, width: 64 },
				usageVariant: "ability-wheel",
			},
			{
				assetRecordId: "record-health",
				assetVersionId: "version-health",
				logicalSize: { height: 32, width: 48 },
				usageVariant: "tooltip",
			},
		],
		outcome: "consistent",
		projectId: "project-1",
		rationale: "Aile karşılaştırması gerekçesi.",
		testedBackgrounds: ["light", "dark"],
	});
	expect(
		await screen.findByRole("button", { name: "Save review" })
	).toBeInTheDocument();
});
