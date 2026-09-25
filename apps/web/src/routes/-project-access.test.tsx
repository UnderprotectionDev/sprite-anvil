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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProjectAccessScreen } from "@/features/projects/ui/views/project-access-view";
import { createQueryClient } from "@/utils/query-client";
import { routeTree } from "../routeTree.gen";

const projectId = "7e7eb5e3-25e5-4661-aa3b-6805955c8d14";
const errorToast = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
	Toaster: () => null,
	toast: { dismiss: vi.fn(), error: errorToast },
}));

const fakeStore = vi.hoisted(() => ({
	analysisPermissions: [] as {
		category: "identity" | "theme" | "style";
		createdAt: string;
		id: string;
		projectId: string;
		purpose: string;
		revokedAt: string | null;
	}[],
	permissions: [] as {
		createdAt: string;
		id: string;
		principal: "context_agent";
		projectId: string;
		purpose: string;
		revokedAt: string | null;
		scopes: string[];
	}[],
	failedPermissionReads: 0,
	nextGrantError: null as Error | null,
	nextPermissionRead: null as null | (() => Promise<unknown[]>),
}));

vi.mock("@/utils/orpc", () => ({
	link: {},
	client: {
		projects: {
			access: {
				grantExternalVisualAnalysis(input: {
					category: "identity" | "theme" | "style";
					projectId: string;
				}) {
					const purposeByCategory = {
						identity: "Görsel kimliğini analiz etme",
						theme: "Görsel temasını analiz etme",
						style: "Görsel stilini analiz etme",
					};
					const permission = {
						category: input.category,
						createdAt: new Date().toISOString(),
						id: `analysis-permission-${fakeStore.analysisPermissions.length + 1}`,
						projectId: input.projectId,
						purpose: purposeByCategory[input.category],
						revokedAt: null,
					};
					fakeStore.analysisPermissions.unshift(permission);
					return Promise.resolve(permission);
				},
				grantContextAgent(input: {
					projectId: string;
					purpose: string;
					scopes: string[];
				}) {
					const permission = {
						createdAt: new Date().toISOString(),
						id: "permission-1",
						principal: "context_agent" as const,
						projectId: input.projectId,
						purpose: input.purpose,
						revokedAt: null,
						scopes: input.scopes,
					};
					fakeStore.permissions.unshift(permission);
					if (fakeStore.nextGrantError) {
						const error = fakeStore.nextGrantError;
						fakeStore.nextGrantError = null;
						throw error;
					}
					return Promise.resolve(permission);
				},
				revoke(input: { permissionId: string }) {
					const permission = fakeStore.permissions.find(
						(candidate) => candidate.id === input.permissionId
					);
					if (permission) {
						permission.revokedAt = new Date().toISOString();
					}
					return Promise.resolve({ revoked: true });
				},
				revokeExternalVisualAnalysis(input: { permissionId: string }) {
					const permission = fakeStore.analysisPermissions.find(
						(candidate) => candidate.id === input.permissionId
					);
					if (permission) {
						permission.revokedAt = new Date().toISOString();
					}
					return Promise.resolve({ revoked: true });
				},
			},
		},
	},
	orpc: {
		projects: {
			list: {
				queryOptions: () => ({
					queryKey: ["projects"],
					queryFn: async () => [{ id: projectId, name: "Forest Quest" }],
				}),
			},
			get: {
				queryOptions: () => ({
					queryKey: ["project", projectId],
					queryFn: async () => ({ id: projectId, name: "Forest Quest" }),
				}),
			},
			access: {
				listExternalVisualAnalysis: {
					queryOptions: () => ({
						queryKey: ["analysis-permissions", projectId],
						queryFn: async () => fakeStore.analysisPermissions,
					}),
				},
				list: {
					queryOptions: () => ({
						queryKey: ["permissions", projectId],
						queryFn: () => {
							const { nextPermissionRead } = fakeStore;
							if (fakeStore.failedPermissionReads > 0) {
								fakeStore.failedPermissionReads -= 1;
								throw new TypeError("Failed to fetch");
							}
							if (nextPermissionRead) {
								fakeStore.nextPermissionRead = null;
								return nextPermissionRead();
							}
							return fakeStore.permissions;
						},
					}),
				},
			},
		},
	},
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		getSession: async () => ({
			data: {
				user: {
					id: "user-1",
					name: "Test Player",
					email: "player@example.com",
				},
				session: { id: "session-1" },
			},
		}),
		signOut: vi.fn(),
		useSession: () => ({
			data: {
				user: {
					id: "user-1",
					name: "Test Player",
					email: "player@example.com",
				},
			},
			isPending: false,
		}),
	},
}));

