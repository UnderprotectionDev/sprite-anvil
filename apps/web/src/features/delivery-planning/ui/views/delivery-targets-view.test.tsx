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
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { DeliveryTargetsView } from "./delivery-targets-view";

const projectId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const contextRevisionId = "33333333-3333-4333-8333-333333333333";
const knightFamilyId = "44444444-4444-4444-8444-444444444441";
const slimeFamilyId = "44444444-4444-4444-8444-444444444442";
const knightListId = "55555555-5555-4555-8555-555555555551";
const knightListV2Id = "55555555-5555-4555-8555-555555555552";
const slimeListId = "55555555-5555-4555-8555-555555555553";
const draftId = "66666666-6666-4666-8666-666666666661";
const revisionId = "77777777-7777-4777-8777-777777777771";

const noTargetsText = "This project has no Delivery Targets yet.";
const atLeastTwoText = /must cover at least two Asset Families/;
const draftSavedHeading = /^Draft saved/;
const choosePurposeText = /Choose a purpose\./;
const chooseRequirementText =
	/Choose a default Production Evidence requirement\./;
const needsStateText = /needs at least one acceptable state/;
const takenRepeatedlyText = /revision number was taken repeatedly/;
const contextOneText = "Context Revision 1";
const listRevisionOneText = "Required Items List revision 1";
const nothingChangesText = /Target Readiness does not change/;
const noListText = "Bone Bat has no Required Items List revision yet.";
const diffHeading = "Scope diff against revision 1";
const uuidPattern = /^[0-9a-f-]{36}$/;

const fakeApi = vi.hoisted(() => ({
	activate: vi.fn(),
	catalog: { deliveryTargets: [] as unknown[] },
	saveDraft: vi.fn(),
}));

vi.mock("@/utils/orpc", () => {
	const ids = {
		empty: "44444444-4444-4444-8444-444444444443",
		knight: "44444444-4444-4444-8444-444444444441",
		slime: "44444444-4444-4444-8444-444444444442",
	};
	const listRevision = (
		id: string,
		assetFamilyId: string,
		revisionNumber: number,
		isActive: boolean
	) => ({
		assetFamilyId,
		createdAt: "2026-11-01T10:00:00.000Z",
		createdByUserId: "u",
		id,
		isActive,
		items: [],
		projectId: "11111111-1111-4111-8111-111111111111",
		revisionNumber,
		wasActivated: isActive,
	});
	const readiness: Record<string, unknown> = {
		[ids.knight]: {
			activeRevision: listRevision(
				"55555555-5555-4555-8555-555555555551",
				ids.knight,
				1,
				true
			),
			assetFamilyId: ids.knight,
			items: [],
			projectId: "11111111-1111-4111-8111-111111111111",
			revisions: [
				listRevision(
					"55555555-5555-4555-8555-555555555552",
					ids.knight,
					2,
					false
				),
				listRevision(
					"55555555-5555-4555-8555-555555555551",
					ids.knight,
					1,
					true
				),
			],
			status: "incomplete",
		},
		[ids.slime]: {
			activeRevision: listRevision(
				"55555555-5555-4555-8555-555555555553",
				ids.slime,
				1,
				true
			),
			assetFamilyId: ids.slime,
			items: [],
			projectId: "11111111-1111-4111-8111-111111111111",
			revisions: [
				listRevision(
					"55555555-5555-4555-8555-555555555553",
					ids.slime,
					1,
					true
				),
			],
			status: "incomplete",
		},
		[ids.empty]: {
			activeRevision: null,
			assetFamilyId: ids.empty,
			items: [],
			projectId: "11111111-1111-4111-8111-111111111111",
			revisions: [],
			status: "not_configured",
		},
	};
	return {
		client: {},
		orpc: {
			assetFamilies: {
				list: {
					queryOptions: () => ({
						queryFn: () =>
							Promise.resolve({
								assetFamilies: [
									{ id: ids.knight, name: "Ash Knight" },
									{ id: ids.slime, name: "Moss Slime" },
									{ id: ids.empty, name: "Bone Bat" },
								],
								assetRecords: [],
								relationships: [],
								subjectIdentities: [],
							}),
						queryKey: ["asset-families"],
					}),
				},
			},
			deliveryPlanning: {
				activate: {
					mutationOptions: (options?: object) => ({
						...options,
						mutationFn: (input: unknown) => fakeApi.activate(input),
					}),
				},
				list: {
					queryOptions: () => ({
						queryFn: () => Promise.resolve(structuredClone(fakeApi.catalog)),
						queryKey: ["delivery-targets"],
					}),
				},
				saveDraft: {
					mutationOptions: (options?: object) => ({
						...options,
						mutationFn: (input: unknown) => fakeApi.saveDraft(input),
					}),
				},
			},
			familyReadiness: {
				list: {
					queryOptions: ({ input }: { input: { assetFamilyId: string } }) => ({
						queryFn: () => Promise.resolve(readiness[input.assetFamilyId]),
						queryKey: ["family-readiness", input.assetFamilyId],
					}),
				},
			},
			projectContexts: {
				list: {
					queryOptions: () => ({
						queryFn: () =>
							Promise.resolve([
								{
									currentContextRevision: {
										id: "33333333-3333-4333-8333-333333333333",
										isActive: true,
										revisionNumber: 1,
									},
									id: "11111111-1111-4111-8111-111111111111",
									name: "Ember Keep",
								},
							]),
						queryKey: ["project-contexts"],
					}),
				},
			},
		},
	};
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		Link: ({
			children,
			search,
			to,
		}: {
			children: React.ReactNode;
			search?: Record<string, string>;
			to: string;
		}) => (
			<a href={`${to}?${new URLSearchParams(search).toString()}`}>{children}</a>
		),
	};
});

