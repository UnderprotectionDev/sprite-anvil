// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ProductionExperimentsView } from "./production-experiments-view";

const f = vi.hoisted(() => ({
	project: "11111111-1111-4111-8111-111111111111",
	record: "22222222-2222-4222-8222-222222222222",
	pkg: "33333333-3333-4333-8333-333333333333",
	version: "44444444-4444-4444-8444-444444444444",
	experiment: "55555555-5555-4555-8555-555555555555",
	trial: "66666666-6666-4666-8666-666666666666",
	revision: "77777777-7777-4777-8777-777777777777",
	create: vi.fn(),
	conclude: vi.fn(),
	transfer: vi.fn(),
	concluded: false,
	scoped: false,
	familyScoped: false,
}));
vi.mock("@/utils/orpc", () => {
	const query = (key: string, fn: () => unknown) => ({
		queryOptions: () => ({ queryKey: [key], queryFn: async () => fn() }),
	});
	return {
		orpc: {
			assetRecords: {
				list: query("records", () => [
					{
						id: f.record,
						name: "Hero",
						visualWorldId: f.scoped ? "world-1" : null,
					},
					...(f.scoped
						? [{ id: "other", name: "Tree", visualWorldId: null }]
						: []),
				]),
			},
			generationPackages: {
				list: query("packages", () => [
					{ id: f.pkg, targetTask: "Sprite", createdAt: "today" },
				]),
			},
			assetVersions: {
				list: query("versions", () => ({
					assetVersions: [
						{
							id: f.version,
							assetRecordId: f.record,
							versionNumber: 1,
							reviewDisposition: "pending",
							productionEvidence: {
								manualImportEvidence: { generationPackageId: f.pkg },
							},
						},
					],
				})),
			},
			projectContexts: {
				list: query("projects", () => [
					{ id: f.project, currentContextRevision: { id: f.revision } },
				]),
			},
			contextScopes: {
				list: query("scopes", () => ({
					themes: [],
					visualWorlds: f.scoped ? [{ id: "world-1", name: "World" }] : [],
					assetFamilies: f.familyScoped
						? [
								{
									id: "family-1",
									projectId: f.project,
									visualWorldId: "world-1",
								},
							]
						: [],
					assetRecordFamilies: f.familyScoped
						? [{ assetRecordId: f.record, assetFamilyId: "family-1" }]
						: [],
				})),
			},
			productionExperiments: {
				list: query("experiments", () => [
					{ id: f.experiment, title: "Comparison" },
				]),
				get: query("detail", () => ({
					id: f.experiment,
					assetRecordId: f.record,
					title: "Comparison",
					trials: [
						{
							id: f.trial,
							label: "First",
							generationPackageId: f.pkg,
							candidateVersion: {
								versionNumber: 1,
								reviewDisposition: "pending",
							},
						},
					],
					comparison: { statement: "Inputs differ", inputs: [] },
					conclusion: f.concluded
						? { outcome: "inconclusive", note: null }
						: null,
				})),
				create: { mutationOptions: () => ({ mutationFn: f.create }) },
				conclude: { mutationOptions: () => ({ mutationFn: f.conclude }) },
				transferLearning: {
					mutationOptions: () => ({ mutationFn: f.transfer }),
				},
			},
		},
	};
});
const client = new QueryClient({
	defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
afterEach(() => {
	cleanup();
	client.clear();
	vi.clearAllMocks();
	f.concluded = false;
	f.scoped = false;
	f.familyScoped = false;
});
function setup() {
	const user = userEvent.setup();
	render(
		<QueryClientProvider client={client}>
			<ProductionExperimentsView projectId={f.project} />
		</QueryClientProvider>
	);
	return user;
}
async function openExperiment(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole("button", { name: "Hero" }));
	await user.click(await screen.findByRole("button", { name: "Comparison" }));
	await screen.findByText("Inputs differ");
}

test("creates two trials from selected records", async () => {
	const user = setup();
	f.create.mockResolvedValue({ id: f.experiment });
	await user.click(await screen.findByRole("button", { name: "Hero" }));
	await user.click(screen.getByRole("button", { name: "Create experiment" }));
	expect(
		await screen.findByText("Complete the title and each trial.")
	).toBeInTheDocument();
	expect(f.create).not.toHaveBeenCalled();
	await user.type(screen.getByLabelText("Title"), "Comparison");
	for (const [i, label] of [
		[1, "First"],
		[2, "Second"],
	] as const) {
		// biome-ignore lint/performance/noAwaitInLoops: Sequential user interaction.
		await user.type(screen.getByLabelText(`Trial ${i} label`), label);
		await user.selectOptions(
			screen.getByLabelText(`Trial ${i} Generation Package`),
			f.pkg
		);
		await waitFor(() =>
			expect(
				screen.getByLabelText(`Trial ${i} Candidate Version`)
			).toHaveTextContent("Version 1")
		);
		await user.selectOptions(
			screen.getByLabelText(`Trial ${i} Candidate Version`),
			f.version
		);
	}
	await user.click(screen.getByRole("button", { name: "Create experiment" }));
	await waitFor(() =>
		expect(f.create).toHaveBeenCalledWith(
			{
				projectId: f.project,
				assetRecordId: f.record,
				title: "Comparison",
				trials: [
					{
						label: "First",
						generationPackageId: f.pkg,
						assetVersionId: f.version,
					},
					{
						label: "Second",
						generationPackageId: f.pkg,
						assetVersionId: f.version,
					},
				],
			},
			expect.anything()
		)
	);
});

test.each([
	["Select First", "selection_made"],
	["inconclusive", "inconclusive"],
] as const)("concludes using %s", async (button, outcome) => {
	const user = setup();
	f.conclude.mockResolvedValue({});
	await openExperiment(user);
	expect(
		screen.getByText("Selection does not approve a Candidate Version.")
	).toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: button }));
	await waitFor(() =>
		expect(f.conclude).toHaveBeenCalledWith(
			{
				projectId: f.project,
				experimentId: f.experiment,
				outcome,
				...(outcome === "selection_made" ? { selectedTrialId: f.trial } : {}),
			},
			expect.anything()
		)
	);
});