vi.mock("@orpc/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@orpc/client")>()),
	createORPCClient: () => ({}),
}));

vi.mock("@orpc/tanstack-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@orpc/tanstack-query")>()),
	createTanstackQueryUtils: () => ({}),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

beforeEach(() => {
	errorToast.mockClear();
	fakeStore.permissions.length = 0;
	fakeStore.analysisPermissions.length = 0;
	fakeStore.failedPermissionReads = 0;
	fakeStore.nextGrantError = null;
	fakeStore.nextPermissionRead = null;
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockImplementation((media: string) => ({
			matches: false,
			media,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}))
	);
	vi.spyOn(window, "scrollTo").mockReturnValue(undefined);
});

test("a user can grant, refetch, and revoke purpose-scoped Context Agent access", async () => {
	const rootRoute = createRootRoute({ component: () => <Outlet /> });
	const projectsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/projects",
		component: () => <p>Oyun projeleri</p>,
	});
	const accessRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/access",
		component: () => <ProjectAccessScreen projectId={projectId} />,
	});
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/access"] }),
		routeTree: rootRoute.addChildren([projectsRoute, accessRoute]),
	});
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);

	expect(
		await screen.findByRole("heading", { name: "Forest Quest" })
	).toBeVisible();
	expect(screen.getByText("Sağlayıcı seçilmedi")).toBeVisible();
	expect(screen.getAllByText("Kullanılamıyor")).toHaveLength(4);

	fireEvent.click(
		screen.getByRole("button", { name: "Bağlam Ajanı izni ver" })
	);

	await waitFor(() =>
		expect(screen.getByText("Bağlam Ajanı izni kaydedildi.")).toBeVisible()
	);
	expect(screen.getByText("Etkin")).toBeVisible();
	expect(fakeStore.permissions[0]).toMatchObject({
		purpose: "Proje Bağlamı için öneri hazırlama",
		scopes: ["project_context:read", "context_proposals:write"],
	});

	fireEvent.click(
		screen.getByRole("button", {
			name: "Proje Bağlamı için öneri hazırlama iznini geri al",
		})
	);

	await waitFor(() =>
		expect(screen.getByRole("status")).toHaveTextContent(
			"İzin geri alındı. Yeni erişim istekleri reddedilir."
		)
	);
	expect(screen.getByText("Geri alındı")).toBeVisible();

	const identityConsent = await screen.findByRole("group", { name: "Kimlik" });
	expect(within(identityConsent).getByText("Kullanılamıyor")).toBeVisible();
	expect(screen.getByText("Sağlayıcı: seçilmedi")).toBeVisible();
	expect(screen.getByText("Saklama koşulları: bilinmiyor")).toBeVisible();
	for (const category of ["Kimlik", "Tema", "Stil"]) {
		const consent = screen.getByRole("group", { name: category });
		expect(
			within(consent).getByRole("button", {
				name: `${category} analizi için izin ver`,
			})
		).toBeDisabled();
	}
	expect(fakeStore.analysisPermissions).toEqual([]);
});

test("keeps a granted permission form locked until the refreshed state arrives", async () => {
	const rootRoute = createRootRoute({ component: () => <Outlet /> });
	const accessRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/access",
		component: () => <ProjectAccessScreen projectId={projectId} />,
	});
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/access"] }),
		routeTree: rootRoute.addChildren([accessRoute]),
	});
	const queryClient = createQueryClient();
	let startHeldRead: () => void = () => undefined;
	let finishHeldRead: (permissions: typeof fakeStore.permissions) => void =
		() => undefined;
	const heldReadStarted = new Promise<void>((resolve) => {
		startHeldRead = resolve;
	});
	const heldRead = new Promise<typeof fakeStore.permissions>((resolve) => {
		finishHeldRead = resolve;
	});

	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);

	await screen.findByRole("heading", { name: "Forest Quest" });
	await screen.findByText("Bu projede kayıtlı Bağlam Ajanı izni yok.");
	fakeStore.nextPermissionRead = () => {
		startHeldRead();
		return heldRead;
	};

	const grantButton = screen.getByRole("button", {
		name: "Bağlam Ajanı izni ver",
	});
	fireEvent.click(grantButton);
	await screen.findByText("Bağlam Ajanı izni kaydedildi.");
	await heldReadStarted;
	expect(grantButton).toBeDisabled();

	finishHeldRead(fakeStore.permissions);
	await waitFor(() => expect(grantButton).toBeEnabled());
});