vi.mock("sonner", () => ({ toast: { dismiss: vi.fn(), error: vi.fn() } }));

function orpcError(code: string, message: string) {
	return Object.assign(new Error(message), { code });
}

const requiredItem = (id: string, name: string, kind = "direction") => ({
	assetRecordIds: ["99999999-9999-4999-8999-999999999999"],
	disposition: "required",
	id,
	kind,
	name,
});

function scope(overrides = {}) {
	return {
		contextRevisionId,
		contextRevisionNumber: 1,
		families: [
			{
				assetFamilyId: knightFamilyId,
				assetFamilyName: "Ash Knight",
				requiredItems: [requiredItem("east", "East-facing sprite")],
				requiredSetRevisionId: knightListId,
				requiredSetRevisionNumber: 1,
				usageTests: [requiredItem("scene", "Dark floor scene", "usage_test")],
			},
			{
				assetFamilyId: slimeFamilyId,
				assetFamilyName: "Moss Slime",
				requiredItems: [requiredItem("idle", "Idle loop", "animation")],
				requiredSetRevisionId: slimeListId,
				requiredSetRevisionNumber: 1,
				usageTests: [],
			},
		],
		productionEvidencePolicy: {
			defaultRequirement: "advisory",
			familyRequirements: [],
		},
		rightsEvidencePolicy: {
			acceptableStates: ["documented"],
			requireRecordFor: ["references"],
		},
		...overrides,
	};
}

function draft(overrides = {}) {
	return {
		...scope(),
		activatedRevisionId: null,
		createdAt: "2026-11-02T10:00:00.000Z",
		id: draftId,
		...overrides,
	};
}

function revision(overrides = {}) {
	return {
		...scope(),
		activatedAt: "2026-11-02T11:00:00.000Z",
		draftId,
		id: revisionId,
		revisionNumber: 1,
		scopeDiff: null,
		...overrides,
	};
}

function target(overrides = {}) {
	return {
		activeRevision: null,
		drafts: [],
		id: targetId,
		name: "Chapter 1 demo",
		purpose: "demo",
		revisions: [],
		...overrides,
	};
}

beforeEach(() => {
	fakeApi.catalog = { deliveryTargets: [] };
});

afterEach(() => {
	cleanup();
	fakeApi.activate.mockReset();
	fakeApi.saveDraft.mockReset();
});

function renderView() {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<DeliveryTargetsView projectId={projectId} />
		</QueryClientProvider>
	);
}

async function openNewTargetForm(user: ReturnType<typeof userEvent.setup>) {
	await user.click(
		await screen.findByRole("button", { name: "New Delivery Target" })
	);
}

async function choosePolicies(user: ReturnType<typeof userEvent.setup>) {
	await user.selectOptions(screen.getByLabelText("Purpose"), "demo");
	await user.selectOptions(
		screen.getByLabelText("Default Production Evidence requirement"),
		"advisory"
	);
	await user.click(screen.getByRole("checkbox", { name: "Documented" }));
}

