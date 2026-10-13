// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MarketingUsageReviewManager } from "./marketing-usage-review-manager";

const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	client: { marketingUsageReviews: { save: mocks.save } },
	orpc: {
		marketingUsageReviews: {
			list: {
				queryOptions: () => ({ queryKey: ["marketing"], queryFn: mocks.list }),
			},
		},
	},
}));
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
function show() {
	const contract = getSpecializedProfileContract("portrait_logo_marketing");
	if (!contract) {
		throw new Error("Missing marketing contract");
	}
	mocks.list.mockResolvedValue([]);
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<MarketingUsageReviewManager
				activation={{
					projectId: "project",
					contractRevisionId: "portrait_logo_marketing@1.0.0",
					contract,
					activatedAt: "2026-10-13T00:00:00.000Z",
					activatedByUserId: "owner",
				}}
				canonicalDesignId={null}
				family={{ id: "family", name: "Anvil logo", visualWorldId: "world" }}
				projectId="project"
				versions={[
					{
						id: "version",
						assetRecordId: "record",
						versionNumber: 1,
						previewUrl: "/logo.png",
						sourceImageDimensions: { width: 301, height: 199 },
					},
				]}
			/>
		</QueryClientProvider>
	);
}
function loadAndAssess() {
	for (const img of screen.getAllByRole("img")) {
		fireEvent.load(img);
	}
	for (const field of screen.getAllByLabelText("Gözlem")) {
		fireEvent.change(field, {
			target: { value: "Lettering needs more space." },
		});
	}
}
test("requires loaded previews, saves observations and confirms authoritative reread", async () => {
	show();
	const save = screen.getByRole("button", {
		name: "Kullanım incelemesini kaydet",
	});
	expect(save).toBeDisabled();
	loadAndAssess();
	mocks.save.mockImplementation((input) => {
		const record = { ...input, createdAt: "2026-10-13T00:00:00.000Z" };
		mocks.list.mockResolvedValue([record]);
		return Promise.resolve(record);
	});
	await waitFor(() => expect(save).toBeEnabled());
	fireEvent.click(save);
	await screen.findByText("İnceleme kalıcı kayıttan doğrulandı.");
	expect(mocks.save).toHaveBeenCalledWith(
		expect.objectContaining({
			visualWorldId: "world",
			canonicalDesignId: null,
			items: [
				expect.objectContaining({
					usePurpose: "logo",
					presentation: "transparent",
					displaySize: { width: 64, height: 64 },
					observations: [
						expect.objectContaining({
							background: "light",
							readability: "inconclusive",
						}),
						expect.objectContaining({ background: "dark" }),
					],
				}),
			],
		})
	);
});
test("blocks another write after an uncertain result and offers an actual reread", async () => {
	show();
	loadAndAssess();
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Kullanım incelemesini kaydet" })
		).toBeEnabled()
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Kullanım incelemesini kaydet" })
	);
	await screen.findByText(
		"Kaydetme sonucu belirsiz. Güncel kayıtları kontrol edin."
	);
	expect(
		screen.getByRole("button", { name: "Kullanım incelemesini kaydet" })
	).toBeDisabled();
	const before = mocks.list.mock.calls.length;
	fireEvent.click(
		screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
	);
	await waitFor(() =>
		expect(mocks.list.mock.calls.length).toBeGreaterThan(before)
	);
	expect(mocks.save).toHaveBeenCalledTimes(1);
});
test("invalidates inspected previews after geometry changes and handles failed images", () => {
	show();
	loadAndAssess();
	fireEvent.change(screen.getByLabelText("displaySize width"), {
		target: { value: "77" },
	});
	expect(
		screen.getByRole("button", { name: "Kullanım incelemesini kaydet" })
	).toBeDisabled();
	const [firstImage] = screen.getAllByRole("img");
	if (!firstImage) {
		throw new Error("Missing preview");
	}
	fireEvent.error(firstImage);
	expect(
		screen.getByRole("button", { name: "Kullanım incelemesini kaydet" })
	).toBeDisabled();
});
