// @vitest-environment jsdom

import {
	cleanup,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { ReadinessPlanView } from "./readiness-plan-view";

const projectId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const revisionId = "33333333-3333-4333-8333-333333333333";
const oneWaiting = /1 version waiting for revalidation/;
const twoAtRisk = /2 derivative versions at risk/;
const nothingStarts = /Nothing starts automatically/;
const paletteLimit = /Palette limit/;
const readyNotDelivered = /Ready does not mean delivered/;
const targetReadinessText = /Target Readiness/;
const unlocksOne = /Unlocks 1 dependent work item/;
const scoreText = /score/i;
const noActiveRevisionText =
	/has no activated revision, so it has no Readiness Plan yet/;

const fakeApi = vi.hoisted(() => ({
	catalog: null as unknown,
	getError: null as unknown,
	plan: null as unknown,
	reorder: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		deliveryPlanning: {
			list: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve(structuredClone(fakeApi.catalog)),
					queryKey: ["delivery-targets", projectId],
				}),
			},
		},
		readinessPlans: {
			get: {
				queryOptions: ({ input }: { input: { deliveryTargetId: string } }) => ({
					queryFn: () =>
						fakeApi.getError
							? Promise.reject(fakeApi.getError)
							: Promise.resolve(structuredClone(fakeApi.plan)),
					queryKey: ["readiness-plan", input.deliveryTargetId],
				}),
			},
			reorder: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.reorder(input),
				}),
			},
		},
	},
}));

vi.mock("sonner", () => ({ toast: { dismiss: vi.fn(), error: vi.fn() } }));

function orpcError(code: string, message: string) {
	return Object.assign(new Error(message), { code });
}

function work(id: string, position: number, overrides = {}) {
	return {
		blockerId: "blocker-1",
		dependsOnWorkIds: [],
		id,
		opensWorkIds: [],
		orderSource: "suggested",
		position,
		rationales: {
			revalidationImpact: {
				derivativeVersionIds: ["v-d1", "v-d2"],
				requiredNowVersionIds: ["v-r1"],
			},
			targetRequirement: {
				itemId: "east",
				requiredSetRevisionId: "rs-1",
				requiredSetRevisionNumber: 4,
				source: "required_items_list",
			},
			unlocksDependentWork: { count: 1 },
			userPriority: { position: null },
		},
		title: `Work ${id}`,
		...overrides,
	};
}

function plan(overrides = {}) {
	return {
		blockers: [
			{
				assetFamilyId: "family-1",
				assetFamilyName: "Ash Knight",
				blockerCodes: ["quality"],
				id: "blocker-1",
				itemId: "east",
				itemName: "East-facing sprite",
				kind: "required_item_incomplete",
				unmetRequirements: [
					{
						id: "req-1",
						isCurrent: true,
						kind: "quality",
						name: "Palette limit",
						result: "failed",
					},
				],
			},
		],
		deliveryStatus: "not_delivered",
		deliveryTargetId: targetId,
		orderWarnings: [],
		recommendedNext: { basis: "suggested_order", workId: "a" },
		revisionId,
		revisionNumber: 4,
		targetReadiness: "blocked",
		workItems: [
			work("a", 1, { opensWorkIds: ["b"] }),
			work("b", 2, { dependsOnWorkIds: ["a"] }),
			work("c", 3),
		],
		...overrides,
	};
}

function catalog(
	activeRevision: unknown = { id: revisionId, revisionNumber: 4 }
) {
	return {
		deliveryTargets: [
			{
				activeRevision,
				drafts: [],
				id: targetId,
				name: "Chapter 1 demo",
				purpose: "demo",
				revisions: [],
			},
		],
	};
}

afterEach(() => {
	cleanup();
	fakeApi.catalog = null;
	fakeApi.getError = null;
	fakeApi.plan = null;
	fakeApi.reorder.mockReset();
});

function renderView(deliveryTargetId: string | undefined = targetId) {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ReadinessPlanView
				deliveryTargetId={deliveryTargetId}
				onSelectTarget={vi.fn()}
				projectId={projectId}
			/>
		</QueryClientProvider>
	);
}