async function pinBothFamilies(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole("checkbox", { name: "Ash Knight" }));
	await user.click(screen.getByRole("checkbox", { name: "Moss Slime" }));
}

test("an empty project shows the empty state and offers a new target", async () => {
	renderView();
	expect(await screen.findByText(noTargetsText)).toBeVisible();
	expect(
		screen.getByRole("button", { name: "New Delivery Target" })
	).toBeVisible();
});

test("a draft spanning two families is reviewed with its pinned scope and not yet active", async () => {
	fakeApi.catalog = { deliveryTargets: [target({ drafts: [draft()] })] };
	renderView();

	const review = await screen.findByRole("region", { name: "Draft review" });
	expect(
		within(review).getByRole("heading", { level: 3, name: draftSavedHeading })
	).toBeVisible();
	expect(within(review).getByText(contextOneText)).toBeVisible();
	expect(within(review).getByText("Ash Knight")).toBeVisible();
	expect(within(review).getByText("Moss Slime")).toBeVisible();
	expect(within(review).getByText("East-facing sprite")).toBeVisible();
	expect(within(review).getByText("Dark floor scene")).toBeVisible();
	expect(within(review).getAllByText(listRevisionOneText)).toHaveLength(2);
	expect(within(review).getByText(nothingChangesText)).toBeVisible();
	expect(screen.getByText("Not activated")).toBeVisible();
	expect(
		screen.queryByRole("link", { name: "Open Readiness Plan" })
	).not.toBeInTheDocument();
});

test("activating a draft shows the revision re-read from the catalog and links the Readiness Plan", async () => {
	const user = userEvent.setup();
	fakeApi.catalog = { deliveryTargets: [target({ drafts: [draft()] })] };
	fakeApi.activate.mockImplementation((input: { id: string }) => {
		const activated = revision({ id: input.id });
		fakeApi.catalog = {
			deliveryTargets: [
				target({
					activeRevision: activated,
					drafts: [draft({ activatedRevisionId: input.id })],
					revisions: [activated],
				}),
			],
		};
		return Promise.resolve(activated);
	});
	renderView();

	await user.click(
		await screen.findByRole("button", { name: "Activate revision" })
	);

	await waitFor(() =>
		expect(
			screen.getByRole("heading", { name: "Active revision 1" })
		).toBeVisible()
	);
	expect(fakeApi.activate).toHaveBeenCalledWith({
		draftId,
		id: expect.stringMatching(uuidPattern),
		projectId,
	});
	expect(screen.queryByRole("region", { name: "Draft review" })).toBeNull();
	expect(
		screen.getByRole("link", { name: "Open Readiness Plan" })
	).toHaveAttribute(
		"href",
		`/projects/$projectId/readiness-plan?deliveryTargetId=${targetId}`
	);
});

test("an activation conflict is explained and the draft stays reviewable", async () => {
	const user = userEvent.setup();
	fakeApi.catalog = { deliveryTargets: [target({ drafts: [draft()] })] };
	fakeApi.activate.mockRejectedValue(
		orpcError("CONFLICT", "The Delivery Target revision number was taken.")
	);
	renderView();

	await user.click(
		await screen.findByRole("button", { name: "Activate revision" })
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		takenRepeatedlyText
	);
	expect(
		screen.getByRole("button", { name: "Activate revision" })
	).toBeEnabled();
	expect(screen.getByRole("region", { name: "Draft review" })).toBeVisible();
});

test("the new-target form rejects fewer than two families without saving", async () => {
	const user = userEvent.setup();
	renderView();

	await openNewTargetForm(user);
	await user.type(await screen.findByLabelText("Name"), "Demo build");
	await user.click(await screen.findByRole("checkbox", { name: "Ash Knight" }));
	await choosePolicies(user);
	await user.click(screen.getByRole("button", { name: "Save draft" }));

	expect(await screen.findByText(atLeastTwoText)).toBeVisible();
	expect(fakeApi.saveDraft).not.toHaveBeenCalled();
});

