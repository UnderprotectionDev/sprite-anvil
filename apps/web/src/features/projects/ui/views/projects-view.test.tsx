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
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProjectsView } from "./projects-view";

const fakeStore = vi.hoisted(() => ({
	create: vi.fn(),
	projects: [] as { id: string; name: string }[],
}));

vi.mock("sonner", () => ({
	Toaster: () => null,
	toast: { dismiss: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		projects: {
			create: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeStore.create(input),
				}),
			},
			list: {
				queryOptions: () => ({
					queryKey: ["projects"],
					queryFn: async () => [...fakeStore.projects],
				}),
			},
		},
		projectContexts: { list: { queryKey: () => ["project-contexts"] } },
	},
}));

beforeEach(() => {
	fakeStore.create.mockReset();
	fakeStore.projects.length = 0;
});

afterEach(() => {
	cleanup();
});

function renderProjects() {
	const rootRoute = createRootRoute({ component: ProjectsView });
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/"] }),
		routeTree: rootRoute,
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
	fireEvent.click(
		await screen.findByRole("button", { name: "Yeni oyun projesi" })
	);
	return {
		artDirection: await screen.findByLabelText("Genel sanat yaklaşımı"),
		name: screen.getByLabelText("Oyun projesi adı"),
		submit: screen.getByRole("button", { name: "Proje oluştur" }),
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
		"Henüz bir oyun projeniz yok. İlk projenizi oluşturarak başlayın."
	);

	const { artDirection, name, submit } = await openCreateDialog();
	expect(submit).toBeDisabled();
	fireEvent.change(name, { target: { value: "   " } });
	fireEvent.change(artDirection, { target: { value: "Soft light." } });
	expect(submit).toBeDisabled();
	fireEvent.change(name, { target: { value: "  Moonlit Vale  " } });
	fireEvent.change(artDirection, { target: { value: "   " } });
	expect(submit).toBeDisabled();
	fireEvent.change(artDirection, { target: { value: " Soft light. " } });
	expect(submit).toBeEnabled();

	fireEvent.click(submit);

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Oyun projesi kaydedildi."
	);
	expect(fakeStore.create).toHaveBeenCalledExactlyOnceWith({
		name: "Moonlit Vale",
		generalArtDirection: "Soft light.",
	});
	await waitFor(() =>
		expect(screen.queryByLabelText("Oyun projesi adı")).not.toBeInTheDocument()
	);

	const reopened = await openCreateDialog();
	expect(reopened.name).toHaveValue("");
	expect(reopened.artDirection).toHaveValue("");
});

test("keeps the draft when the dialog is closed and reopened", async () => {
	renderProjects();
	const { artDirection, name } = await openCreateDialog();
	fireEvent.change(name, { target: { value: "Draft" } });
	fireEvent.change(artDirection, { target: { value: "Draft direction" } });

	fireEvent.keyDown(name, { key: "Escape" });
	await waitFor(() =>
		expect(screen.queryByLabelText("Oyun projesi adı")).not.toBeInTheDocument()
	);

	const reopened = await openCreateDialog();
	expect(reopened.name).toHaveValue("Draft");
	expect(reopened.artDirection).toHaveValue("Draft direction");
});

test("an uncertain create locks the form until the saved project is found", async () => {
	fakeStore.create.mockImplementation(
		(input: { name: string; generalArtDirection: string }) => {
			fakeStore.projects.push({ id: "project-saved", name: input.name });
			return Promise.reject(new TypeError("Load failed"));
		}
	);
	renderProjects();
	const { artDirection, name, submit } = await openCreateDialog();
	fireEvent.change(name, { target: { value: " Ember Coast " } });
	fireEvent.change(artDirection, { target: { value: "Warm dusk." } });
	fireEvent.click(submit);

	const check = await screen.findByRole("button", {
		name: "Durumu kontrol et",
	});
	expect(name).toBeDisabled();
	expect(artDirection).toBeDisabled();
	expect(submit).toBeDisabled();
	fireEvent.submit(submit.closest("form") as HTMLFormElement);
	expect(fakeStore.create).toHaveBeenCalledOnce();

	fireEvent.click(check);

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Oyun projesi kaydedildi."
	);
	await waitFor(() =>
		expect(screen.queryByLabelText("Oyun projesi adı")).not.toBeInTheDocument()
	);
	const reopened = await openCreateDialog();
	expect(reopened.name).toHaveValue("");
});

test("an uncertain create that is not found keeps the draft for review", async () => {
	fakeStore.create.mockRejectedValue(new TypeError("Load failed"));
	renderProjects();
	const { artDirection, name, submit } = await openCreateDialog();
	fireEvent.change(name, { target: { value: "Lost" } });
	fireEvent.change(artDirection, { target: { value: "Unknown." } });
	fireEvent.click(submit);

	fireEvent.click(
		await screen.findByRole("button", { name: "Durumu kontrol et" })
	);

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Proje listesi yenilendi; kayıt görünmüyor. Yeniden göndermeden önce durumu kontrol edin."
	);
	expect(name).toHaveValue("Lost");
	await waitFor(() => expect(name).toBeEnabled());
	expect(submit).toBeEnabled();
});
