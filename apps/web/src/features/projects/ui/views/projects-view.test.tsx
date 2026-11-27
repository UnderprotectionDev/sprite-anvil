// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
	useParams,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProjectDetailsView } from "./project-details-view";
import { ProjectsView } from "./projects-view";

const fakeStore = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	projects: [] as {
		id: string;
		name: string;
		previewAssetVersionId?: string | null;
		generalArtDirection?: string;
	}[],
}));

vi.mock("@/env", () => ({
	ENV: { VITE_SERVER_URL: "https://api.example.test" },
}));

vi.mock("sonner", () => ({
	Toaster: () => null,
	toast: { dismiss: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		projects: {
			update: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeStore.update(input),
				}),
			},
			create: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeStore.create(input),
				}),
			},
			list: {
				queryKey: () => ["projects"],
				queryOptions: () => ({
					queryKey: ["projects"],
					queryFn: async () => [...fakeStore.projects],
				}),
			},
		},
		projectContexts: {
			list: {
				queryKey: () => ["project-contexts"],
				queryOptions: () => ({
					queryKey: ["project-contexts"],
					queryFn: async () =>
						fakeStore.projects.map((project) => ({
							...project,
							generalArtDirection: "Soft light.",
						})),
				}),
			},
		},
	},
}));

beforeEach(() => {
	fakeStore.create.mockReset();
	fakeStore.update.mockReset();
	fakeStore.projects.length = 0;
});

afterEach(() => {
	cleanup();
});

function renderProjects() {
	const rootRoute = createRootRoute({ component: Outlet });
	const projectsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: ProjectsView,
	});
	const detailsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/projects/$projectId/details",
		component: () => (
			<ProjectDetailsView
				projectId={useParams({ strict: false }).projectId ?? ""}
			/>
		),
	});
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/"] }),
		routeTree: rootRoute.addChildren([projectsRoute, detailsRoute]),
	});
	const queryClient = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
}

async function openCreateDialog() {
	fireEvent.click(await screen.findByRole("button", { name: "New project" }));
	return {
		artDirection: await screen.findByLabelText("General art direction"),
		name: screen.getByLabelText("Game project name"),
		submit: screen.getByRole("button", { name: "Create project" }),
	};
}

test("creates a project from trimmed fields and closes the dialog", async () => {
	fakeStore.create.mockImplementation(
		(input: { name: string; generalArtDirection: string }) => {
			const project = { id: "project-1", name: input.name };
			fakeStore.projects.push(project);
			return Promise.resolve(project);
		}
	);
	renderProjects();
	await screen.findByText(
		"Start one with New project, or load an earlier one from Project Archive."
	);

	const { artDirection, name, submit } = await openCreateDialog();
	expect(submit).toBeDisabled();
	fireEvent.change(name, { target: { value: "   " } });
	fireEvent.change(artDirection, { target: { value: "Soft light." } });
	expect(submit).toBeDisabled();
	fireEvent.change(name, { target: { value: "  Moonlit Vale  " } });
	fireEvent.change(artDirection, { target: { value: "   " } });
	expect(submit).toBeEnabled();
	fireEvent.change(artDirection, { target: { value: " Soft light. " } });
	expect(submit).toBeEnabled();

	fireEvent.click(submit);

	expect(await screen.findByText("Game project saved.")).toBeVisible();
	expect(fakeStore.create).toHaveBeenCalledExactlyOnceWith({
		name: "Moonlit Vale",
		generalArtDirection: "Soft light.",
		requestId: expect.any(String),
	});
	await waitFor(() =>
		expect(screen.queryByLabelText("Game project name")).not.toBeInTheDocument()
	);

	const reopened = await openCreateDialog();
	expect(reopened.name).toHaveValue("");
	expect(reopened.artDirection).toHaveValue("");
});

test("blocks project data outside the shared RPC input limits", async () => {
	renderProjects();
	const { artDirection, name, submit } = await openCreateDialog();
	fireEvent.change(name, { target: { value: "Moonlit Vale" } });
	fireEvent.change(artDirection, { target: { value: "a".repeat(1001) } });
	expect(submit).toBeDisabled();
	expect(fakeStore.create).not.toHaveBeenCalled();
});