test("the new-target form rejects an empty rights state selection", async () => {
	const user = userEvent.setup();
	renderView();

	await openNewTargetForm(user);
	await user.type(await screen.findByLabelText("Name"), "Demo build");
	await pinBothFamilies(user);
	await user.selectOptions(screen.getByLabelText("Purpose"), "demo");
	await user.selectOptions(
		screen.getByLabelText("Default Production Evidence requirement"),
		"advisory"
	);
	await user.click(screen.getByRole("button", { name: "Save draft" }));

	expect(await screen.findByText(needsStateText)).toBeVisible();
	expect(fakeApi.saveDraft).not.toHaveBeenCalled();
});

test("a new target form starts with no purpose, requirement or Rights Record state chosen", async () => {
	const user = userEvent.setup();
	renderView();

	await openNewTargetForm(user);

	expect(await screen.findByLabelText("Purpose")).toHaveValue("");
	expect(
		screen.getByLabelText("Default Production Evidence requirement")
	).toHaveValue("");
	for (const state of [
		"Assertion only",
		"Documented",
		"Restricted",
		"Unknown",
	]) {
		expect(screen.getByRole("checkbox", { name: state })).not.toBeChecked();
	}
	await user.type(screen.getByLabelText("Name"), "Demo build");
	await pinBothFamilies(user);
	await user.click(screen.getByRole("button", { name: "Save draft" }));

	expect(await screen.findByText(choosePurposeText)).toBeVisible();
	expect(screen.getByText(chooseRequirementText)).toBeVisible();
	expect(screen.getByText(needsStateText)).toBeVisible();
	expect(fakeApi.saveDraft).not.toHaveBeenCalled();
});

test("a family without a Required Items List revision cannot be pinned", async () => {
	const user = userEvent.setup();
	renderView();

	await openNewTargetForm(user);

	expect(
		await screen.findByRole("checkbox", { name: "Bone Bat" })
	).toHaveAttribute("aria-disabled", "true");
	expect(screen.getByText(noListText)).toBeVisible();
});

test("saving a draft sends the pinned scope and policies, then shows it for review", async () => {
	const user = userEvent.setup();
	fakeApi.saveDraft.mockImplementation(
		(input: { id: string; name: string; purpose: string }) => {
			const saved = draft({ id: input.id });
			fakeApi.catalog = {
				deliveryTargets: [
					target({ drafts: [saved], name: input.name, purpose: input.purpose }),
				],
			};
			return Promise.resolve(saved);
		}
	);
	renderView();

	await openNewTargetForm(user);
	await user.type(await screen.findByLabelText("Name"), "Chapter 1 demo");
	await pinBothFamilies(user);
	await user.selectOptions(screen.getByLabelText("Purpose"), "demo");
	await user.click(screen.getByRole("checkbox", { name: "Documented" }));
	await user.selectOptions(
		screen.getByLabelText("Required Items List revision for Ash Knight"),
		knightListV2Id
	);
	await user.selectOptions(
		screen.getByLabelText("Default Production Evidence requirement"),
		"legacy_asset_attestation_acceptable"
	);
	await user.selectOptions(
		screen.getByLabelText("Production Evidence requirement for Moss Slime"),
		"full_generation_package_history"
	);
	await user.click(screen.getByRole("checkbox", { name: "Restricted" }));
	await user.click(screen.getByRole("checkbox", { name: "Results" }));
	await user.click(screen.getByRole("button", { name: "Save draft" }));

	expect(
		await screen.findByRole("region", { name: "Draft review" })
	).toBeVisible();
	expect(fakeApi.saveDraft).toHaveBeenCalledTimes(1);
	expect(fakeApi.saveDraft.mock.calls[0]?.[0]).toEqual({
		contextRevisionId,
		deliveryTargetId: expect.stringMatching(uuidPattern),
		families: [
			{ assetFamilyId: knightFamilyId, requiredSetRevisionId: knightListV2Id },
			{ assetFamilyId: slimeFamilyId, requiredSetRevisionId: slimeListId },
		],
		id: expect.stringMatching(uuidPattern),
		name: "Chapter 1 demo",
		productionEvidencePolicy: {
			defaultRequirement: "legacy_asset_attestation_acceptable",
			familyRequirements: [
				{
					assetFamilyId: slimeFamilyId,
					requirement: "full_generation_package_history",
				},
			],
		},
		projectId,
		purpose: "demo",
		rightsEvidencePolicy: {
			acceptableStates: ["documented", "restricted"],
			requireRecordFor: ["results"],
		},
	});
});

