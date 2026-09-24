// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type {
	ContextProposal,
	ContextProposalReview,
	ProjectContext,
} from "@sprite-anvil/api/project-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ContextWorkspace } from "@/features/project-context/ui/components/context-proposal-components";
import { createQueryClient as createAppQueryClient } from "@/utils/query-client";
import { ScopeRegistryPanel } from "./context-scope-registry";

const projectId = "project-lantern-vale";
const worldId = "world-gameplay";
const portraitWorldId = "world-portraits";

const mocked = vi.hoisted(() => ({
	createTheme: vi.fn(),
	createVisualWorld: vi.fn(),
	createProposal: vi.fn(),
	reviewProposal: vi.fn(),
	activateProposal: vi.fn(),
	toastError: vi.fn(),
	toastSuccess: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		contextProposals: {
			create: mocked.createProposal,
			review: mocked.reviewProposal,
			activate: mocked.activateProposal,
		},
		contextScopes: {
			createTheme: mocked.createTheme,
			createVisualWorld: mocked.createVisualWorld,
		},
	},
	orpc: {
		contextScopes: { list: { queryKey: () => ["context-scopes"] } },
		contextProposals: { list: { queryKey: () => ["context-proposals"] } },
		projectContexts: { list: { queryKey: () => ["project-contexts"] } },
	},
}));

vi.mock("sonner", () => ({
	toast: {
		dismiss: vi.fn(),
		error: mocked.toastError,
		success: mocked.toastSuccess,
	},
}));

const project: ProjectContext = {
	id: projectId,
	name: "Lantern Vale",
	generalArtDirection: "Layered visuals with separate presentation rules.",
	createdAt: "2026-09-25T00:00:00.000Z",
	currentContextRevision: {
		id: "revision-initial",
		projectId,
		revisionNumber: 0,
		sourceProposalId: null,
		ruleContractVersion: "context-rule/1.0.0",
		isActive: false,
		rules: [],
		createdAt: "2026-09-25T00:00:00.000Z",
	},
};

const scopeCatalog: ProjectContextScopeCatalog = {
	visualWorlds: [
		{
			id: worldId,
			projectId,
			name: "Gameplay art",
			description: "Low-resolution in-game art.",
			createdAt: "2026-09-25T00:00:00.000Z",
		},
		{
			id: portraitWorldId,
			projectId,
			name: "Portraits",
			description: "Painted character portraits.",
			createdAt: "2026-09-25T00:00:00.000Z",
		},
	],
	themes: [
		{
			id: "theme-gameplay-ruins",
			projectId,
			visualWorldId: worldId,
			name: "Ruins",
			description: "Moss-covered stonework.",
			createdAt: "2026-09-25T00:00:00.000Z",
		},
		{
			id: "theme-gameplay-citadel",
			projectId,
			visualWorldId: worldId,
			name: "Citadel",
			description: "A fortified mountain settlement.",
			createdAt: "2026-09-25T00:00:00.000Z",
		},
		{
			id: "theme-portrait-ruins",
			projectId,
			visualWorldId: portraitWorldId,
			name: "Ruins",
			description: "A weathered portrait palette.",
			createdAt: "2026-09-25T00:00:00.000Z",
		},
	],
};

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			mutations: { retry: false },
			queries: { retry: false },
		},
	});
}

function renderScopeRegistry() {
	return render(
		<QueryClientProvider client={createQueryClient()}>
			<ScopeRegistryPanel
				isError={false}
				isFetching={false}
				isPending={false}
				onRetry={() => undefined}
				project={project}
				scopeCatalog={scopeCatalog}
			/>
		</QueryClientProvider>
	);
}

function renderWorkspace(proposals: ContextProposal[] = []) {
	return render(
		<QueryClientProvider client={createAppQueryClient()}>
			<ContextWorkspace
				isProposalsError={false}
				isProposalsFetching={false}
				isProposalsPending={false}
				isScopeError={false}
				isScopeFetching={false}
				isScopePending={false}
				onCheckProposalState={async () => false}
				onNewProject={() => undefined}
				onRefreshProposals={async () => undefined}
				onRetryProposals={() => undefined}
				onRetryScope={() => undefined}
				onSelectProject={() => undefined}
				project={project}
				projects={[project]}
				proposals={proposals}
				scopeCatalog={scopeCatalog}
			/>
		</QueryClientProvider>
	);
}

