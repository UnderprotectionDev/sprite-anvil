// @vitest-environment jsdom

import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
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
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { SpecializedProfileContractsView } from "./specialized-profile-contracts-view";

const projectId = "profile-contract-project";

const fakeApi = vi.hoisted(() => ({
	activation: null as ProjectProfileContractActivation | null,
	activate: vi.fn(),
	list: vi.fn(),
	project: {
		id: "profile-contract-project",
		name: "Ash Knight",
		createdAt: "2026-09-29T12:00:00.000Z",
	},
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		Link: ({ children, to }: { children: ReactNode; to: string }) => (
			<a href={to}>{children}</a>
		),
	};
});

vi.mock("@/utils/orpc", () => ({
	client: {
		specializedProfileContracts: {
			activate: (input: unknown) => fakeApi.activate(input),
		},
	},
	orpc: {
		projects: {
			get: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["project", input],
					queryFn: async () => fakeApi.project,
				}),
			},
		},
		specializedProfileContracts: {
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["specialized-profile-contracts", input],
					queryFn: async () => fakeApi.list(input),
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.activation = null;
	fakeApi.activate.mockReset();
	fakeApi.list.mockReset();
});

function renderContracts() {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	return render(
		<QueryClientProvider client={queryClient}>
			<SpecializedProfileContractsView projectId={projectId} />
		</QueryClientProvider>
	);
}

function listedProfiles() {
	return {
		profiles: specializedProfileContractCatalog.map((definition) => ({
			activeContract:
				fakeApi.activation?.contract.profileId === definition.profileId
					? fakeApi.activation
					: null,
			definition,
		})),
	};
}

test("activates one project profile and displays the persisted revision", async () => {
	fakeApi.list.mockImplementation(() => listedProfiles());
	fakeApi.activate.mockImplementation(() => {
		const contract = specializedProfileContractCatalog.find(
			(candidate) => candidate.profileId === "icon"
		);
		if (!contract) {
			throw new Error("Icon profile definition is missing");
		}
		fakeApi.activation = {
			activatedAt: "2026-09-29T12:00:00.000Z",
			activatedByUserId: "profile-contract-user",
			contract,
			contractRevisionId: "icon@1.0.0",
			projectId,
		};
		return Promise.resolve(fakeApi.activation);
	});
	renderContracts();

	const iconCard = await screen.findByRole("article", { name: "İkon" });
	const detailsButton = within(iconCard).getByText("Sözleşme ayrıntıları");
	fireEvent.click(detailsButton);
	expect(within(iconCard).getByText("icon.metadata_roundtrip")).toBeVisible();
	expect(
		within(iconCard).getByText("Metadata alanları ve dışa aktarım eşlemeleri")
	).toBeVisible();

	fireEvent.click(
		within(iconCard).getByRole("button", { name: "Sözleşmeyi etkinleştir" })
	);

	await waitFor(() => {
		expect(fakeApi.activate).toHaveBeenCalledWith({
			projectId,
			profileId: "icon",
		});
		expect(fakeApi.list).toHaveBeenCalledTimes(2);
	});
	expect(
		await screen.findByText(
			"İkon 1.0.0 sürümü etkinleştirildi ve yeniden okundu."
		)
	).toBeVisible();
	expect(
		within(iconCard).getByRole("button", { name: "Etkin" })
	).toBeDisabled();
	expect(
		within(
			screen.getByRole("article", { name: "Arka plan ve katmanlı kaydırma" })
		).getByText("Bu projede henüz etkin değil")
	).toBeVisible();
});