test("keeps the draft when the dialog is closed and reopened", async () => {
	renderProjects();
	const { artDirection, name } = await openCreateDialog();
	fireEvent.change(name, { target: { value: "Draft" } });
	fireEvent.change(artDirection, { target: { value: "Draft direction" } });

	fireEvent.keyDown(name, { key: "Escape" });
	await waitFor(() =>
		expect(screen.queryByLabelText("Game project name")).not.toBeInTheDocument()
	);

	const reopened = await openCreateDialog();
	expect(reopened.name).toHaveValue("Draft");
	expect(reopened.artDirection).toHaveValue("Draft direction");
});

test("an uncertain create locks the form until the saved project is found", async () => {
	fakeStore.create.mockImplementation(
		(input: {
			name: string;
			generalArtDirection: string;
			requestId: string;
		}) => {
			fakeStore.projects.push({ id: input.requestId, name: input.name });
			return Promise.reject(new TypeError("Load failed"));
		}
	);
	renderProjects();
	const { artDirection, name, submit } = await openCreateDialog();
	fireEvent.change(name, { target: { value: " Ember Coast " } });
	fireEvent.change(artDirection, { target: { value: "Warm dusk." } });
	fireEvent.click(submit);

	const check = await screen.findByRole("button", {
		name: "Check status",
	});
	expect(name).toBeDisabled();
	expect(artDirection).toBeDisabled();
	expect(submit).toBeDisabled();
	fireEvent.submit(submit.closest("form") as HTMLFormElement);
	expect(fakeStore.create).toHaveBeenCalledOnce();

	fireEvent.click(check);

	expect(await screen.findByText("Game project saved.")).toBeVisible();
	await waitFor(() =>
		expect(screen.queryByLabelText("Game project name")).not.toBeInTheDocument()
	);
	const reopened = await openCreateDialog();
	expect(reopened.name).toHaveValue("");
});

test("an uncertain create never adopts a different project with the same name", async () => {
	fakeStore.create.mockImplementation((input: { name: string }) => {
		fakeStore.projects.push({ id: "unrelated-project", name: input.name });
		return Promise.reject(new TypeError("Load failed"));
	});
	renderProjects();
	const { artDirection, name, submit } = await openCreateDialog();
	fireEvent.change(name, { target: { value: "Lost" } });
	fireEvent.change(artDirection, { target: { value: "Unknown." } });
	fireEvent.click(submit);

	fireEvent.click(await screen.findByRole("button", { name: "Check status" }));

	expect(
		await screen.findByText(
			"Project list refreshed; the record is not visible. Check the status before resubmitting."
		)
	).toBeVisible();
	expect(name).toHaveValue("Lost");
	await waitFor(() => expect(name).toBeEnabled());
	expect(submit).toBeDisabled();
	fireEvent.change(name, { target: { value: "New draft" } });
	expect(submit).toBeEnabled();
});