test("keeps permission grants disabled after a failed refresh until Retry succeeds", async () => {
	const rootRoute = createRootRoute({ component: () => <Outlet /> });
	const accessRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/access",
		component: () => <ProjectAccessScreen projectId={projectId} />,
	});
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/access"] }),
		routeTree: rootRoute.addChildren([accessRoute]),
	});
	const queryClient = createQueryClient();
	queryClient.setQueryDefaults(["permissions", projectId], { retry: false });
	let startHeldRead: () => void = () => undefined;
	const heldReadStarted = new Promise<void>((resolve) => {
		startHeldRead = resolve;
	});

	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);

	await screen.findByRole("heading", { name: "Forest Quest" });
	await screen.findByText("Bu projede kayıtlı Bağlam Ajanı izni yok.");
	fakeStore.nextPermissionRead = () => {
		startHeldRead();
		return Promise.reject(new TypeError("Failed to fetch"));
	};

	const grantButton = screen.getByRole("button", {
		name: "Bağlam Ajanı izni ver",
	});
	fireEvent.click(grantButton);
	await screen.findByText("Bağlam Ajanı izni kaydedildi.");
	await heldReadStarted;
	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	expect(grantButton).toBeDisabled();
	expect(grantButton).toHaveTextContent("Bağlam Ajanı izni ver");

	const retry = errorToast.mock.calls[0]?.[1]?.action?.onClick as () => void;
	retry();
	await screen.findByText("Proje Bağlamı için öneri hazırlama");
	await waitFor(() => expect(grantButton).toBeEnabled());
});

test("uncertain permission writes stay locked until the permission state is refreshed", async () => {
	const rootRoute = createRootRoute({ component: () => <Outlet /> });
	const accessRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/access",
		component: () => <ProjectAccessScreen projectId={projectId} />,
	});
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/access"] }),
		routeTree: rootRoute.addChildren([accessRoute]),
	});
	const queryClient = createQueryClient();
	fakeStore.nextGrantError = new TypeError("Load failed");

	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);

	await screen.findByRole("heading", { name: "Forest Quest" });
	const grantButton = screen.getByRole("button", {
		name: "Bağlam Ajanı izni ver",
	});
	fireEvent.click(grantButton);
	await waitFor(() => expect(grantButton).toBeDisabled());
	expect(fakeStore.permissions).toHaveLength(1);
	expect(errorToast).toHaveBeenCalledOnce();
	expect(
		screen.queryByText(
			"The result could not be confirmed. Check the current state before repeating this action."
		)
	).toBeNull();

	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));

	await waitFor(() => expect(grantButton).toBeEnabled());
	expect(screen.getByText("Etkin")).toBeVisible();
	expect(screen.getByRole("status")).toHaveTextContent(
		"İzin listesi yenilendi."
	);
});

test("permission query failures provide a Sonner Retry action", async () => {
	const rootRoute = createRootRoute({ component: () => <Outlet /> });
	const accessRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/access",
		component: () => <ProjectAccessScreen projectId={projectId} />,
	});
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/access"] }),
		routeTree: rootRoute.addChildren([accessRoute]),
	});
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	fakeStore.failedPermissionReads = 1;

	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);

	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	const retry = errorToast.mock.calls[0]?.[1]?.action?.onClick as () => void;
	retry();

	expect(
		await screen.findByText("Bu projede kayıtlı Bağlam Ajanı izni yok.")
	).toBeVisible();
});

test("the generated project route opens access from the authenticated project list", async () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const router = createRouter({
		context: { orpc: {} as never, queryClient },
		history: createMemoryHistory({ initialEntries: ["/projects"] }),
		routeTree,
	});

	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);

	const manageAccessLink = await screen.findByRole("link", {
		name: "Forest Quest izinlerini yönet",
	});
	expect(manageAccessLink).toHaveAttribute(
		"href",
		`/projects/${projectId}/access`
	);
	fireEvent.click(manageAccessLink);

	await waitFor(() =>
		expect(router.state.location.pathname).toBe(`/projects/${projectId}/access`)
	);
	expect(
		await screen.findByRole("link", { name: "Oyun projelerine dön" })
	).toBeVisible();
	expect(screen.getByRole("heading", { name: "Bağlam Ajanı" })).toBeVisible();
	expect(screen.getByText("Sağlayıcı seçilmedi")).toBeVisible();
	expect(screen.getByRole("group", { name: "Kimlik" })).toBeVisible();
	expect(screen.getByRole("group", { name: "Tema" })).toBeVisible();
	expect(screen.getByRole("group", { name: "Stil" })).toBeVisible();
});
