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
		contextScopes: {
			list: { queryKey: () => ["context-scopes"] },
			createTheme: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => mocked.createTheme(input),
				}),
			},
			createVisualWorld: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => mocked.createVisualWorld(input),
				}),
			},
		},
		contextProposals: {
			list: { queryKey: () => ["context-proposals"] },
			create: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => mocked.createProposal(input),
				}),
			},
			review: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => mocked.reviewProposal(input),
				}),
			},
			activate: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => mocked.activateProposal(input),
				}),
			},
		},
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
				isPending={false}
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
				isProposalsPending={false}
				isScopeError={false}
				isScopePending={false}
				onCheckProposalState={async () => false}
				onNewProject={() => undefined}
				onRefreshProposals={async () => undefined}
				onRetryProposals={() => undefined}
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

test("saves a Visual World and clears its draft after saving", async () => {
	mocked.createVisualWorld.mockResolvedValue({});
	renderScopeRegistry();

	const name = screen.getByLabelText("Görsel Dünya adı");
	expect(name).toBeRequired();
	fireEvent.change(name, { target: { value: "Highlands" } });
	fireEvent.change(screen.getAllByLabelText("Açıklama")[0] as HTMLElement, {
		target: { value: "Windy cliffs." },
	});
	fireEvent.click(screen.getByRole("button", { name: "Görsel Dünya ekle" }));

	await waitFor(() =>
		expect(mocked.toastSuccess).toHaveBeenCalledWith("Görsel Dünya kaydedildi.")
	);
	expect(mocked.createVisualWorld).toHaveBeenCalledExactlyOnceWith({
		projectId,
		name: "Highlands",
		description: "Windy cliffs.",
	});
	expect(name).toHaveValue("");
	expect(screen.getAllByLabelText("Açıklama")[0]).toHaveValue("");
});

test("clears the Theme name and description but keeps the chosen Visual World", async () => {
	mocked.createTheme.mockResolvedValue({});
	renderScopeRegistry();

	const world = screen.getByLabelText("Görsel Dünya");
	expect(world).toHaveValue(worldId);
	fireEvent.change(world, { target: { value: portraitWorldId } });
	fireEvent.change(screen.getByLabelText("Tema adı"), {
		target: { value: "Dusk" },
	});
	fireEvent.change(screen.getAllByLabelText("Açıklama")[1] as HTMLElement, {
		target: { value: "Late light." },
	});
	fireEvent.click(screen.getByRole("button", { name: "Tema ekle" }));

	await waitFor(() =>
		expect(mocked.toastSuccess).toHaveBeenCalledWith("Tema kaydedildi.")
	);
	expect(mocked.createTheme).toHaveBeenCalledExactlyOnceWith({
		projectId,
		visualWorldId: portraitWorldId,
		name: "Dusk",
		description: "Late light.",
	});
	expect(screen.getByLabelText("Tema adı")).toHaveValue("");
	expect(screen.getAllByLabelText("Açıklama")[1]).toHaveValue("");
	expect(screen.getByLabelText("Görsel Dünya")).toHaveValue(portraitWorldId);
});

test("Theme creation waits for a Visual World and both forms lock on a catalog error", () => {
	const { rerender } = render(
		<QueryClientProvider client={createQueryClient()}>
			<ScopeRegistryPanel
				isError={false}
				isPending={false}
				project={project}
				scopeCatalog={{ visualWorlds: [], themes: [] }}
			/>
		</QueryClientProvider>
	);

	expect(screen.getByLabelText("Görsel Dünya")).toHaveValue("");
	expect(
		screen.getByRole("option", { name: "Önce bir Görsel Dünya ekleyin" })
	).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Tema ekle" })).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Görsel Dünya ekle" })
	).toBeEnabled();

	rerender(
		<QueryClientProvider client={createQueryClient()}>
			<ScopeRegistryPanel
				isError
				isPending={false}
				project={project}
				scopeCatalog={scopeCatalog}
			/>
		</QueryClientProvider>
	);
	expect(screen.getByRole("button", { name: "Tema ekle" })).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Görsel Dünya ekle" })
	).toBeDisabled();
});

test("choosing another project from the workspace selects that project", () => {
	const otherProject: ProjectContext = {
		...project,
		id: "project-other",
		name: "Ember Coast",
	};
	const onSelectProject = vi.fn();
	render(
		<QueryClientProvider client={createAppQueryClient()}>
			<ContextWorkspace
				isProposalsError={false}
				isProposalsPending={false}
				isScopeError={false}
				isScopePending={false}
				onCheckProposalState={async () => false}
				onNewProject={() => undefined}
				onRefreshProposals={async () => undefined}
				onRetryProposals={() => undefined}
				onSelectProject={onSelectProject}
				project={project}
				projects={[project, otherProject]}
				proposals={[]}
				scopeCatalog={scopeCatalog}
			/>
		</QueryClientProvider>
	);

	fireEvent.change(screen.getByRole("combobox", { name: "Proje" }), {
		target: { value: "project-other" },
	});
	expect(onSelectProject).toHaveBeenCalledExactlyOnceWith(otherProject);
});

test("keeps each Theme rule scope attached to the selected Visual World", () => {
	renderWorkspace();
	fireEvent.click(
		screen.getByRole("button", { name: "Kural önerisi hazırla" })
	);

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
