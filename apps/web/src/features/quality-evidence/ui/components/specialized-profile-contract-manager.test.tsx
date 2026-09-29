// @vitest-environment jsdom

import type { SpecializedProfileContractsListOutput } from "@sprite-anvil/api/specialized-profile-contracts";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
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
	catalog: null as SpecializedProfileContractsListOutput | null,
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

function createCatalog(): SpecializedProfileContractsListOutput {
	return {
		profiles: specializedProfileContractCatalog.map((definition) => ({
			definition,
			activeContract: null,
		})),
	};
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.activate.mockReset();
	fakeApi.catalog = null;
});

test("activates a project's current immutable profile contract and reads it back", async () => {
	fakeApi.catalog = createCatalog();
	fakeApi.activate.mockImplementation(({ projectId, profileId }) => {
		const { catalog } = fakeApi;
		if (!catalog) {
			return Promise.resolve(null);
		}
		const profile = catalog.profiles.find(
			(candidate) => candidate.definition.profileId === profileId
		);
		if (!profile) {
			return Promise.resolve(null);
		}
		const activeContract = {
			activatedAt: "2026-09-29T10:00:00.000Z",
			activatedByUserId: "user-1",
			contract: profile.definition,
			contractRevisionId: `${profileId}@${profile.definition.version}`,
			projectId,
		};
		fakeApi.catalog = {
			profiles: catalog.profiles.map((entry) =>
				entry.definition.profileId === profileId
					? { ...entry, activeContract }
					: entry
			),
		};
		return Promise.resolve(activeContract);
	});
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
		iconCard.getByRole("button", {
			name: "Sözleşme v1.0.0’i etkinleştir",
		})
	);

	await waitFor(() => expect(fakeApi.activate).toHaveBeenCalledOnce());
	expect(await iconCard.findByText("Etkin sözleşme v1.0.0")).toBeVisible();
	expect(
		await screen.findByText(
			"Özel Profil Sözleşmesi etkinleştirildi ve kayıttan yeniden okundu."
		)
	).toBeVisible();
});
