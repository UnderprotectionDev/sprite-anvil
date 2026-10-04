// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
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
import { DirectionalReviewManager } from "./directional-review-manager";

const uncertainMessage = /Kaydetme sonucu doğrulanamadı/;
const mocks = vi.hoisted(() => ({ save: vi.fn(), list: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	client: { directionalReviews: { save: mocks.save } },
	orpc: {
		directionalReviews: {
			list: {
				queryOptions: () => ({ queryKey: ["reviews"], queryFn: mocks.list }),
			},
		},
	},
}));
vi.mock("./directional-review-editor", () => ({
	DirectionalReviewEditor: ({
		onSave,
		disabled,
	}: {
		onSave: (input: unknown) => void;
		disabled: boolean;
	}) => (
		<button
			disabled={disabled}
			onClick={() => onSave({ id: "pending" })}
			type="button"
		>
			Save test review
		</button>
	),
}));
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
function mount() {
	mocks.list.mockResolvedValue([]);
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<DirectionalReviewManager
				activation={
					{
						contract: specializedProfileContractCatalog[0],
						contractRevisionId: "contract",
					} as never
				}
				assetFamilyId="family"
				catalog={
					{
						assetVersions: [],
						canonicalDesigns: [
							{
								id: "design",
								assetFamilyId: "family",
								assetVersionId: "version",
							},
						],
					} as never
				}
				familyName="Knight"
				projectId="project"
				recordNames={{}}
			/>
		</QueryClientProvider>
	);
}
test("a rejected save reports the error and permits correction", async () => {
	mocks.save.mockRejectedValue(
		Object.assign(new Error("Canonical Design changed."), {
			code: "CONFLICT",
			status: 409,
		})
	);
	mount();
	await waitFor(() =>
		expect(screen.getByText("Save test review")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save test review"));
	await screen.findByText("Canonical Design changed.");
	expect(screen.getByText("Save test review")).toBeEnabled();
});
test("an uncertain save resolves only when its exact record is read back", async () => {
	mocks.save.mockRejectedValue(new TypeError("Failed to fetch"));
	mount();
	await waitFor(() =>
		expect(screen.getByText("Save test review")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save test review"));
	await screen.findByText(uncertainMessage);
	expect(screen.getByText("Save test review")).toBeDisabled();
	mocks.list.mockResolvedValue([
		{
			id: "pending",
			createdAt: "2026-10-04T10:00:00Z",
			directions: [{}, {}, {}, {}],
			rationale: "Reviewed",
			outcome: "consistent",
			canonicalDesignId: "design",
			canonicalAssetVersionId: "version",
			contractSnapshot: specializedProfileContractCatalog[0],
			contractRevisionId: "contract",
		},
	]);
	fireEvent.click(screen.getByText("Güncel kayıtları kontrol et"));
	await screen.findByText("İnceleme kalıcı kayıttan doğrulandı.");
	expect(screen.getByText("Save test review")).toBeDisabled();
});
