// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type { ProjectContext } from "@sprite-anvil/api/project-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProposalForm } from "./proposal-form";

const overrideName = /Context Override/;
const projectId = "project-lantern-vale";
const worldId = "world-gameplay";

const mocked = vi.hoisted(() => ({
	createProposal: vi.fn(),
	toastSuccess: vi.fn(),
}));

vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	const client = { contextProposals: { create: mocked.createProposal } };
	return { client, orpc: createTanstackQueryUtils(client as never) };
});

vi.mock("sonner", () => ({
	toast: { dismiss: vi.fn(), error: vi.fn(), success: mocked.toastSuccess },
}));

const project: ProjectContext = {
	id: projectId,
	name: "Lantern Vale",
	generalArtDirection: "Layered visuals.",
	createdAt: "2026-09-25T00:00:00.000Z",
	currentContextRevision: {
		id: "revision-initial",
		projectId,
		revisionNumber: 1,
		sourceProposalId: null,
		ruleContractVersion: "context-rule/1.0.0",
		isActive: true,
		rules: [
			{
				contractVersion: "context-rule/1.0.0",
				id: "palette",
				scope: { kind: "project", id: projectId },
				value: { type: "text_list", value: ["moss"] },
				source: { kind: "project_setup" },
				rationale: "Base palette.",
				createdAt: "2026-09-25T00:00:00.000Z",
				precedenceChain: [{ kind: "project", id: projectId }],
			},
		],
		createdAt: "2026-09-25T00:00:00.000Z",
	},
};

const scopeCatalog: ProjectContextScopeCatalog = {
	visualWorlds: [
		{
			id: worldId,
			projectId,
			name: "Gameplay art",
			description: "",
			createdAt: "2026-09-25T00:00:00.000Z",
		},
	],
	themes: [],
};

function renderForm(onCheckCurrentState = vi.fn(async () => false)) {
	const onRefresh = vi.fn(async () => undefined);
	render(
		<QueryClientProvider
			client={
				new QueryClient({
					defaultOptions: {
						mutations: { retry: false },
						queries: { retry: false },
					},
				})
			}
		>
			<ProposalForm
				onCheckCurrentState={onCheckCurrentState}
				onRefresh={onRefresh}
				project={project}
				scopeCatalog={scopeCatalog}
			/>
		</QueryClientProvider>
	);
	return { onCheckCurrentState, onRefresh };
}

function cards() {
	return screen
		.getAllByRole("group")
		.filter((group) => group.tagName === "FIELDSET");
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	cleanup();
});

