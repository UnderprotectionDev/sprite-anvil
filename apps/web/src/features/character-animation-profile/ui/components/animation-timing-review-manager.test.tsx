// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { AnimationTimingReviewInput } from "@sprite-anvil/api/animation-timing-reviews";
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
import { AnimationTimingReviewManager } from "./animation-timing-review-manager";

const uncertainMessage = /Kaydetme sonucu doğrulanamadı/;
const existingReviewButtonName = /Existing walk · 4 yön · Tutarlı/;
const mocks = vi.hoisted(() => ({
	save: vi.fn(),
	list: vi.fn(),
	metadata: vi.fn(),
	versionsSeen: [] as unknown[],
}));
vi.mock("@/utils/orpc", () => ({
	client: { animationTimingReviews: { save: mocks.save } },
	orpc: {
		gameplayMetadata: {
			list: {
				queryOptions: ({ input }: { input: Record<string, string> }) => ({
					queryKey: ["gameplay-metadata", input],
					queryFn: () => mocks.metadata(input),
				}),
			},
		},
		animationTimingReviews: {
			list: {
				queryOptions: () => ({ queryKey: ["reviews"], queryFn: mocks.list }),
			},
		},
	},
}));
vi.mock("./animation-timing-review-editor", () => ({
	AnimationTimingReviewEditor: ({
		onSave,
		disabled,
		initial,
		gameplayMetadataRecords,
		gameplayMetadataStatus,
		onRetryGameplayMetadata,
		versions,
	}: {
		onSave: (input: AnimationTimingReviewInput) => void;
		disabled: boolean;
		initial?: AnimationTimingReviewInput;
		gameplayMetadataRecords: Array<{ id: string }>;
		gameplayMetadataStatus: string;
		onRetryGameplayMetadata: () => void;
		versions: unknown[];
	}) => (
		<div>
			<output data-testid="versions-reference-stable">
				{String(mocks.versionsSeen.at(-1) === versions)}
			</output>
			{mocks.versionsSeen.push(versions)}
			<button
				disabled={disabled}
				onClick={() => onSave({ id: "pending" } as AnimationTimingReviewInput)}
				type="button"
			>
				{initial ? "Review test record" : "Save test review"}
			</button>
			<output data-testid="metadata-query-state">
				{gameplayMetadataStatus}:
				{gameplayMetadataRecords.map((record) => record.id).join(",")}
			</output>
			<button onClick={onRetryGameplayMetadata} type="button">
				Retry metadata
			</button>
		</div>
	),
}));

afterEach(() => {
	cleanup();
	vi.resetAllMocks();
	mocks.versionsSeen.length = 0;
});

const existingRecord = {
	id: "existing",
	createdAt: "2026-10-04T10:00:00.000Z",
	animationName: "Existing walk",
	directions: [{}, {}, {}, {}],
	outcome: "consistent",
	rationale: "Reviewed before this attempt.",
};

function mount(
	catalog: {
		assetVersions: Array<{
			id: string;
			assetFamilyId: string;
			assetRecordId: string;
		}>;
	} = { assetVersions: [] }
) {
	mocks.list.mockResolvedValue([existingRecord]);
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<AnimationTimingReviewManager
				activation={
					{
						contract: specializedProfileContractCatalog[0],
						contractRevisionId: "contract",
					} as never
				}
				assetFamilyId="family"
				catalog={catalog as never}
				familyName="Knight"
				projectId="project"
				recordNames={{}}
			/>
		</QueryClientProvider>
	);
}

test("an uncertain save cannot be bypassed by opening an older review", async () => {
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
	fireEvent.click(
		screen.getByRole("button", { name: existingReviewButtonName })
	);
	expect(
		screen.queryByRole("button", { name: "Yeni inceleme" })
	).not.toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: existingReviewButtonName })
	).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
	).toBeEnabled();

	mocks.list.mockResolvedValueOnce([existingRecord]);
	mocks.list.mockResolvedValueOnce([
		{ ...existingRecord, id: "pending", animationName: "New walk" },
		existingRecord,
	]);
	fireEvent.click(
		screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
	);
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save test review" })
		).toBeDisabled()
	);
	expect(
		screen.getByRole("button", { name: existingReviewButtonName })
	).toBeDisabled();

	fireEvent.click(
		screen.getByRole("button", { name: "Güncel kayıtları kontrol et" })
	);
	await screen.findByText("İnceleme kalıcı kayıttan doğrulandı.");
	expect(
		screen.getByRole("button", { name: "Review test record" })
	).toBeDisabled();
});

test("loads metadata for unique family records and exposes partial failures and retry", async () => {
	const callsByRecord = new Map<string, number>();
	mocks.metadata.mockImplementation(
		({ assetRecordId }: { assetRecordId: string }) => {
			const attempt = (callsByRecord.get(assetRecordId) ?? 0) + 1;
			callsByRecord.set(assetRecordId, attempt);
			if (assetRecordId === "record-two" && attempt === 1) {
				return Promise.reject(new Error("metadata unavailable"));
			}
			return Promise.resolve({
				records:
					assetRecordId === "record-one" ? [{ id: "metadata-record" }] : [],
			});
		}
	);
	mount({
		assetVersions: [
			{
				id: "version-one",
				assetFamilyId: "family",
				assetRecordId: "record-one",
			},
			{
				id: "version-two",
				assetFamilyId: "family",
				assetRecordId: "record-one",
			},
			{
				id: "version-three",
				assetFamilyId: "family",
				assetRecordId: "record-two",
			},
		],
	});

	await waitFor(() =>
		expect(screen.getByTestId("metadata-query-state")).toHaveTextContent(
			"error:metadata-record"
		)
	);
	expect(mocks.metadata).toHaveBeenCalledTimes(2);

	fireEvent.click(screen.getByRole("button", { name: "Retry metadata" }));
	await waitFor(() =>
		expect(screen.getByTestId("metadata-query-state")).toHaveTextContent(
			"ready:metadata-record"
		)
	);
	expect(mocks.metadata).toHaveBeenCalledTimes(4);
});

test("keeps preview versions stable while metadata queries settle", async () => {
	mocks.metadata.mockResolvedValue({ records: [] });
	mount({
		assetVersions: [
			{
				id: "version-one",
				assetFamilyId: "family",
				assetRecordId: "record-one",
			},
		],
	});

	await waitFor(() =>
		expect(screen.getByTestId("metadata-query-state")).toHaveTextContent(
			"ready:"
		)
	);

	expect(mocks.versionsSeen.length).toBeGreaterThan(1);
	expect(
		mocks.versionsSeen
			.slice(1)
			.every((versions) => versions === mocks.versionsSeen[0])
	).toBe(true);
});
