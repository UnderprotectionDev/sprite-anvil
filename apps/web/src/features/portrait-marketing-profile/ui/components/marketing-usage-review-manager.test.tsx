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

const supportReferenceLabel = /Support reference:/;
const uncertainResultMessage = /The result could not be confirmed/;
const privateErrorDetails = /private database connection details/;
const mocks = vi.hoisted(() => ({
	list: vi.fn(),
	save: vi.fn(),
	errorToast: vi.fn(),
}));
vi.mock("sonner", () => ({
	toast: { dismiss: vi.fn(), error: mocks.errorToast },
}));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		marketingUsageReviews: {
			save: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => mocks.save(input),
				}),
			},
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
	await waitFor(() => expect(mocks.errorToast).toHaveBeenCalledOnce());
	const [, options] = mocks.errorToast.mock.calls[0];
	render(options.description);
	expect(screen.queryByText(supportReferenceLabel)).not.toBeInTheDocument();
	expect(screen.getByText(uncertainResultMessage)).toBeVisible();
	expect(options.action).toBeUndefined();
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
test("shows the server support reference without exposing private details or retrying an uncertain write", async () => {
	const supportReference = "SUP-7CFB1C3A-A7A3-4BC2-B748-B5065AA2314A";
	show();
	loadAndAssess();
	mocks.save.mockRejectedValue(
		Object.assign(new Error("private database connection details"), {
			code: "INTERNAL_SERVER_ERROR",
			status: 500,
			data: { supportReference },
		})
	);
	const save = screen.getByRole("button", {
		name: "Kullanım incelemesini kaydet",
	});
	await waitFor(() => expect(save).toBeEnabled());
	fireEvent.click(save);
	await screen.findByText(
		"Kaydetme sonucu belirsiz. Güncel kayıtları kontrol edin."
	);
	await waitFor(() => expect(mocks.errorToast).toHaveBeenCalledOnce());
	const [title, options] = mocks.errorToast.mock.calls[0];
	expect(title).toBe("This action could not be completed.");
	render(options.description);
	expect(screen.getByText(supportReference)).toBeVisible();
	expect(screen.getByText(supportReferenceLabel)).toBeVisible();
	expect(screen.queryByText(privateErrorDetails)).not.toBeInTheDocument();
	expect(options.action).toBeUndefined();
	expect(save).toBeDisabled();
	fireEvent.click(
		screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
	);
	await screen.findByText(
		"Sonuç henüz doğrulanamadı. Aynı incelemeyi göndermeden güncel kayıtları tekrar kontrol edin."
	);
	expect(mocks.save).toHaveBeenCalledOnce();
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
test("submits the chosen purpose, opaque presentation color, and observation outcomes", async () => {
	show();
	fireEvent.change(screen.getByLabelText("Kullanım amacı"), {
		target: { value: "store" },
	});
	expect(screen.queryByLabelText("Opak zemin rengi")).toBeNull();
	fireEvent.change(screen.getByLabelText("Sunum"), {
		target: { value: "opaque" },
	});
	const color = screen.getByLabelText("Opak zemin rengi");
	expect(color).toHaveValue("#ffffff");
	fireEvent.change(color, { target: { value: "#ffcc00" } });
	const [lightSafeArea] = screen.getAllByLabelText("Güvenli alan sonucu");
	const [, darkReadability] = screen.getAllByLabelText(
		"Küçük boyutta okunurluk"
	);
	if (!(lightSafeArea && darkReadability)) {
		throw new Error("Missing observation selects");
	}
	fireEvent.change(lightSafeArea, { target: { value: "failed" } });
	fireEvent.change(darkReadability, { target: { value: "passed" } });
	fireEvent.change(screen.getByLabelText("displaySize height"), {
		target: { value: "48" },
	});
	loadAndAssess();
	mocks.save.mockImplementation((input) => {
		const record = { ...input, createdAt: "2026-10-13T00:00:00.000Z" };
		mocks.list.mockResolvedValue([record]);
		return Promise.resolve(record);
	});
	const save = screen.getByRole("button", {
		name: "Kullanım incelemesini kaydet",
	});
	await waitFor(() => expect(save).toBeEnabled());
	fireEvent.click(save);
	await screen.findByText("İnceleme kalıcı kayıttan doğrulandı.");
	expect(mocks.save).toHaveBeenCalledWith(
		expect.objectContaining({
			items: [
				expect.objectContaining({
					usePurpose: "store",
					presentation: "opaque",
					opaqueColor: "#ffcc00",
					displaySize: { width: 64, height: 48 },
					observations: [
						expect.objectContaining({
							background: "light",
							safeArea: "failed",
							readability: "inconclusive",
							notes: "Lettering needs more space.",
						}),
						expect.objectContaining({
							background: "dark",
							readability: "passed",
						}),
					],
				}),
			],
		})
	);
});
test("shows the geometry alert for out-of-bounds crops and locks controls after an uncertain write", async () => {
	show();
	fireEvent.change(screen.getByLabelText("crop width"), {
		target: { value: "500" },
	});
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Kırpma ve güvenli alanı kaynak ölçüleri içinde tutun."
	);
	expect(screen.queryAllByRole("img")).toHaveLength(0);
	fireEvent.change(screen.getByLabelText("crop width"), {
		target: { value: "301" },
	});
	expect(
		screen.queryByText("Kırpma ve güvenli alanı kaynak ölçüleri içinde tutun.")
	).toBeNull();
	loadAndAssess();
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	const save = screen.getByRole("button", {
		name: "Kullanım incelemesini kaydet",
	});
	await waitFor(() => expect(save).toBeEnabled());
	fireEvent.click(save);
	await screen.findByText(
		"Kaydetme sonucu belirsiz. Güncel kayıtları kontrol edin."
	);
	expect(screen.getByLabelText("Kullanım amacı")).toBeDisabled();
	expect(screen.getByLabelText("crop x")).toBeDisabled();
	for (const notes of screen.getAllByLabelText("Gözlem")) {
		expect(notes).toBeDisabled();
		expect(notes).toBeRequired();
	}
});
