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
import type { ProfileContractsCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { specializedProfileContractTemplates } from "@sprite-anvil/api/specialized-profile-contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { FamilyReadinessManager } from "./family-readiness-manager";

const fakeApi = vi.hoisted(() => ({
	recordEvidence: vi.fn(),
	saveDraft: vi.fn(),
	readiness: null as unknown,
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		familyReadiness: {
			recordEvidence: fakeApi.recordEvidence,
			saveDraft: fakeApi.saveDraft,
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
			qualityReadiness: "not_assessed",
			qualityRequirements: [
				{
					id: "general.asset_support",
					name: "General Asset Support",
					class: "general_asset_support",
					required: true,
					waiverEligible: false,
					result: "not_assessed",
					isCurrent: false,
				},
			],
			usageRequirements: [],
			latestEvidence: [],
		},
	],
} satisfies FamilyReadiness;

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.recordEvidence.mockReset();
	fakeApi.saveDraft.mockReset();
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
				assetRecords={[
					{
						assetCategory: null,
						id: "asset-record-1",
						name: "East-facing sprite",
					},
				]}
				familyName="Combat sprite"
				profileContracts={null}
				projectId="project-1"
			/>
		</QueryClientProvider>
	);

	const qualityForm = within(
		(
			await screen.findByRole("heading", {
				name: "General Asset Support · Genel Varlık Desteği",
			})
		).closest("form") as HTMLFormElement
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
		ruleId: "general.asset_support",
		method: "Measured the submitted version at native scale.",
		rationale: "The observed dimensions match the rule.",
	});
});

test("clears a usage test id when changing the Required Set item kind", async () => {
	const { activeRevision } = readiness;
	if (!activeRevision) {
		return;
	}
	const usageTestItem = {
		id: "target-size-backgrounds",
		kind: "usage_test",
		name: "Target sizes and backgrounds",
		disposition: "required",
		assetRecordIds: ["asset-record-1"],
		testId: "target_size_backgrounds",
	} satisfies FamilyReadiness["items"][number]["item"];
	fakeApi.readiness = {
		...readiness,
		activeRevision: { ...activeRevision, items: [usageTestItem] },
	} satisfies FamilyReadiness;
	fakeApi.saveDraft.mockResolvedValue({});
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<FamilyReadinessManager
				assetFamilyId="family-1"
				assetRecords={[
					{
						assetCategory: "icon",
						id: "asset-record-1",
						name: "Icon",
					},
				]}
				familyName="Combat sprite"
				profileContracts={null}
				projectId="project-1"
			/>
		</QueryClientProvider>
	);

	const kindSelect = await screen.findByRole("combobox", { name: "Öğe türü" });
	fireEvent.change(kindSelect, { target: { value: "direction" } });
	fireEvent.submit(kindSelect.closest("form") as HTMLFormElement);

	await waitFor(() => expect(fakeApi.saveDraft).toHaveBeenCalledOnce());
	expect(fakeApi.saveDraft).toHaveBeenCalledWith({
		projectId: "project-1",
		assetFamilyId: "family-1",
		items: [
			{
				id: "target-size-backgrounds",
				kind: "direction",
				name: "Target sizes and backgrounds",
				disposition: "required",
				assetRecordIds: [],
			},
		],
	});
});

