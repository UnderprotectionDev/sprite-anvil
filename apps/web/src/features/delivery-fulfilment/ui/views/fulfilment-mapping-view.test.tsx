// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { FulfilmentMappingView } from "./fulfilment-mapping-view";

const projectId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const revisionId = "33333333-3333-4333-8333-333333333333";
const draftId = "44444444-4444-4444-8444-444444444444";
const bundleA = "55555555-5555-4555-8555-555555555551";
const bundleB = "55555555-5555-4555-8555-555555555552";

const notDelivered = /A mapping draft is not a Delivery Fulfilment/;
const readyNotDelivered = /Ready does not mean delivered/;
const mustBeReady = /Only a Ready Delivery Target/;
const oneConflict = /1 conflict/;
const oneMissing = /1 missing/;
const picksUser = /only you pick/i;
const noActiveRevisionText = /has no activated revision/;

const fakeApi = vi.hoisted(() => ({
	drafts: [] as unknown[],
	finalize: vi.fn(),
	fulfilments: [] as unknown[],
	prepare: vi.fn(),
	targets: [] as unknown[],
}));

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		deliveryFulfilment: {
			finalize: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.finalize(input),
				}),
			},
			listFulfilments: {
				key: () => ["delivery-fulfilments"],
				queryOptions: () => ({
					queryFn: () =>
						Promise.resolve({
							fulfilments: structuredClone(fakeApi.fulfilments),
						}),
					queryKey: ["delivery-fulfilments", targetId],
				}),
			},
			listMappings: {
				key: () => ["fulfilment-mappings"],
				queryOptions: () => ({
					queryFn: () =>
						Promise.resolve({ drafts: structuredClone(fakeApi.drafts) }),
					queryKey: ["fulfilment-mappings", targetId],
				}),
			},
			prepareMapping: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.prepare(input),
				}),
			},
		},
		readinessPlans: { get: { key: () => ["readiness-plan"] } },
		deliveryPlanning: {
			list: {
				queryOptions: () => ({
					queryFn: () =>
						Promise.resolve({
							deliveryTargets: structuredClone(fakeApi.targets),
						}),
					queryKey: ["delivery-targets"],
				}),
			},
		},
	},
}));

vi.mock("sonner", () => ({ toast: { dismiss: vi.fn(), error: vi.fn() } }));

const target = {
	activeRevision: { id: revisionId, revisionNumber: 2 },
	id: targetId,
	name: "Demo build",
};

function requirement(itemId: string, status: string, extra = {}) {
	return {
		assetFamilyId: "fam",
		assetFamilyName: "Hero",
		candidates: [],
		itemId,
		itemKind: "state",
		itemName: `Item ${itemId}`,
		proposedBundleId: null,
		requiredSetRevisionId: "rs",
		status,
		...extra,
	};
}

const draft = {
	bundleChecks: [
		{
			bundleId: bundleA,
			createdAt: "2026-11-11T10:00:00.000Z",
			manifestDigest: "a".repeat(64),
			runtimeValidation: { environments: [], ready: true, required: false },
		},
	],
	createdAt: "2026-11-12T10:00:00.000Z",
	deliveryTargetId: targetId,
	id: draftId,
	projectId,
	requirements: [
		requirement("idle", "mapped", {
			candidates: [
				{
					assetVersionIds: ["ver-idle"],
					bundleId: bundleA,
					manifestDigest: "a".repeat(64),
				},
			],
			proposedBundleId: bundleA,
		}),
		requirement("run", "conflict", {
			candidates: [
				{
					assetVersionIds: ["ver-run-1"],
					bundleId: bundleA,
					manifestDigest: "a".repeat(64),
				},
				{
					assetVersionIds: ["ver-run-2"],
					bundleId: bundleB,
					manifestDigest: "b".repeat(64),
				},
			],
		}),
		requirement("jump", "missing"),
	],
	revisionId,
	revisionNumber: 2,
};

function renderView() {
	return render(
		<QueryClientProvider client={createQueryClient()}>
			<FulfilmentMappingView
				deliveryTargetId={undefined}
				onSelectTarget={vi.fn()}
				projectId={projectId}
			/>
		</QueryClientProvider>
	);
}

beforeEach(() => {
	fakeApi.drafts = [];
	fakeApi.targets = [target];
	fakeApi.prepare.mockReset();
	fakeApi.finalize.mockReset();
	fakeApi.fulfilments = [];
});
afterEach(cleanup);

test("shows the persisted draft with missing and conflicting requirements", async () => {
	fakeApi.drafts = [draft];
	renderView();
	expect(await screen.findByText(oneConflict)).toBeInTheDocument();
	expect(screen.getByText(oneMissing)).toBeInTheDocument();
	const rows = screen.getAllByRole("listitem");
	const conflict = rows.find((row) => row.textContent?.includes("Item run"));
	expect(conflict).toHaveTextContent("Conflict");
	expect(conflict).toHaveTextContent("ver-run-1");
	expect(conflict).toHaveTextContent("ver-run-2");
	expect(conflict).toHaveTextContent(picksUser);
	const missing = rows.find((row) => row.textContent?.includes("Item jump"));
	expect(missing).toHaveTextContent("Missing");
	expect(screen.getByText(notDelivered)).toBeInTheDocument();
	expect(screen.getByText(readyNotDelivered)).toBeInTheDocument();
});

test("prepares a mapping draft for the target and shows the re-read draft", async () => {
	fakeApi.prepare.mockImplementation(() => {
		fakeApi.drafts = [draft];
		return Promise.resolve({ draft, status: "created" });
	});
	renderView();
	await userEvent.click(
		await screen.findByRole("button", { name: "Prepare mapping" })
	);
	expect(fakeApi.prepare).toHaveBeenCalledWith(
		expect.objectContaining({ deliveryTargetId: targetId, projectId })
	);
	expect(await screen.findByText(oneConflict)).toBeInTheDocument();
});

