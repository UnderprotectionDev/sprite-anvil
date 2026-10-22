// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProjectAccessScreen } from "./project-access-view";

const projectId = "7e7eb5e3-25e5-4661-aa3b-6805955c8d14";

const fakeStore = vi.hoisted(() => ({
	grant: vi.fn(),
	revoke: vi.fn(),
}));

vi.mock("sonner", () => ({
	Toaster: () => null,
	toast: { dismiss: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock(
	"@/features/external-visual-analysis/ui/components/external-visual-analysis-consent",
	() => ({ ExternalVisualAnalysisConsent: () => null })
);

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		projects: {
			get: {
				queryOptions: () => ({
					queryKey: ["project", projectId],
					queryFn: async () => ({ id: projectId, name: "Forest Quest" }),
				}),
			},
			access: {
				grantContextAgent: {
					mutationOptions: (options?: object) => ({
						...options,
						mutationFn: (input: unknown) => fakeStore.grant(input),
					}),
				},
				revoke: {
					mutationOptions: (options?: object) => ({
						...options,
						mutationFn: (input: unknown) => fakeStore.revoke(input),
					}),
				},
				list: {
					queryOptions: () => ({
						queryKey: ["permissions", projectId],
						queryFn: async () => [],
					}),
				},
			},
		},
	},
}));

beforeEach(() => {
	fakeStore.grant.mockReset();
	fakeStore.revoke.mockReset();
});

afterEach(() => {
	cleanup();
});

async function renderAccess() {
	const rootRoute = createRootRoute({
		component: () => <ProjectAccessScreen projectId={projectId} />,
	});
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/"] }),
		routeTree: rootRoute,
	});
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
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
	await screen.findByText("Bu projede kayıtlı Bağlam Ajanı izni yok.");
	return {
		proposals: screen.getByRole("checkbox", {
			name: "Bağlam Önerisi hazırlama",
		}),
		purpose: screen.getByLabelText("Amaç"),
		read: screen.getByRole("checkbox", { name: "Proje Bağlamı'nı okuma" }),
		submit: screen.getByRole("button", { name: "Bağlam Ajanı izni ver" }),
	};
}

test("grant stays unavailable until the purpose has three characters and a scope is chosen", async () => {
	fakeStore.grant.mockResolvedValue({});
	const { proposals, purpose, read, submit } = await renderAccess();

	expect(purpose).toHaveValue("Proje Bağlamı için öneri hazırlama");
	expect(purpose).toBeRequired();
	expect(read).toBeChecked();
	expect(proposals).toBeChecked();
	expect(submit).toBeEnabled();

	fireEvent.change(purpose, { target: { value: "  ab  " } });
	expect(submit).toBeDisabled();
	fireEvent.change(purpose, { target: { value: "  Öneri  " } });
	expect(submit).toBeEnabled();

	fireEvent.click(read);
	expect(read).not.toBeChecked();
	expect(submit).toBeEnabled();
	const user = userEvent.setup();
	proposals.focus();
	await user.keyboard(" ");
	expect(proposals).not.toBeChecked();
	expect(submit).toBeDisabled();

	fireEvent.click(proposals);
	fireEvent.click(read);
	expect(submit).toBeEnabled();
	fireEvent.click(submit);

	await waitFor(() =>
		expect(fakeStore.grant).toHaveBeenCalledExactlyOnceWith({
			projectId,
			purpose: "Öneri",
			scopes: ["context_proposals:write", "project_context:read"],
		})
	);
});

test("an uncertain grant locks the purpose and scopes", async () => {
	fakeStore.grant.mockRejectedValue(new TypeError("Load failed"));
	const { proposals, purpose, read, submit } = await renderAccess();

	fireEvent.click(submit);

	await screen.findByRole("button", { name: "Durumu kontrol et" });
	expect(purpose).toBeDisabled();
	expect(submit).toBeDisabled();
	const user = userEvent.setup();
	await user.click(read);
	expect(read).toBeChecked();
	proposals.focus();
	await user.keyboard(" ");
	expect(proposals).toBeChecked();
	fireEvent.submit(submit.closest("form") as HTMLFormElement);
	expect(fakeStore.grant).toHaveBeenCalledOnce();
});