function stepItems() {
	return within(
		screen.getByRole("list", { name: "Dependent work" })
	).getAllByRole("listitem");
}

test("a blocked plan shows Blocked, the blocker with unmet evidence and ordered steps", async () => {
	fakeApi.catalog = catalog();
	fakeApi.plan = plan();
	renderView();

	expect(await screen.findByText("Target Readiness: Blocked")).toBeVisible();
	const blockers = screen.getByRole("list", { name: "Blockers" });
	expect(within(blockers).getByText("East-facing sprite")).toBeVisible();
	expect(within(blockers).getByText(paletteLimit)).toBeVisible();
	expect(stepItems()).toHaveLength(3);
	expect(
		within(stepItems()[0] as HTMLElement).getByText("Work a")
	).toBeVisible();
});

test("shows the four rationales as separate fields, never one score", async () => {
	fakeApi.catalog = catalog();
	fakeApi.plan = plan();
	renderView();

	await screen.findByRole("list", { name: "Dependent work" });
	const first = stepItems()[0] as HTMLElement;
	expect(
		within(first).getByRole("heading", { level: 3, name: "Work a" })
	).toBeVisible();
	for (const term of [
		"Target requirement",
		"Work opened",
		"User priority",
		"Revalidation impact",
	]) {
		expect(within(first).getByText(term)).toBeVisible();
	}
	expect(
		within(first).getByText("Not set by you; suggested order")
	).toBeVisible();
	expect(within(first).getByText(unlocksOne)).toBeVisible();
	expect(within(first).getByText(oneWaiting)).toBeVisible();
	expect(within(first).getByText(twoAtRisk)).toBeVisible();
	expect(screen.queryByText(scoreText)).not.toBeInTheDocument();
});

test("a ready plan reads Ready but not Delivered", async () => {
	fakeApi.catalog = catalog();
	fakeApi.plan = plan({
		blockers: [],
		recommendedNext: null,
		targetReadiness: "ready",
		workItems: [],
	});
	renderView();

	expect(await screen.findByText("Target Readiness: Ready")).toBeVisible();
	expect(screen.getByText("Delivery Status: Not delivered")).toBeVisible();
	expect(screen.getByText(readyNotDelivered)).toBeVisible();
	expect(screen.getByText("No blockers.")).toBeVisible();
});

test("a delivered plan shows Delivered next to, not instead of, Ready", async () => {
	fakeApi.catalog = catalog();
	fakeApi.plan = plan({
		blockers: [],
		deliveryStatus: "delivered",
		recommendedNext: null,
		targetReadiness: "ready",
		workItems: [],
	});
	renderView();

	expect(await screen.findByText("Target Readiness: Ready")).toBeVisible();
	expect(screen.getByText("Delivery Status: Delivered")).toBeVisible();
	expect(screen.queryByText(readyNotDelivered)).not.toBeInTheDocument();
});

test("the recommended next step is a suggestion that starts nothing", async () => {
	fakeApi.catalog = catalog();
	fakeApi.plan = plan();
	renderView();

	const suggestion = await screen.findByRole("region", {
		name: "Suggested next step",
	});
	expect(within(suggestion).getByText("Work a")).toBeVisible();
	expect(within(suggestion).getByText(nothingStarts)).toBeVisible();
	expect(within(suggestion).queryByRole("button")).not.toBeInTheDocument();
});

test("moving work down saves the complete order against the plan revision", async () => {
	fakeApi.catalog = catalog();
	fakeApi.plan = plan();
	fakeApi.reorder.mockImplementation(() =>
		Promise.resolve(
			plan({
				workItems: [
					work("b", 1, { orderSource: "user" }),
					work("a", 2, { orderSource: "user" }),
					work("c", 3, { orderSource: "user" }),
				],
			})
		)
	);
	renderView();
	const user = userEvent.setup();

	await user.click(
		await screen.findByRole("button", { name: "Move Work a down" })
	);

	await waitFor(() =>
		expect(fakeApi.reorder).toHaveBeenCalledWith({
			deliveryTargetId: targetId,
			orderedWorkIds: ["b", "a", "c"],
			projectId,
			revisionId,
		})
	);
	await waitFor(() =>
		expect(
			within(stepItems()[0] as HTMLElement).getByText("Work b")
		).toBeVisible()
	);
});