test("explains why a target that is not Ready cannot be prepared", async () => {
	fakeApi.prepare.mockRejectedValue(
		Object.assign(
			new Error(
				"Only a Ready Delivery Target can have a mapping prepared; resolve its Readiness Plan blockers first."
			),
			{ code: "CONFLICT" }
		)
	);
	renderView();
	await userEvent.click(
		await screen.findByRole("button", { name: "Prepare mapping" })
	);
	expect(await screen.findByRole("alert")).toHaveTextContent(mustBeReady);
});

test("tells the user a target without an active revision has nothing to map", async () => {
	fakeApi.targets = [{ ...target, activeRevision: null }];
	renderView();
	expect(await screen.findByText(noActiveRevisionText)).toBeInTheDocument();
	expect(
		screen.queryByRole("button", { name: "Prepare mapping" })
	).not.toBeInTheDocument();
});

test("says so when the project has no Delivery Target", async () => {
	fakeApi.targets = [];
	renderView();
	expect(
		await screen.findByText("This project has no Delivery Targets yet.")
	).toBeInTheDocument();
});

const conflictOnlyDraft = {
	...draft,
	requirements: draft.requirements.filter((entry) => entry.itemId !== "jump"),
};

const cannotFinalize = /cannot be finalized while 1 requirement is missing/;
const pickBundle = /Pick an Export Bundle/;
const noFulfilment = /No Delivery Fulfilment exists/;
const staleRevision = /no longer the active revision/;

function fulfilmentRecord(id: string, createdAt: string, isCurrent: boolean) {
	return {
		createdAt,
		deliveryTargetId: targetId,
		draftId,
		id,
		isCurrent,
		projectId,
		requirements: [],
		revisionId,
		revisionNumber: 2,
	};
}

test("a draft with a missing requirement cannot be finalized", async () => {
	fakeApi.drafts = [draft];
	renderView();
	expect(await screen.findByText(cannotFinalize)).toBeInTheDocument();
	expect(
		screen.queryByRole("button", { name: "Finalize Fulfilment" })
	).not.toBeInTheDocument();
});

test("every conflict needs the user's pick before a Fulfilment is finalized", async () => {
	fakeApi.drafts = [conflictOnlyDraft];
	renderView();
	await userEvent.click(
		await screen.findByRole("button", { name: "Finalize Fulfilment" })
	);
	expect(await screen.findByText(pickBundle)).toBeInTheDocument();
	expect(fakeApi.finalize).not.toHaveBeenCalled();
});

test("finalizes with the picked bundle and then shows the current Fulfilment", async () => {
	fakeApi.drafts = [conflictOnlyDraft];
	fakeApi.finalize.mockImplementation(() => {
		fakeApi.fulfilments = [
			fulfilmentRecord("fulfil-1", "2026-11-12T11:00:00.000Z", true),
		];
		return Promise.resolve({
			fulfilment: fakeApi.fulfilments[0],
			status: "created",
		});
	});
	renderView();
	await userEvent.selectOptions(
		await screen.findByLabelText("Export Bundle for Hero: Item run"),
		bundleB
	);
	await userEvent.click(
		screen.getByRole("button", { name: "Finalize Fulfilment" })
	);
	expect(fakeApi.finalize).toHaveBeenCalledWith(
		expect.objectContaining({
			deliveryTargetId: targetId,
			draftId,
			projectId,
			selections: [{ assetFamilyId: "fam", bundleId: bundleB, itemId: "run" }],
		})
	);
	expect(await screen.findByText("Current Fulfilment")).toBeInTheDocument();
});

test("a conflict-free draft finalizes without any pick", async () => {
	fakeApi.drafts = [
		{
			...draft,
			requirements: [draft.requirements[0]],
		},
	];
	fakeApi.finalize.mockResolvedValue({ status: "created" });
	renderView();
	await userEvent.click(
		await screen.findByRole("button", { name: "Finalize Fulfilment" })
	);
	expect(fakeApi.finalize).toHaveBeenCalledWith(
		expect.objectContaining({ draftId, selections: [] })
	);
});

test("shows why finalizing was refused", async () => {
	fakeApi.drafts = [{ ...draft, requirements: [draft.requirements[0]] }];
	fakeApi.finalize.mockRejectedValue(
		Object.assign(
			new Error(
				"The mapping draft belongs to a revision that is no longer the active revision. Prepare a new mapping."
			),
			{ code: "CONFLICT" }
		)
	);
	renderView();
	await userEvent.click(
		await screen.findByRole("button", { name: "Finalize Fulfilment" })
	);
	expect(await screen.findByRole("alert")).toHaveTextContent(staleRevision);
});

test("says no Fulfilment exists yet and that Ready is not Delivered", async () => {
	fakeApi.drafts = [draft];
	renderView();
	expect(await screen.findByText(noFulfilment)).toBeInTheDocument();
});

test("lists the current Fulfilment and keeps earlier ones as history", async () => {
	fakeApi.drafts = [draft];
	fakeApi.fulfilments = [
		fulfilmentRecord("fulfil-2", "2026-11-12T12:00:00.000Z", true),
		fulfilmentRecord("fulfil-1", "2026-11-12T11:00:00.000Z", false),
	];
	renderView();
	expect(await screen.findByText("Current Fulfilment")).toBeInTheDocument();
	expect(screen.getByText("Earlier Fulfilment")).toBeInTheDocument();
});
