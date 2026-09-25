// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { AssetFamiliesView } from "./asset-families-view";

const errorToast = vi.hoisted(() => vi.fn());
const fakeApi = vi.hoisted(() => ({
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
		Link: ({ children }: { children: React.ReactNode }) => (
			<a href="/projects">{children}</a>
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
					queryFn: async () => ({
						assetFamilies: [],
						assetRecords: [],
						relationships: [],
						subjectIdentities: [],
					}),
				}),
			},
		},
		assetVersions: {
			list: {
				queryOptions: () => ({
					queryKey: ["asset-versions"],
					queryFn: async () => ({ assetVersions: [], canonicalDesigns: [] }),
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