test("the first step cannot move up and the last cannot move down", async () => {
	fakeApi.catalog = catalog();
	fakeApi.plan = plan();
	renderView();

	expect(
		await screen.findByRole("button", { name: "Move Work a up" })
	).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Move Work c down" })
	).toBeDisabled();
});

test("a CONFLICT on reorder tells the user the plan changed and offers a reload", async () => {
	fakeApi.catalog = catalog();
	fakeApi.plan = plan();
	fakeApi.reorder.mockRejectedValue(
		orpcError("CONFLICT", "The Readiness Plan is no longer active.")
	);
	renderView();
	const user = userEvent.setup();

	await user.click(
		await screen.findByRole("button", { name: "Move Work a down" })
	);

	const alert = await screen.findByRole("alert");
	expect(alert).toHaveTextContent(
		"The order was not saved because the plan changed."
	);
	expect(screen.getByRole("button", { name: "Reload plan" })).toBeVisible();
	expect(
		within(stepItems()[0] as HTMLElement).getByText("Work a")
	).toBeVisible();
});

test("a NOT_FOUND on reorder says the Delivery Target is gone", async () => {
	fakeApi.catalog = catalog();
	fakeApi.plan = plan();
	fakeApi.reorder.mockRejectedValue(
		orpcError("NOT_FOUND", "Delivery Target not found.")
	);
	renderView();
	const user = userEvent.setup();

	await user.click(
		await screen.findByRole("button", { name: "Move Work a down" })
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"This Delivery Target was not found, so the order was not saved."
	);
});

test("a target without an activated revision has no plan yet", async () => {
	fakeApi.catalog = catalog(null);
	renderView();

	expect(await screen.findByText(noActiveRevisionText)).toBeVisible();
	expect(screen.queryByText(targetReadinessText)).not.toBeInTheDocument();
});

test("a CONFLICT when loading the plan shows the no-active-revision state", async () => {
	fakeApi.catalog = catalog();
	fakeApi.getError = orpcError("CONFLICT", "no active revision");
	renderView();

	expect(await screen.findByText(noActiveRevisionText)).toBeVisible();
});

test("a NOT_FOUND when loading the plan says the target was not found", async () => {
	fakeApi.catalog = catalog();
	fakeApi.getError = orpcError("NOT_FOUND", "Delivery Target not found.");
	renderView();

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"This Delivery Target was not found."
	);
});

test("a server failure when loading the plan shows the Support Reference as text", async () => {
	fakeApi.catalog = catalog();
	fakeApi.getError = Object.assign(new Error("private details"), {
		code: "INTERNAL_SERVER_ERROR",
		data: { supportReference: "SUP-7CFB1C3A-A7A3-4BC2-B748-B5065AA2314A" },
	});
	renderView();

	const alert = await screen.findByRole("alert");
	expect(alert).toHaveTextContent("The Readiness Plan could not be loaded.");
	expect(alert).toHaveTextContent(
		"Support reference: SUP-7CFB1C3A-A7A3-4BC2-B748-B5065AA2314A"
	);
});

test("a connection failure when loading the plan invents no Support Reference", async () => {
	fakeApi.catalog = catalog();
	fakeApi.getError = new TypeError("Failed to fetch");
	renderView();

	const alert = await screen.findByRole("alert");
	expect(alert).toHaveTextContent("The Readiness Plan could not be loaded.");
	expect(alert).not.toHaveTextContent("Support reference");
});

test("a project with no Delivery Targets says so", async () => {
	fakeApi.catalog = { deliveryTargets: [] };
	renderView(undefined);

	expect(
		await screen.findByText("This project has no Delivery Targets yet.")
	).toBeVisible();
});