test("submits every drafted rule change, then resets the draft after saving", async () => {
	mocked.createProposal.mockResolvedValue({});
	const { onRefresh } = renderForm();

	fireEvent.change(screen.getByLabelText("Proposal summary"), {
		target: { value: "Sadeleştirme" },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Add another rule change" })
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Add another rule change" })
	);
	expect(screen.getByText("3 changes")).toBeVisible();
	expect(cards()).toHaveLength(3);

	fireEvent.change(
		screen.getByRole("combobox", { name: "Change 1 operation" }),
		{
			target: { value: "replace" },
		}
	);
	expect(screen.getByRole("combobox", { name: "Change 1 rule" })).toHaveValue(
		"palette"
	);
	fireEvent.change(screen.getByLabelText("Change 1 rule value"), {
		target: { value: " moss \n\n stone " },
	});
	fireEvent.change(
		within(cards()[0] as HTMLElement).getByLabelText(
			"Rationale for this change"
		),
		{
			target: { value: "Daha az renk" },
		}
	);
	fireEvent.change(
		screen.getByRole("combobox", { name: "Change 1 evidence type" }),
		{
			target: { value: "observed_change" },
		}
	);
	fireEvent.change(
		within(cards()[0] as HTMLElement).getByLabelText("Evidence"),
		{
			target: { value: "Ekranda görüldü" },
		}
	);

	fireEvent.click(
		within(cards()[1] as HTMLElement).getByRole("button", {
			name: "Remove change",
		})
	);
	expect(screen.getByText("2 changes")).toBeVisible();

	fireEvent.change(screen.getByRole("combobox", { name: "Change 2 rule" }), {
		target: { value: "outline.width" },
	});
	const numberValue = screen.getByLabelText("Change 2 rule value");
	expect(numberValue).toHaveAttribute("type", "number");
	fireEvent.change(numberValue, { target: { value: "2" } });
	fireEvent.change(
		within(cards()[1] as HTMLElement).getByLabelText(
			"Rationale for this change"
		),
		{
			target: { value: "İnce kontur" },
		}
	);
	fireEvent.change(
		within(cards()[1] as HTMLElement).getByLabelText("Evidence"),
		{
			target: { value: "Karar" },
		}
	);

	fireEvent.click(
		screen.getByRole("button", { name: "Save Context Proposal" })
	);

	await waitFor(() => expect(mocked.createProposal).toHaveBeenCalledOnce());
	expect(mocked.createProposal.mock.calls[0]?.[0]).toEqual({
		projectId,
		baseContextRevisionId: "revision-initial",
		summary: "Sadeleştirme",
		changes: [
			{
				operation: "replace",
				ruleId: "palette",
				scope: { kind: "project", id: projectId },
				precedenceChain: [{ kind: "project", id: projectId }],
				rationale: "Daha az renk",
				evidence: [{ kind: "observed_change", statement: "Ekranda görüldü" }],
				supersedesRuleId: null,
				value: { type: "text_list", value: ["moss", "stone"] },
			},
			{
				operation: "add",
				ruleId: "outline.width",
				scope: { kind: "project", id: projectId },
				precedenceChain: [{ kind: "project", id: projectId }],
				rationale: "İnce kontur",
				evidence: [{ kind: "user_decision", statement: "Karar" }],
				supersedesRuleId: null,
				value: { type: "number", value: 2 },
			},
		],
	});
	await waitFor(() =>
		expect(mocked.toastSuccess).toHaveBeenCalledWith("Context Proposal saved.")
	);
	expect(onRefresh).toHaveBeenCalledOnce();
	expect(screen.getByLabelText("Proposal summary")).toHaveValue("");
	expect(screen.getByText("1 change")).toBeVisible();
	expect(screen.getByRole("combobox", { name: "Change 1 rule" })).toHaveValue(
		"perspective"
	);
	expect(
		screen.queryByRole("button", { name: "Remove change" })
	).not.toBeInTheDocument();
});

test("a Context Override checkbox supersedes the inherited rule", async () => {
	mocked.createProposal.mockResolvedValue({});
	renderForm();

	fireEvent.change(screen.getByRole("combobox", { name: "Change 1 scope" }), {
		target: { value: `visual_world:${worldId}` },
	});
	fireEvent.change(screen.getByRole("combobox", { name: "Change 1 rule" }), {
		target: { value: "palette" },
	});
	const override = screen.getByRole("checkbox", {
		name: overrideName,
	});
	expect(override).not.toBeChecked();
	const user = userEvent.setup();
	override.focus();
	await user.keyboard(" ");
	expect(override).toBeChecked();
	fireEvent.click(override);
	expect(override).not.toBeChecked();
	fireEvent.click(override);
	expect(override).toBeChecked();

	fireEvent.change(screen.getByLabelText("Proposal summary"), {
		target: { value: "Dünya paleti" },
	});
	fireEvent.change(screen.getByLabelText("Change 1 rule value"), {
		target: { value: "ember" },
	});
	fireEvent.change(screen.getByLabelText("Rationale for this change"), {
		target: { value: "Ayrı palet" },
	});
	fireEvent.change(screen.getByLabelText("Evidence"), {
		target: { value: "Karar" },
	});
	fireEvent.click(
		screen.getByRole("button", { name: "Save Context Proposal" })
	);

	await waitFor(() => expect(mocked.createProposal).toHaveBeenCalledOnce());
	expect(mocked.createProposal.mock.calls[0]?.[0].changes).toEqual([
		expect.objectContaining({
			operation: "add",
			ruleId: "palette",
			scope: { kind: "visual_world", id: worldId },
			precedenceChain: [
				{ kind: "visual_world", id: worldId },
				{ kind: "project", id: projectId },
			],
			supersedesRuleId: "palette",
			value: { type: "text_list", value: ["ember"] },
		}),
	]);
});

test("an uncertain save keeps the draft and locks saving until the state is checked", async () => {
	mocked.createProposal.mockRejectedValue(new TypeError("Load failed"));
	const { onCheckCurrentState } = renderForm();

	fireEvent.change(screen.getByLabelText("Proposal summary"), {
		target: { value: "Taslak" },
	});
	fireEvent.change(screen.getByLabelText("Change 1 rule value"), {
		target: { value: "izometrik" },
	});
	fireEvent.change(screen.getByLabelText("Rationale for this change"), {
		target: { value: "Gerekçe" },
	});
	fireEvent.change(screen.getByLabelText("Evidence"), {
		target: { value: "Karar" },
	});
	const submit = screen.getByRole("button", {
		name: "Save Context Proposal",
	});
	fireEvent.click(submit);

	await waitFor(() => expect(submit).toBeDisabled());
	expect(screen.getByLabelText("Proposal summary")).toHaveValue("Taslak");
	fireEvent.submit(submit.closest("form") as HTMLFormElement);
	expect(mocked.createProposal).toHaveBeenCalledOnce();

	fireEvent.click(screen.getByRole("button", { name: "Check status" }));
	await waitFor(() => expect(submit).toBeEnabled());
	expect(onCheckCurrentState).toHaveBeenCalledOnce();
	expect(screen.getByRole("status")).toHaveTextContent(
		"Proposal list refreshed. Check the record."
	);
	expect(screen.getByLabelText("Proposal summary")).toHaveValue("Taslak");
});