test("transfers learning as an inactive Context Proposal", async () => {
	f.concluded = true;
	f.transfer.mockResolvedValue({});
	const user = setup();
	await openExperiment(user);
	for (const [label, value] of [
		["Summary", "Learned"],
		["Learning comment", "Prefer clear edges"],
		["Rule ID", "sprite.edges"],
		["Rule value", "Clear edges"],
		["Rationale", "Readability"],
	] as const) {
		// biome-ignore lint/performance/noAwaitInLoops: Sequential user interaction.
		await user.type(screen.getByLabelText(label), value);
	}
	await user.click(
		screen.getByRole("button", { name: "Create Context Proposal" })
	);
	expect(
		await screen.findByText("Context Proposal created. It is not active.")
	).toBeInTheDocument();
	expect(f.transfer).toHaveBeenCalledWith(
		{
			projectId: f.project,
			experimentId: f.experiment,
			baseContextRevisionId: f.revision,
			summary: "Learned",
			comment: "Prefer clear edges",
			widenScope: false,
			changes: [
				{
					operation: "add",
					ruleId: "sprite.edges",
					scope: { kind: "project", id: f.project },
					value: { type: "text", value: "Clear edges" },
					rationale: "Readability",
					evidence: [
						{ kind: "user_decision", statement: "Prefer clear edges" },
					],
				},
			],
		},
		expect.anything()
	);
});

