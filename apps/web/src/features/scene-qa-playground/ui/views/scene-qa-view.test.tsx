// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SceneQaView } from "./scene-qa-view";

vi.mock("@/utils/orpc", () => ({
	orpc: {
		sceneQa: {
			save: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: () => Promise.reject(new Error("unexpected write")),
				}),
			},
			list: {
				queryOptions: () => ({ queryKey: ["scenes"], queryFn: async () => [] }),
			},
		},
		assetVersions: {
			list: {
				queryOptions: () => ({
					queryKey: ["versions"],
					queryFn: async () => ({ assetVersions: [] }),
				}),
			},
		},
		assetRecords: {
			list: {
				queryOptions: () => ({ queryKey: ["assets"], queryFn: async () => [] }),
			},
		},
		specializedProfileContracts: {
			list: {
				queryOptions: () => ({
					queryKey: ["profiles"],
					queryFn: async () => ({ profiles: [] }),
				}),
			},
		},
	},
}));
const missingDataPattern = /Import intact image versions/;
afterEach(cleanup);
test("Scene QA Playground explains missing data and keeps evidence saving unavailable", async () => {
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<SceneQaView projectId="project" />
		</QueryClientProvider>
	);
	expect(
		await screen.findByRole("heading", { name: "Scene QA Playground" })
	).toBeInTheDocument();
	expect(await screen.findByText(missingDataPattern)).toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Save scene evidence" })
	).toBeDisabled();
});