test("switches the project presentation without changing the available projects", async () => {
	fakeStore.projects.push(
		{ id: "project-1", name: "Night Market" },
		{ id: "project-2", name: "Ember Isles" }
	);
	renderProjects();
	const grid = await screen.findByRole("button", { name: "Grid view" });
	const list = screen.getByRole("button", { name: "List view" });
	expect(grid).toHaveAttribute("aria-pressed", "true");
	fireEvent.click(list);
	expect(list).toHaveAttribute("aria-pressed", "true");
	expect(screen.getByText("Night Market")).toBeVisible();
	expect(screen.getByText("Ember Isles")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Ember Isles" }));
	expect(screen.getByRole("heading", { name: "Ember Isles" })).toHaveFocus();
	expect(
		screen.getByRole("link", { name: "Ember Isles open project" })
	).toBeVisible();
});

test("shows actual project metadata in Details", async () => {
	fakeStore.projects.push({ id: "project-1", name: "Night Market" });
	renderProjects();
	fireEvent.click(await screen.findByRole("link", { name: "Details" }));
	expect(await screen.findByRole("heading", { name: "Details" })).toBeVisible();
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	expect(await screen.findByLabelText("General art direction")).toHaveValue(
		"Soft light."
	);
});

test("renders each project's own persisted preview in grid and list", async () => {
	fakeStore.projects.push(
		{
			id: "project-1",
			name: "Night Market",
			previewAssetVersionId: "version-1",
		},
		{ id: "project-2", name: "Ember Isles", previewAssetVersionId: "version-2" }
	);
	renderProjects();
	const cover = await screen.findByAltText("Night Market project preview");
	expect(cover).toHaveAttribute(
		"src",
		expect.stringContaining(
			"/projects/project-1/asset-versions/version-1/preview"
		)
	);
	expect(screen.getByAltText("Ember Isles project preview")).toHaveAttribute(
		"src",
		expect.stringContaining(
			"/projects/project-2/asset-versions/version-2/preview"
		)
	);
	fireEvent.click(screen.getByRole("button", { name: "List view" }));
	expect(screen.getByAltText("Ember Isles project preview")).toBeVisible();
});

test("copies the selected project's art approach into the new project draft", async () => {
	fakeStore.projects.push({
		id: "project-1",
		name: "Night Market",
		generalArtDirection: "Lantern-lit stalls",
	});
	renderProjects();
	const { artDirection } = await openCreateDialog();
	fireEvent.click(
		screen.getByRole("button", { name: "Copy approach from Night Market" })
	);
	expect(artDirection).toHaveValue("Lantern-lit stalls");
});

test("saves changed project metadata through the authorized mutation", async () => {
	fakeStore.projects.push({ id: "project-1", name: "Night Market" });
	fakeStore.update.mockResolvedValue({ id: "project-1", name: "Updated" });
	renderProjects();
	fireEvent.click(await screen.findByRole("link", { name: "Details" }));
	fireEvent.change(await screen.findByLabelText("Project name"), {
		target: { value: "Updated" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	await waitFor(() =>
		expect(fakeStore.update).toHaveBeenCalledWith({
			projectId: "project-1",
			name: "Updated",
			generalArtDirection: "Soft light.",
		})
	);
});

test("rejects duplicate project names and separates selecting a look from copying approach", async () => {
	fakeStore.projects.push(
		{
			id: "project-1",
			name: "Night Market",
			generalArtDirection: "Lantern-lit stalls",
		},
		{
			id: "project-2",
			name: "Ember Isles",
			generalArtDirection: "Volcanic islands",
		}
	);
	renderProjects();
	const { name, artDirection, submit } = await openCreateDialog();
	fireEvent.change(name, { target: { value: " night market " } });
	expect(submit).toBeDisabled();
	expect(
		screen.getByText("A project with this name already exists.")
	).toBeVisible();
	fireEvent.change(name, { target: { value: "Moonlit Harbor" } });
	expect(submit).toBeEnabled();
	fireEvent.click(
		screen.getByRole("button", { name: "Select Ember Isles look" })
	);
	expect(artDirection).toHaveValue("");
	fireEvent.click(
		screen.getByRole("button", { name: "Copy approach from Ember Isles" })
	);
	expect(artDirection).toHaveValue("Volcanic islands");
});

test("shows the actual name conflict instead of a connection error in Details", async () => {
	fakeStore.projects.push({ id: "project-1", name: "Moonlit Vale" });
	fakeStore.update.mockRejectedValue(
		Object.assign(new Error("A project with this name already exists."), {
			code: "CONFLICT",
			status: 409,
		})
	);
	renderProjects();
	fireEvent.click(await screen.findByRole("link", { name: "Details" }));
	fireEvent.change(await screen.findByLabelText("Project name"), {
		target: { value: "Night Market" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"A project with this name already exists."
	);
	expect(screen.getByLabelText("Project name")).toHaveValue("Night Market");
});
