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
import type { FamilyReadiness } from "@sprite-anvil/api/family-readiness";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { FamilyReadinessManager } from "./family-readiness-manager";

const fakeApi = vi.hoisted(() => ({
	recordEvidence: vi.fn(),
	readiness: null as unknown,
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		familyReadiness: {
			recordEvidence: fakeApi.recordEvidence,
		},
	},
	orpc: {
		familyReadiness: {
			list: {
				queryOptions: ({
					input,
				}: {
					input: { projectId: string; assetFamilyId: string };
				}) => ({
					queryKey: ["family-readiness", input.assetFamilyId],
					queryFn: async () => fakeApi.readiness,
				}),
			},
		},
	},
}));

const readiness = {
	projectId: "project-1",
	assetFamilyId: "family-1",
	status: "incomplete",
	activeRevision: {
		id: "revision-1",
		projectId: "project-1",
		assetFamilyId: "family-1",
		revisionNumber: 1,
		items: [
			{
				id: "east-facing",
				kind: "direction",
				name: "East-facing sprite",
				disposition: "required",
				assetRecordIds: ["asset-record-1"],
			},
		],
		createdAt: "2026-09-29T10:00:00.000Z",
		createdByUserId: "user-1",
		isActive: true,
		wasActivated: true,
	},
	revisions: [],
	items: [
		{
			item: {
				id: "east-facing",
				kind: "direction",
				name: "East-facing sprite",
				disposition: "required",
				assetRecordIds: ["asset-record-1"],
			},
			status: "incomplete",
			blockers: ["applicability", "quality", "quality_contract"],
			currentAssetVersionIds: ["asset-version-1"],
			latestEvidence: [],
		},
	],
} satisfies FamilyReadiness;

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.recordEvidence.mockReset();
	fakeApi.readiness = null;
});

test("records quality evidence for the active Required Set item through labeled controls", async () => {
	fakeApi.readiness = readiness;
	fakeApi.recordEvidence.mockResolvedValue(readiness);
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<FamilyReadinessManager
				assetFamilyId="family-1"
				assetRecords={[{ id: "asset-record-1", name: "East-facing sprite" }]}
				familyName="Combat sprite"
				projectId="project-1"
			/>
		</QueryClientProvider>
	);

	const qualityForm = within(
		(
			await screen.findByRole("heading", { name: "Kalite kuralı kanıtı" })
		).closest("form") as HTMLFormElement
	);
	fireEvent.change(
		qualityForm.getByRole("textbox", { name: "Kural kimliği" }),
		{
			target: { value: "dimensions.within-profile-range" },
		}
	);
	fireEvent.change(qualityForm.getByRole("textbox", { name: "Yöntem" }), {
		target: { value: "Measured the submitted version at native scale." },
	});
	fireEvent.change(
		qualityForm.getByRole("textbox", { name: "Gerekçe veya gözlem" }),
		{
			target: { value: "The observed dimensions match the rule." },
		}
	);
	fireEvent.submit(
		qualityForm
			.getByRole("button", { name: "Kanıtı kaydet" })
			.closest("form") as HTMLFormElement
	);

	await waitFor(() => expect(fakeApi.recordEvidence).toHaveBeenCalledOnce());
	expect(fakeApi.recordEvidence).toHaveBeenCalledWith({
		projectId: "project-1",
		assetFamilyId: "family-1",
		revisionId: "revision-1",
		itemId: "east-facing",
		kind: "quality",
		result: "passed",
		ruleId: "dimensions.within-profile-range",
		method: "Measured the submitted version at native scale.",
		rationale: "The observed dimensions match the rule.",
	});
});
