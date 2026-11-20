// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { StageWorkingDraftPanel } from "./stage-working-draft-panel";

const { fetchDraft, stageDraft } = vi.hoisted(() => ({
	fetchDraft: vi.fn(),
	stageDraft: vi.fn(),
}));

vi.mock("../../lib/offline-staging-api", () => ({
	fetchWorkingDraftForStaging: fetchDraft,
}));

vi.mock("../../lib/offline-staging-store", () => ({
	getOfflineStagingStore: () => ({ stageWorkingDraft: stageDraft }),
}));

afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});

const projectId = "project-1";
const userId = "user-1";
const projectKey = ["offline-staging", userId, projectId];
const otherProjectKey = ["offline-staging", userId, "project-2"];
const otherAccountKey = ["offline-staging", "user-2", projectId];

async function stageWorkingDraft() {
	const queryClient = new QueryClient();
	for (const queryKey of [otherProjectKey, otherAccountKey]) {
		queryClient.setQueryData(queryKey, { drafts: [] });
	}
	const readStagedWork = vi
		.fn()
		.mockResolvedValueOnce({ drafts: [] })
		.mockResolvedValue({ drafts: ["draft-1"] });
	await queryClient.fetchQuery({
		queryKey: projectKey,
		queryFn: readStagedWork,
	});
	fetchDraft.mockResolvedValue({ revision: 3 });
	render(
		<QueryClientProvider client={queryClient}>
			<StageWorkingDraftPanel
				projectId={projectId}
				sourceAssetVersionId="version-1"
				userId={userId}
			/>
		</QueryClientProvider>
	);
	await userEvent.click(
		screen.getByRole("button", { name: "Stage Working Draft for offline" })
	);
	return queryClient;
}

test("refreshes staged work only for the account and project that saved the draft", async () => {
	stageDraft.mockResolvedValue("staged");
	const queryClient = await stageWorkingDraft();
	await screen.findByText(
		"Working Draft saved offline at revision 3. The cloud stays authoritative."
	);
	expect(queryClient.getQueryData(projectKey)).toEqual({ drafts: ["draft-1"] });
	expect(queryClient.getQueryState(otherProjectKey)?.isInvalidated).toBe(false);
	expect(queryClient.getQueryState(otherAccountKey)?.isInvalidated).toBe(false);
});

test("leaves staged work cached when the browser cannot save the draft", async () => {
	stageDraft.mockRejectedValue(new Error("Browser storage is unavailable."));
	const queryClient = await stageWorkingDraft();
	await screen.findByText("Browser storage is unavailable.");
	expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(false);
});

test("retains the cached list and shows why an earlier draft was kept", async () => {
	stageDraft.mockResolvedValue("kept-existing");
	const queryClient = await stageWorkingDraft();
	expect((await screen.findByRole("status")).textContent).toContain(
		"An earlier staged copy of this Working Draft is kept"
	);
	expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(false);
});
