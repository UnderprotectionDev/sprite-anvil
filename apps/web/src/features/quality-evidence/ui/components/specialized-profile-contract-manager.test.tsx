// @vitest-environment jsdom

import type { ProfileContractsCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { specializedProfileContractTemplates } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { SpecializedProfileContractManager } from "./specialized-profile-contract-manager";

const fakeApi = vi.hoisted(() => ({
	activate: vi.fn(),
	catalog: null as ProfileContractsCatalog | null,
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		specializedProfileContracts: { activate: fakeApi.activate },
	},
	orpc: {
		specializedProfileContracts: {
			list: {
				queryOptions: ({ input }: { input: { projectId: string } }) => ({
					queryKey: ["profile-contracts", input.projectId],
					queryFn: async () => fakeApi.catalog,
				}),
			},
		},
	},
}));

function createCatalog(projectId: string): ProfileContractsCatalog {
	return {
		projectId,
		profiles: specializedProfileContractTemplates.map((template) => ({
			profileId: template.profileId,
			template,
			activeRevision: null,
			revisions: [],
		})),
	};
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.activate.mockReset();
	fakeApi.catalog = null;
});

test("activates a profile contract and reloads the immutable revision", async () => {
	fakeApi.catalog = createCatalog("project-1");
	fakeApi.activate.mockImplementation(
		({ projectId, profileId, templateRevisionNumber }) => {
			const { catalog } = fakeApi;
			if (!catalog) {
				return Promise.resolve(null);
			}
			const profile = catalog.profiles.find(
				(candidate) => candidate.profileId === profileId
			);
			if (!profile) {
				return Promise.resolve(null);
			}
			const activeRevision = {
				id: "profile-contract-revision-1",
				projectId,
				profileId,
				revisionNumber: 1,
				contract: profile.template,
				createdAt: "2026-09-29T10:00:00.000Z",
				createdByUserId: "user-1",
				isActive: true,
				wasActivated: true,
			};
			fakeApi.catalog = {
				...catalog,
				profiles: catalog.profiles.map((entry) =>
					entry.profileId === profileId
						? {
								...entry,
								activeRevision:
									templateRevisionNumber === profile.template.revisionNumber
										? activeRevision
										: null,
								revisions: [activeRevision],
							}
						: entry
				),
			};
			const { catalog: updatedCatalog } = fakeApi;
			return Promise.resolve(updatedCatalog);
		}
	);
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<SpecializedProfileContractManager projectId="project-1" />
		</QueryClientProvider>
	);

	const iconCard = within(
		(await screen.findByRole("heading", { name: "İkonlar" })).closest(
			"li"
		) as HTMLLIElement
	);
	fireEvent.click(
		iconCard.getByRole("button", { name: "Sözleşme v1’i etkinleştir" })
	);

	await waitFor(() => expect(fakeApi.activate).toHaveBeenCalledOnce());
	expect(await iconCard.findByText("Etkin revizyon 1")).toBeVisible();
	expect(
		await screen.findByText(
			"Özel Profil Sözleşmesi etkinleştirildi ve kayıttan yeniden okundu."
		)
	).toBeVisible();
});