test("records a measured value for a Specialized Profile Contract measurement", async () => {
	const template = specializedProfileContractTemplates.find(
		(contract) => contract.profileId === "icon"
	);
	const [itemResult] = readiness.items;
	if (!(template && itemResult)) {
		return;
	}
	const activeRevision = {
		id: "profile-contract-revision-1",
		projectId: "project-1",
		profileId: template.profileId,
		revisionNumber: 1,
		contract: template,
		createdAt: "2026-09-29T10:00:00.000Z",
		createdByUserId: "user-1",
		isActive: true,
		wasActivated: true,
	};
	const profileContracts = {
		projectId: "project-1",
		profiles: specializedProfileContractTemplates.map((profileTemplate) => ({
			profileId: profileTemplate.profileId,
			template: profileTemplate,
			activeRevision:
				profileTemplate.profileId === template.profileId
					? activeRevision
					: null,
			revisions:
				profileTemplate.profileId === template.profileId
					? [activeRevision]
					: [],
		})),
	} satisfies ProfileContractsCatalog;
	fakeApi.readiness = {
		...readiness,
		items: [
			{
				...itemResult,
				qualityRequirements: template.rules.map((rule) => ({
					id: rule.id,
					name: rule.name,
					class: rule.class,
					required: rule.required,
					waiverEligible: rule.waiverEligible,
					result: "not_assessed" as const,
					isCurrent: false,
				})),
			},
		],
	} satisfies FamilyReadiness;
	fakeApi.recordEvidence.mockResolvedValue(readiness);
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<FamilyReadinessManager
				assetFamilyId="family-1"
				assetRecords={[
					{
						assetCategory: "icon",
						id: "asset-record-1",
						name: "East-facing sprite",
					},
				]}
				familyName="Combat sprite"
				profileContracts={profileContracts}
				projectId="project-1"
			/>
		</QueryClientProvider>
	);

	const measuredRule = template.rules.find(
		(rule) => rule.class === "waivable_requirement"
	);
	if (!measuredRule) {
		return;
	}
	const qualityForm = within(
		(
			await screen.findByRole("heading", {
				name: `${measuredRule.name} · İstisna Verilebilir Gereksinim`,
			})
		).closest("form") as HTMLFormElement
	);
	const observedValue = qualityForm.getByRole("textbox", {
		name: "Gözlenen değer",
	});
	expect(observedValue).toBeRequired();
	fireEvent.change(observedValue, { target: { value: "96%" } });
	fireEvent.change(qualityForm.getByRole("textbox", { name: "Yöntem" }), {
		target: { value: "Compared against the declared tolerance." },
	});
	fireEvent.change(
		qualityForm.getByRole("textbox", { name: "Gerekçe veya gözlem" }),
		{ target: { value: "The measured value is within the declared limit." } }
	);
	fireEvent.submit(
		qualityForm
			.getByRole("button", { name: "Kanıtı kaydet" })
			.closest("form") as HTMLFormElement
	);

	await waitFor(() => expect(fakeApi.recordEvidence).toHaveBeenCalledOnce());
	expect(fakeApi.recordEvidence).toHaveBeenCalledWith(
		expect.objectContaining({
			kind: "quality",
			result: "passed",
			ruleId: measuredRule.id,
			observedValue: "96%",
		})
	);
});

test("uses unique DOM ids when different families share Required Set item ids", async () => {
	fakeApi.readiness = readiness;
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	const assetRecords = [
		{
			assetCategory: null,
			id: "asset-record-1",
			name: "East-facing sprite",
		},
	];
	render(
		<QueryClientProvider client={queryClient}>
			<div>
				<FamilyReadinessManager
					assetFamilyId="family-1"
					assetRecords={assetRecords}
					familyName="Combat sprite"
					profileContracts={null}
					projectId="project-1"
				/>
				<FamilyReadinessManager
					assetFamilyId="family-2"
					assetRecords={assetRecords}
					familyName="Magic sprite"
					profileContracts={null}
					projectId="project-1"
				/>
			</div>
		</QueryClientProvider>
	);

	await screen.findAllByRole("heading", { name: "Etkin Sürüm 1" });
	const ids = [...document.querySelectorAll("[id]")].map(
		(element) => element.id
	);
	expect(new Set(ids).size).toBe(ids.length);
});

test("offers applicability and quality evidence on a required usage test item", async () => {
	const [sourceItemResult] = readiness.items;
	if (!sourceItemResult) {
		return;
	}
	const usageTestItem: FamilyReadiness["items"][number]["item"] = {
		id: "scene-transition",
		kind: "usage_test",
		name: "Scene transition",
		disposition: "required",
		assetRecordIds: ["asset-record-1"],
		testId: "scene_transition",
	};
	fakeApi.readiness = {
		...readiness,
		activeRevision: readiness.activeRevision
			? { ...readiness.activeRevision, items: [usageTestItem] }
			: null,
		items: [
			{
				...sourceItemResult,
				item: usageTestItem,
			},
		],
	} satisfies FamilyReadiness;
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<FamilyReadinessManager
				assetFamilyId="family-1"
				assetRecords={[
					{
						assetCategory: null,
						id: "asset-record-1",
						name: "East-facing sprite",
					},
				]}
				familyName="Combat sprite"
				profileContracts={null}
				projectId="project-1"
			/>
		</QueryClientProvider>
	);

	expect(
		await screen.findByRole("heading", {
			name: "Bağlama Uygunluk değerlendirmesi",
		})
	).toBeInTheDocument();
	expect(
		screen.getByRole("heading", {
			name: "General Asset Support · Genel Varlık Desteği",
		})
	).toBeInTheDocument();
	expect(
		screen.getByRole("heading", { name: "Kullanım testi sonucu" })
	).toBeInTheDocument();
});