test("can propose a numeric replacement to an existing Context Rule", async () => {
	f.concluded = true;
	f.transfer.mockResolvedValue({});
	const user = setup();
	await openExperiment(user);
	await user.selectOptions(screen.getByLabelText("Rule change"), "replace");
	await user.selectOptions(screen.getByLabelText("Rule value type"), "number");
	for (const [label, value] of [
		["Summary", "Adjust outline"],
		["Learning comment", "Thicker is clearer"],
		["Rule ID", "outline.width"],
		["Rule value", "2"],
		["Rationale", "Legibility"],
	] as const) {
		// biome-ignore lint/performance/noAwaitInLoops: User enters each field in order.
		await user.type(screen.getByLabelText(label), value);
	}
	await user.click(
		screen.getByRole("button", { name: "Create Context Proposal" })
	);
	await waitFor(() =>
		expect(f.transfer).toHaveBeenCalledWith(
			expect.objectContaining({
				changes: [
					expect.objectContaining({
						operation: "replace",
						ruleId: "outline.width",
						value: { type: "number", value: 2 },
					}),
				],
			}),
			expect.anything()
		)
	);
});

test("wider scope explicitly shows affected records and transfers only when selected", async () => {
	f.scoped = true;
	f.concluded = true;
	f.transfer.mockResolvedValue({});
	const user = setup();
	await openExperiment(user);
	await user.selectOptions(screen.getByLabelText("Proposal scope"), "1");
	expect(screen.getByText("Tree", { selector: "li" })).toBeInTheDocument();
	for (const [label, value] of [
		["Summary", "Apply learning"],
		["Learning comment", "Clearer"],
		["Rule ID", "palette"],
		["Rule value", "Red"],
		["Rationale", "Readability"],
	] as const) {
		// biome-ignore lint/performance/noAwaitInLoops: User enters each field in order.
		await user.type(screen.getByLabelText(label), value);
	}
	await user.click(
		screen.getByRole("button", { name: "Create Context Proposal" })
	);
	await waitFor(() =>
		expect(f.transfer).toHaveBeenCalledWith(
			expect.objectContaining({
				widenScope: true,
				changes: [
					expect.objectContaining({
						scope: { kind: "project", id: f.project },
					}),
				],
			}),
			expect.anything()
		)
	);
});

test("removes an existing rule without inventing a value", async () => {
	f.concluded = true;
	f.transfer.mockResolvedValue({});
	const user = setup();
	await openExperiment(user);
	await user.selectOptions(screen.getByLabelText("Rule change"), "remove");
	expect(screen.queryByLabelText("Rule value")).not.toBeInTheDocument();
	for (const [label, value] of [
		["Summary", "Remove rule"],
		["Learning comment", "No longer needed"],
		["Rule ID", "outline"],
		["Rationale", "Experiment"],
	] as const) {
		// biome-ignore lint/performance/noAwaitInLoops: User enters each field in order.
		await user.type(screen.getByLabelText(label), value);
	}
	await user.click(
		screen.getByRole("button", { name: "Create Context Proposal" })
	);
	await waitFor(() =>
		expect(f.transfer).toHaveBeenCalledWith(
			expect.objectContaining({
				changes: [expect.not.objectContaining({ value: expect.anything() })],
			}),
			expect.anything()
		)
	);
});

test("uses the registered Asset Family as the narrowest learning scope", async () => {
	f.scoped = true;
	f.familyScoped = true;
	f.concluded = true;
	f.transfer.mockResolvedValue({});
	const user = setup();
	await openExperiment(user);
	expect(screen.getByLabelText("Proposal scope")).toHaveValue("0");
	expect(
		screen.getByRole("option", { name: "asset_family · family-1 (narrowest)" })
	).toBeInTheDocument();
	for (const [label, value] of [
		["Summary", "Family learning"],
		["Learning comment", "Clearer"],
		["Rule ID", "outline"],
		["Rule value", "Dark"],
		["Rationale", "Readability"],
	] as const) {
		// biome-ignore lint/performance/noAwaitInLoops: User enters each field in order.
		await user.type(screen.getByLabelText(label), value);
	}
	await user.click(
		screen.getByRole("button", { name: "Create Context Proposal" })
	);
	await waitFor(() =>
		expect(f.transfer).toHaveBeenCalledWith(
			expect.objectContaining({
				widenScope: false,
				changes: [
					expect.objectContaining({
						scope: { kind: "asset_family", id: "family-1" },
					}),
				],
			}),
			expect.anything()
		)
	);
});