test("a rejected draft keeps the form and explains the server reason", async () => {
	const user = userEvent.setup();
	fakeApi.saveDraft.mockRejectedValue(
		orpcError(
			"BAD_REQUEST",
			"The selected Context Revision was not found in this project."
		)
	);
	renderView();

	await openNewTargetForm(user);
	await user.type(await screen.findByLabelText("Name"), "Demo");
	await pinBothFamilies(user);
	await choosePolicies(user);
	await user.click(screen.getByRole("button", { name: "Save draft" }));

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"The selected Context Revision was not found in this project."
	);
	expect(screen.getByLabelText("Name")).toHaveValue("Demo");
});

test("re-versioning keeps the target, pins the evidence policies and shows the scope diff after activation", async () => {
	const user = userEvent.setup();
	const first = revision();
	const nextPolicies = {
		productionEvidencePolicy: {
			defaultRequirement: "full_generation_package_history",
			familyRequirements: [],
		},
		rightsEvidencePolicy: {
			acceptableStates: ["documented", "assertion_only"],
			requireRecordFor: ["references", "results"],
		},
	};
	fakeApi.catalog = {
		deliveryTargets: [
			target({
				activeRevision: first,
				drafts: [draft({ activatedRevisionId: first.id })],
				revisions: [first],
			}),
		],
	};
	fakeApi.saveDraft.mockImplementation((input: { id: string }) => {
		const next = draft({ id: input.id, ...nextPolicies });
		fakeApi.catalog = {
			deliveryTargets: [
				target({
					activeRevision: first,
					drafts: [draft({ activatedRevisionId: first.id }), next],
					revisions: [first],
				}),
			],
		};
		return Promise.resolve(next);
	});
	fakeApi.activate.mockImplementation((input: { draftId: string }) => {
		const second = revision({
			...nextPolicies,
			draftId: input.draftId,
			id: "77777777-7777-4777-8777-777777777772",
			revisionNumber: 2,
			scopeDiff: {
				contextChange: null,
				familiesAdded: [],
				familiesRemoved: [],
				previousRevisionId: first.id,
				previousRevisionNumber: 1,
				productionEvidencePolicyChanged: true,
				requiredSetChanges: [],
				rightsEvidencePolicyChanged: true,
			},
		});
		fakeApi.catalog = {
			deliveryTargets: [
				target({
					activeRevision: second,
					drafts: [draft({ activatedRevisionId: first.id })],
					revisions: [first, second],
				}),
			],
		};
		return Promise.resolve(second);
	});
	renderView();

	await user.click(await screen.findByRole("button", { name: "New revision" }));
	expect(await screen.findByLabelText("Name")).toBeDisabled();
	expect(
		await screen.findByRole("checkbox", { name: "Ash Knight" })
	).toBeChecked();
	await user.selectOptions(
		screen.getByLabelText("Default Production Evidence requirement"),
		"full_generation_package_history"
	);
	await user.click(screen.getByRole("checkbox", { name: "Assertion only" }));
	await user.click(screen.getByRole("checkbox", { name: "Results" }));
	await user.click(screen.getByRole("button", { name: "Save draft" }));

	await user.click(
		await screen.findByRole("button", { name: "Activate revision" })
	);

	expect(fakeApi.saveDraft.mock.calls[0]?.[0]).toMatchObject({
		deliveryTargetId: targetId,
		name: "Chapter 1 demo",
		productionEvidencePolicy: {
			defaultRequirement: "full_generation_package_history",
		},
		purpose: "demo",
		rightsEvidencePolicy: {
			acceptableStates: ["documented", "assertion_only"],
			requireRecordFor: ["references", "results"],
		},
	});
	expect(
		await screen.findByRole("heading", { name: "Active revision 2" })
	).toBeVisible();
	const diff = screen.getByRole("region", { name: diffHeading });
	expect(
		within(diff).getByText("Production Evidence Policy changed")
	).toBeVisible();
	expect(
		within(diff).getByText("Rights Evidence Policy changed")
	).toBeVisible();
	expect(within(diff).getByText("Context Revision unchanged")).toBeVisible();
	const history = screen.getByRole("list", { name: "Revisions" });
	expect(within(history).getAllByRole("listitem")).toHaveLength(2);
});
