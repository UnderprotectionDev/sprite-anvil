// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { VfxAppearanceInput } from "@sprite-anvil/api/vfx-appearance-reviews";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	configure,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { VfxAppearanceReviewManager } from "./vfx-appearance-review-manager";

configure({ asyncUtilTimeout: 10_000 });
const mocks = vi.hoisted(() => ({ save: vi.fn(), list: vi.fn() }));
const oldBurst = /Old burst/;
const uncertainMessage = /Kaydetme sonucu doğrulanamadı/;
vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	const client = {
		vfxAppearanceReviews: { save: mocks.save, list: mocks.list },
		familyReadiness: { list: async () => ({ items: [] }) },
	};
	return { client, orpc: createTanstackQueryUtils(client as never) };
});
vi.mock("./vfx-appearance-editor", () => ({
	VfxAppearanceEditor: ({
		onSave,
		disabled,
		initial,
	}: {
		onSave: (input: VfxAppearanceInput) => void;
		disabled: boolean;
		initial?: VfxAppearanceInput;
	}) => (
		<button
			disabled={disabled}
			onClick={() => onSave({ id: "pending" } as VfxAppearanceInput)}
			type="button"
		>
			{initial ? "Stored review" : "Save test review"}
		</button>
	),
}));
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
const existing = {
	id: "existing",
	name: "Old burst",
	frames: [{}],
	outcome: "passed",
	createdAt: "2026-10-11T10:00:00.000Z",
	rationale: "Earlier result.",
};
function mount() {
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<VfxAppearanceReviewManager
				activation={{ contractRevisionId: "effect@1" } as never}
				assetFamilyId="family"
				assetRecords={[]}
				catalog={{ assetVersions: [] } as never}
				familyName="Fire effects"
				projectId="project"
			/>
		</QueryClientProvider>
	);
}
test("locks an uncertain save until its exact review is recovered from current records", async () => {
	mocks.list.mockResolvedValue([existing]);
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save test review" })
		).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Save test review" }));
	await screen.findByText(uncertainMessage);
	expect(
		screen.getByRole("button", { name: "Save test review" })
	).toBeDisabled();
	expect(screen.getByRole("button", { name: oldBurst })).toBeDisabled();
	fireEvent.click(
		screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
	);
	await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
	expect(
		screen.getByRole("button", { name: "Save test review" })
	).toBeDisabled();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
		).toBeEnabled()
	);
	mocks.list.mockResolvedValue([
		{ ...existing, id: "pending", name: "New burst" },
	]);
	fireEvent.click(
		screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
	);
	await screen.findByText("İnceleme kalıcı kayıttan doğrulandı.");
	expect(screen.getByRole("button", { name: "Stored review" })).toBeDisabled();
	expect(mocks.save).toHaveBeenCalledTimes(1);
	fireEvent.click(screen.getByRole("button", { name: "Yeni inceleme" }));
	expect(
		screen.getByRole("button", { name: "Save test review" })
	).toBeEnabled();
});

const supportReference = "SUP-00000000-0000-4000-8000-000000000000";
const serverError = Object.assign(new Error("Private server details"), {
	code: "INTERNAL_SERVER_ERROR",
	status: 500,
	data: { supportReference },
});

test("shows the server support reference on an uncertain save and clears it after readback", async () => {
	mocks.list.mockResolvedValue([existing]);
	mocks.save.mockRejectedValue(serverError);
	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save test review" })
		).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Save test review" }));
	await screen.findByText(uncertainMessage);
	expect(screen.getByRole("status")).toHaveTextContent(supportReference);
	expect(screen.queryByText("Private server details")).not.toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Save test review" })
	).toBeDisabled();
	mocks.list.mockResolvedValue([{ ...existing, id: "pending" }]);
	fireEvent.click(
		screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
	);
	await screen.findByText("İnceleme kalıcı kayıttan doğrulandı.");
	expect(screen.queryByText(supportReference)).not.toBeInTheDocument();
	expect(mocks.save).toHaveBeenCalledTimes(1);
});

test("shows the read error support reference and safely retries the query", async () => {
	mocks.list.mockRejectedValueOnce(serverError).mockResolvedValue([existing]);
	mount();
	expect(await screen.findByRole("alert")).toHaveTextContent(supportReference);
	expect(screen.queryByText("Private server details")).not.toBeInTheDocument();
	fireEvent.click(
		screen.getByRole("button", { name: "Kayıtları yeniden oku" })
	);
	await screen.findByRole("button", { name: oldBurst });
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	expect(mocks.list).toHaveBeenCalledTimes(2);
});

test("does not invent a support reference for a connection failure", async () => {
	mocks.list.mockResolvedValue([existing]);
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save test review" })
		).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Save test review" }));
	await screen.findByText(uncertainMessage);
	expect(screen.getByRole("status")).not.toHaveTextContent(
		"Support reference:"
	);
});

test("announces a pending save and replaces progress with its confirmed result", async () => {
	const pending = Promise.withResolvers<typeof existing>();
	mocks.list.mockResolvedValue([existing]);
	mocks.save.mockReturnValue(pending.promise);
	mount();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save test review" })
		).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Save test review" }));
	expect(screen.getByRole("status")).toHaveTextContent(
		"İnceleme kaydediliyor…"
	);
	expect(
		screen.getByRole("button", { name: "Save test review" })
	).toBeDisabled();
	pending.resolve({ ...existing, id: "pending" });
	await screen.findByText("İnceleme kalıcı kayıttan doğrulandı.");
	expect(screen.queryByText("İnceleme kaydediliyor…")).not.toBeInTheDocument();
});
