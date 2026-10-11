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
vi.mock("@/utils/orpc", () => ({
	client: { vfxAppearanceReviews: { save: mocks.save } },
	orpc: {
		vfxAppearanceReviews: {
			list: {
				queryOptions: () => ({ queryKey: ["reviews"], queryFn: mocks.list }),
			},
		},
		familyReadiness: {
			list: {
				queryOptions: () => ({
					queryKey: ["readiness"],
					queryFn: async () => ({ items: [] }),
				}),
			},
		},
	},
}));
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
test("locks an uncertain save until its exact review is recovered from current records", async () => {
	mocks.list.mockResolvedValue([existing]);
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
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
