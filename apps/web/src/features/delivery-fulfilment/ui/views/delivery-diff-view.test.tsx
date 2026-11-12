// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { DeliveryDiffView } from "./delivery-diff-view";

const projectId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const firstId = "66666666-6666-4666-8666-666666666661";
const secondId = "66666666-6666-4666-8666-666666666662";

const needTwo = /Pick two Delivery Fulfilments/;
const noFulfilments = /fewer than two Delivery Fulfilments/;
const notRecordedText = /not recorded/i;
const addedText = /Added/;
const jumpText = /v-jump/;
const removedText = /Removed/;
const runText = /v-run/;
const changedText = /Changed/;
const idleTwoText = /v-idle-2/;
const ctxTwoText = /ctx-2/;
const itemIdleText = /Item idle/;

const fakeApi = vi.hoisted(() => ({
	compare: vi.fn(),
	fulfilments: [] as unknown[],
}));

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		deliveryFulfilment: {
			compareFulfilments: {
				queryOptions: ({ input }: { input: unknown }) => ({
					queryFn: () => fakeApi.compare(input),
					retry: false,
					queryKey: ["delivery-diff", input],
				}),
			},
			listFulfilments: {
				queryOptions: () => ({
					queryFn: () =>
						Promise.resolve({
							fulfilments: structuredClone(fakeApi.fulfilments),
						}),
					queryKey: ["delivery-fulfilments", targetId],
				}),
			},
		},
		deliveryPlanning: {
			list: {
				queryOptions: () => ({
					queryFn: () =>
						Promise.resolve({
							deliveryTargets: [
								{
									activeRevision: { id: "rev", revisionNumber: 2 },
									id: targetId,
									name: "Demo build",
								},
							],
						}),
					queryKey: ["delivery-targets"],
				}),
			},
		},
	},
}));

vi.mock("sonner", () => ({ toast: { dismiss: vi.fn(), error: vi.fn() } }));

const fulfilment = (
	id: string,
	revisionNumber: number,
	isCurrent: boolean
) => ({
	createdAt: "2026-11-12T10:00:00.000Z",
	deliveryTargetId: targetId,
	draftId: id,
	id,
	isCurrent,
	projectId,
	requirements: [],
	revisionId: `rev-${revisionNumber}`,
	revisionNumber,
});

const ref = (itemId: string) => ({
	assetFamilyId: "fam",
	assetFamilyName: "Hero",
	itemId,
	itemKind: "state",
	itemName: `Item ${itemId}`,
});

const notRecorded = (what: string) => ({
	reason: `A Delivery Fulfilment does not record ${what}.`,
	status: "not_recorded",
});

const summary = (id: string, revisionNumber: number) => ({
	createdAt: "2026-11-12T10:00:00.000Z",
	deliveryTargetId: targetId,
	id,
	revisionId: `rev-${revisionNumber}`,
	revisionNumber,
});

const diff = {
	assetVersions: {
		added: [{ ...ref("jump"), assetVersionIds: ["v-jump"] }],
		changed: [
			{
				...ref("idle"),
				fromAssetVersionIds: ["v-idle"],
				toAssetVersionIds: ["v-idle-2"],
			},
		],
		removed: [{ ...ref("run"), assetVersionIds: ["v-run"] }],
		unchangedCount: 1,
	},
	bundleMappings: {
		changes: [
			{
				...ref("idle"),
				from: {
					bundleId: "aaaaaaaa-0000-4000-8000-000000000000",
					manifestDigest: "a".repeat(64),
					resolution: "only_bundle",
				},
				to: {
					bundleId: "bbbbbbbb-0000-4000-8000-000000000000",
					manifestDigest: "b".repeat(64),
					resolution: "user_selected",
				},
			},
		],
	},
	context: {
		changed: true,
		from: { contextRevisionId: "ctx-1", contextRevisionNumber: 1 },
		status: "recorded",
		to: { contextRevisionId: "ctx-2", contextRevisionNumber: 2 },
	},
	from: summary(firstId, 1),
	qualityEvidence: notRecorded("QA evidence"),
	qualityException: notRecorded("Quality Exceptions"),
	rights: notRecorded("Rights Record revisions"),
	runtimeEvidence: notRecorded("runtime validation evidence"),
	to: summary(secondId, 2),
};

function renderView() {
	return render(
		<QueryClientProvider client={createQueryClient()}>
			<DeliveryDiffView
				deliveryTargetId={undefined}
				onSelectTarget={vi.fn()}
				projectId={projectId}
			/>
		</QueryClientProvider>
	);
}

beforeEach(() => {
	fakeApi.compare.mockReset();
	fakeApi.fulfilments = [
		fulfilment(secondId, 2, true),
		fulfilment(firstId, 1, true),
	];
});
afterEach(cleanup);

test("shows each difference section separately, with unrecorded sections explicit", async () => {
	fakeApi.compare.mockResolvedValue(diff);
	renderView();
	await userEvent.selectOptions(
		await screen.findByLabelText("Compare from"),
		firstId
	);
	await userEvent.selectOptions(screen.getByLabelText("Compare to"), secondId);

	const section = async (name: string) =>
		within(await screen.findByRole("region", { name }));

	expect(fakeApi.compare).toHaveBeenCalledWith({
		fromFulfilmentId: firstId,
		projectId,
		toFulfilmentId: secondId,
	});
	const assets = await section("Asset Versions");
	expect(assets.getByText(addedText)).toBeInTheDocument();
	expect(assets.getByText(jumpText)).toBeInTheDocument();
	expect(assets.getByText(removedText)).toBeInTheDocument();
	expect(assets.getByText(runText)).toBeInTheDocument();
	expect(assets.getByText(changedText)).toBeInTheDocument();
	expect(assets.getByText(idleTwoText)).toBeInTheDocument();

	expect((await section("Context")).getByText(ctxTwoText)).toBeInTheDocument();
	expect(
		(await section("Bundle mappings")).getByText(itemIdleText)
	).toBeInTheDocument();
	const unrecorded = await Promise.all(
		["Quality evidence", "Quality Exception", "Rights", "Runtime evidence"].map(
			section
		)
	);
	for (const body of unrecorded) {
		expect(body.getByText(notRecordedText)).toBeInTheDocument();
	}
});

test("asks for two Fulfilments before comparing anything", async () => {
	renderView();
	expect(await screen.findByText(needTwo)).toBeInTheDocument();
	expect(fakeApi.compare).not.toHaveBeenCalled();
});

test("explains when a target has fewer than two Fulfilments", async () => {
	fakeApi.fulfilments = [fulfilment(firstId, 1, true)];
	renderView();
	expect(await screen.findByText(noFulfilments)).toBeInTheDocument();
});

test("shows a retryable error when the comparison fails", async () => {
	fakeApi.compare.mockRejectedValue(new Error("boom"));
	renderView();
	await userEvent.selectOptions(
		await screen.findByLabelText("Compare from"),
		firstId
	);
	await userEvent.selectOptions(screen.getByLabelText("Compare to"), secondId);
	expect(
		await screen.findByText("The comparison could not be loaded.")
	).toBeInTheDocument();
});