function getWorldListItem(name: string) {
	const listItem = screen.getByText(name, { selector: "strong" }).closest("li");
	if (!listItem) {
		throw new Error(`Visual World list item not found: ${name}`);
	}
	return listItem;
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	cleanup();
});

test("shows repeated Theme names beneath their own Visual Worlds and saves to the selected world", async () => {
	mocked.createTheme.mockResolvedValue({
		id: "theme-new",
		projectId,
		visualWorldId: portraitWorldId,
		name: "Winter orchard",
		description: "",
		createdAt: "2026-09-25T00:00:00.000Z",
	});
	renderScopeRegistry();

	const gameplayWorld = getWorldListItem("Gameplay art");
	const portraitWorld = getWorldListItem("Portraits");
	expect(within(gameplayWorld).getByText("Ruins")).toBeVisible();
	expect(within(gameplayWorld).getByText("Citadel")).toBeVisible();
	expect(within(portraitWorld).getByText("Ruins")).toBeVisible();

	fireEvent.change(screen.getByLabelText("Görsel Dünya"), {
		target: { value: portraitWorldId },
	});
	fireEvent.change(screen.getByLabelText("Tema adı"), {
		target: { value: "Winter orchard" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Tema ekle" }));

	await waitFor(() =>
		expect(mocked.createTheme).toHaveBeenCalledWith({
			projectId,
			visualWorldId: portraitWorldId,
			name: "Winter orchard",
			description: "",
		})
	);
});

test("keeps each Theme rule scope attached to the selected Visual World", () => {
	renderWorkspace();

	expect(screen.getByRole("combobox", { name: "Proje" })).toHaveValue(
		projectId
	);
	const scopeSelect = screen.getByRole("combobox", {
		name: "Değişiklik 1 kapsamı",
	});
	expect(
		within(scopeSelect).getByRole("option", {
			name: "Tema · Gameplay art / Ruins",
		})
	).toBeInTheDocument();
	expect(
		within(scopeSelect).getByRole("option", {
			name: "Tema · Portraits / Ruins",
		})
	).toBeInTheDocument();

	fireEvent.change(scopeSelect, {
		target: { value: "theme:theme-portrait-ruins" },
	});
	expect(
		screen.getByText(
			"Öncelik: Tema · Portraits / Ruins → Görsel Dünya · Portraits → Proje · Lantern Vale"
		)
	).toBeVisible();
});

test("reports a failed post-activation review as a read failure after saving", async () => {
	const proposal: ContextProposal = {
		id: "86407f45-5948-4874-9a36-27bb6c8531f7",
		projectId,
		baseContextRevisionId: project.currentContextRevision.id,
		contractVersion: "context-agent/1.0.0",
		ruleContractVersion: "context-rule/1.0.0",
		summary: "Use the gameplay palette",
		source: {
			kind: "structured_control",
			controlId: "context-proposal-form",
			controlVersion: "1.0.0",
		},
		changes: [],
		validation: {
			isValid: true,
			checkedAt: "2026-09-25T00:00:00.000Z",
			conflicts: [],
		},
		activationAllowed: false,
		createdAt: "2026-09-25T00:00:00.000Z",
	};
	const review: ContextProposalReview = {
		proposalId: proposal.id,
		baseContextRevisionId: project.currentContextRevision.id,
		baseRevisionNumber: 0,
		currentRevisionId: project.currentContextRevision.id,
		currentRevisionNumber: 0,
		targetRevisionNumber: 1,
		activatedRevisionNumber: null,
		isRebased: false,
		activationAllowed: true,
		checkedAt: "2026-09-25T00:00:00.000Z",
		conflicts: [],
		candidateRules: [],
		contextCopy: "{}",
	};
	mocked.reviewProposal
		.mockResolvedValueOnce(review)
		.mockRejectedValueOnce(new TypeError("Load failed"));
	mocked.activateProposal.mockResolvedValue({});
	renderWorkspace([proposal]);

	fireEvent.click(screen.getByRole("button", { name: "Öneriyi incele" }));
	fireEvent.click(
		await screen.findByRole("button", { name: "R1 sürümünü etkinleştir" })
	);

	await waitFor(() => expect(mocked.reviewProposal).toHaveBeenCalledTimes(2));
	expect(mocked.toastSuccess).toHaveBeenCalledWith(
		"Etkin Bağlam Sürümü oluşturuldu."
	);
	expect(mocked.toastError).toHaveBeenCalledWith(
		"Data could not be loaded.",
		expect.anything()
	);
});
