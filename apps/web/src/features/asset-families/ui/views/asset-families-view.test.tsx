// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { AssetFamiliesView } from "./asset-families-view";

const errorToast = vi.hoisted(() => vi.fn());
const fakeApi = vi.hoisted(() => ({
	catalog: null as AssetFamilyCatalog | null,
	projectError: null as Error | null,
	projects: [] as { id: string; name: string }[],
}));
const projectNamePattern = /Forest Quest/;

vi.mock("sonner", () => ({
	toast: { dismiss: vi.fn(), error: errorToast },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		Link: ({
			className,
			children,
			params,
			to,
		}: {
			className?: string;
			children: React.ReactNode;
			params?: Record<string, string>;
			to: string;
		}) => (
			<a
				className={className}
				data-params={JSON.stringify(params)}
				data-to={to}
				href={to}
			>
				{children}
			</a>
		),
	};
});

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		assetFamilies: {
			list: {
				queryOptions: () => ({
					queryKey: ["asset-families"],
					queryFn: async () =>
						fakeApi.catalog ?? {
							assetFamilies: [],
							assetRecords: [],
							relationships: [],
							subjectIdentities: [],
						},
				}),
			},
		},
		assetVersions: {
			list: {
				queryOptions: () => ({
					queryKey: ["asset-versions"],
					queryFn: async () => ({
						assetVersions: [],
						canonicalDesigns: [],
						unitVersions: [],
						compositeVersions: [],
					}),
				}),
			},
		},
		contextScopes: {
			list: {
				queryOptions: () => ({
					queryKey: ["context-scopes"],
					queryFn: async () => ({ visualWorlds: [] }),
				}),
			},
		},
		projectContexts: {
			list: {
				queryOptions: () => ({
					queryKey: ["projects"],
					queryFn: () => {
						if (fakeApi.projectError) {
							return Promise.reject(fakeApi.projectError);
						}
						return Promise.resolve(fakeApi.projects);
					},
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.projectError = null;
	fakeApi.catalog = null;
	fakeApi.projects = [];
	errorToast.mockClear();
});

test("shows a failed Asset Family query only in Sonner with a working Retry", async () => {
	fakeApi.projectError = Object.assign(new Error("Internal server error"), {
		code: "INTERNAL_SERVER_ERROR",
		data: { supportReference: "SUP-7CFB1C3A-A7A3-4BC2-B748-B5065AA2314A" },
	});
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<AssetFamiliesView projectId="project-1" />
		</QueryClientProvider>
	);

	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(errorToast.mock.calls[0]?.[0]).toBe("Data could not be loaded.");
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	const options = errorToast.mock.calls[0]?.[1] as {
		action: { label: string; onClick: () => void };
	};
	expect(options.action.label).toBe("Retry");

	fakeApi.projectError = null;
	fakeApi.projects = [{ id: "project-1", name: "Forest Quest" }];
	options.action.onClick();
	expect(await screen.findAllByText(projectNamePattern)).toHaveLength(2);
});

test("routes Varlık Sürümü yükle to the owning Asset Record detail", async () => {
	fakeApi.projects = [{ id: "project-1", name: "Forest Quest" }];
	fakeApi.catalog = {
		assetFamilies: [
			{
				createdAt: "2026-09-28T12:00:00.000Z",
				id: "family-1",
				name: "Gameplay",
				projectId: "project-1",
				subjectIdentityId: "subject-1",
				useContext: "Gameplay sprite",
				visualWorldId: "world-1",
			},
		],
		assetRecords: [
			{
				assetFamilyId: "family-1",
				createdAt: "2026-09-28T12:00:00.000Z",
				id: "asset-record-1",
				name: "Ash Knight",
				projectId: "project-1",
			},
		],
		relationships: [],
		subjectIdentities: [
			{
				createdAt: "2026-09-28T12:00:00.000Z",
				id: "subject-1",
				name: "Ash Knight",
				projectId: "project-1",
			},
		],
	};
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<AssetFamiliesView projectId="project-1" />
		</QueryClientProvider>
	);

	expect(
		await screen.findByRole("heading", {
			name: "Varlık Sürümleri ve inceleme",
		})
	).toBeVisible();
	const uploadLink = await screen.findByRole("link", {
		name: "Varlık Sürümü yükle",
	});
	expect(uploadLink).toHaveAttribute(
		"data-to",
		"/projects/$projectId/assets/$assetRecordId"
	);
	expect(uploadLink).toHaveAttribute(
		"data-params",
		JSON.stringify({
			assetRecordId: "asset-record-1",
			projectId: "project-1",
		})
	);
	expect(uploadLink).toHaveClass("focus-visible:ring-2");
});
