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
import type { SpecializedProfileContractsListOutput } from "@sprite-anvil/api/specialized-profile-contracts";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
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
			humanReviewRequirements: [],
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
	const template = specializedProfileContractCatalog.find(
		(contract) => contract.profileId === "icon"
	);
	const [itemResult] = readiness.items;
	if (!(template && itemResult)) {
		return;
	}
	const profileContracts = {
		profiles: specializedProfileContractCatalog.map((definition) => ({
			definition,
			activeContract:
				definition.profileId === template.profileId
					? {
							activatedAt: "2026-09-29T10:00:00.000Z",
							activatedByUserId: "user-1",
							contract: definition,
							contractRevisionId: `${definition.profileId}@${definition.version}`,
							projectId: "project-1",
						}
					: null,
		})),
	} satisfies SpecializedProfileContractsListOutput;
	fakeApi.readiness = {
		...readiness,
		items: [
			{
				...itemResult,
				qualityRequirements: template.rules.map((rule) => ({
					id: rule.id,
					name: rule.input,
					class: rule.class,
					required: rule.class !== "quality_advisory",
					waiverEligible: rule.waiverEligibility,
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
				name: `${measuredRule.input} · İstisna Verilebilir Gereksinim`,
			})
		).closest("form") as HTMLFormElement
	);
	const observedValue = qualityForm.getByRole("textbox", {
		name: "Gözlenen değer",
	});
	expect(observedValue).toBeRequired();
	expect(
		qualityForm.queryByRole("option", { name: "Kalite İstisnası ver" })
	).not.toBeInTheDocument();
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

function renderQualityWaiverMeasurement(isCurrent = true) {
	const template = specializedProfileContractCatalog.find(
		(contract) => contract.profileId === "icon"
	);
	const measuredRule = template?.rules.find(
		(rule) => rule.class === "waivable_requirement"
	);
	const [itemResult] = readiness.items;
	if (!(template && measuredRule && itemResult)) {
		throw new Error("The icon measurement fixtures are required.");
	}
	const measurement = {
		id: "measurement-1",
		projectId: "project-1",
		assetFamilyId: "family-1",
		revisionId: "revision-1",
		itemId: "east-facing",
		kind: "quality" as const,
		result: "failed" as const,
		assetVersionIds: ["asset-version-1"],
		profileContractRevisionIds: [`icon@${template.version}`],
		contextRevisionId: "context-1",
		visualWorldId: "world-1",
		useContext: "combat",
		canonicalDesignVersionId: "canonical-version-1",
		ruleId: measuredRule.id,
		ruleClass: "waivable_requirement" as const,
		testId: null,
		usageTestContext: null,
		observedValue: "96%",
		versionTarget: { kind: "unit" as const, id: "unit-version-1" },
		method: "Measured at native scale.",
		rationale: "The observed padding exceeds the declared limit.",
		createdAt: "2026-09-29T10:00:00.000Z",
		createdByUserId: "user-1",
		isCurrent,
	};
	const measuredReadiness = {
		...readiness,
		items: [
			{
				...itemResult,
				qualityReadiness: "blocked" as const,
				qualityRequirements: [
					{
						id: measuredRule.id,
						name: measuredRule.input,
						class: measuredRule.class,
						required: true,
						waiverEligible: true,
						result: "failed" as const,
						isCurrent,
					},
				],
				latestEvidence: [measurement],
				qualityVersionTargets: [{ kind: "unit", id: "unit-version-1" }],
			},
		],
	} satisfies FamilyReadiness;
	fakeApi.readiness = measuredReadiness;
	const profileContracts = {
		profiles: specializedProfileContractCatalog.map((definition) => ({
			definition,
			activeContract:
				definition.profileId === "icon"
					? {
							activatedAt: "2026-09-29T10:00:00.000Z",
							activatedByUserId: "user-1",
							contract: definition,
							contractRevisionId: `icon@${definition.version}`,
							projectId: "project-1",
						}
					: null,
		})),
	} satisfies SpecializedProfileContractsListOutput;
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
	return { measuredRule, measurement, measuredReadiness };
}

test("grants a reasoned Quality Waiver for the displayed immutable measurement and reads it back", async () => {
	const { measuredRule, measurement, measuredReadiness } =
		renderQualityWaiverMeasurement();
	const rationale = "The intentional overflow is accepted only for combat.";
	fakeApi.recordEvidence.mockImplementation(() => {
		const persisted = {
			...measuredReadiness,
			items: measuredReadiness.items.map((itemResult) => ({
				...itemResult,
				qualityReadiness: "exceptions_ready" as const,
				qualityRequirements: itemResult.qualityRequirements.map(
					(requirement) => ({ ...requirement, result: "waived" as const })
				),
				latestEvidence: [
					{
						...measurement,
						id: "waiver-1",
						result: "waived" as const,
						rationale,
					},
				],
			})),
		};
		fakeApi.readiness = persisted;
		return Promise.resolve(persisted);
	});
	const form = (
		await screen.findByRole("heading", {
			name: `${measuredRule.input} · İstisna Verilebilir Gereksinim`,
		})
	).closest("form") as HTMLFormElement;
	const controls = within(form);
	fireEvent.change(controls.getByRole("combobox", { name: "Sonuç" }), {
		target: { value: "waived" },
	});
	const scope = controls.getByRole("group", {
		name: "Kalite İstisnası kapsamı",
	});
	for (const value of [
		"measurement-1",
		"asset-version-1",
		"context-1",
		"world-1",
		"combat",
		"canonical-version-1",
		measurement.profileContractRevisionIds[0],
	]) {
		expect(within(scope).getByText(value)).toBeVisible();
	}
	expect(
		controls.getByRole("textbox", { name: "Gözlenen değer" })
	).toHaveAttribute("readonly");
	expect(controls.getByRole("textbox", { name: "Gözlenen değer" })).toHaveValue(
		"96%"
	);
	expect(controls.getByRole("textbox", { name: "Yöntem" })).toHaveAttribute(
		"readonly"
	);
	expect(
		controls.getByRole("textbox", { name: "Gerekçe veya gözlem" })
	).toBeRequired();
	fireEvent.change(
		controls.getByRole("textbox", { name: "Gerekçe veya gözlem" }),
		{ target: { value: rationale } }
	);
	fireEvent.submit(form);
	await waitFor(() =>
		expect(fakeApi.recordEvidence).toHaveBeenCalledWith({
			projectId: "project-1",
			assetFamilyId: "family-1",
			revisionId: "revision-1",
			itemId: "east-facing",
			kind: "quality",
			result: "waived",
			ruleId: measuredRule.id,
			method: measurement.method,
			observedValue: measurement.observedValue,
			waiverEvidenceId: measurement.id,
			versionTarget: measurement.versionTarget,
			rationale,
		})
	);
	expect(await screen.findByText("İstisnalarla Hazır")).toBeVisible();
	expect(screen.getByText(rationale, { selector: "dd" })).toBeInTheDocument();
	expect(
		screen.getByText("unit-version-1", { selector: "dd" })
	).toBeInTheDocument();
	expect(screen.getByText("user-1", { selector: "dd" })).toBeInTheDocument();
	expect(
		screen.getByText(measurement.createdAt, { selector: "dd" })
	).toBeInTheDocument();
});

test("does not offer a Quality Waiver for a stale measurement", async () => {
	const { measuredRule } = renderQualityWaiverMeasurement(false);
	const form = (
		await screen.findByRole("heading", {
			name: `${measuredRule.input} · İstisna Verilebilir Gereksinim`,
		})
	).closest("form") as HTMLFormElement;
	expect(
		within(form).queryByRole("option", { name: "Kalite İstisnası ver" })
	).not.toBeInTheDocument();
	expect(fakeApi.recordEvidence).not.toHaveBeenCalled();
});

test("pins a selected Unit Version when recording a measurable rule", async () => {
	const { measuredRule, measurement, measuredReadiness } =
		renderQualityWaiverMeasurement();
	fakeApi.recordEvidence.mockResolvedValue(measuredReadiness);
	const form = (
		await screen.findByRole("heading", {
			name: `${measuredRule.input} · İstisna Verilebilir Gereksinim`,
		})
	).closest("form") as HTMLFormElement;
	const controls = within(form);
	fireEvent.change(
		controls.getByRole("combobox", {
			name: "Birim Sürümü veya Birleşik Sürüm",
		}),
		{ target: { value: JSON.stringify(measurement.versionTarget) } }
	);
	fireEvent.change(controls.getByRole("textbox", { name: "Gözlenen değer" }), {
		target: { value: "96%" },
	});
	fireEvent.change(controls.getByRole("textbox", { name: "Yöntem" }), {
		target: { value: "Measured at native scale." },
	});
	fireEvent.change(
		controls.getByRole("textbox", { name: "Gerekçe veya gözlem" }),
		{
			target: { value: "The rule was measured for the selected Unit Version." },
		}
	);
	fireEvent.submit(form);
	await waitFor(() =>
		expect(fakeApi.recordEvidence).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "quality",
				result: "passed",
				ruleId: measuredRule.id,
				versionTarget: measurement.versionTarget,
			})
		)
	);
});

test("requires a pinned version target when recording a waivable requirement", async () => {
	const { measuredRule, measuredReadiness } = renderQualityWaiverMeasurement();
	fakeApi.recordEvidence.mockResolvedValue(measuredReadiness);
	const form = (
		await screen.findByRole("heading", {
			name: `${measuredRule.input} · İstisna Verilebilir Gereksinim`,
		})
	).closest("form") as HTMLFormElement;
	const controls = within(form);
	const versionTargetSelect = controls.getByRole("combobox", {
		name: "Birim Sürümü veya Birleşik Sürüm",
	});
	expect(versionTargetSelect).toBeRequired();
	fireEvent.change(controls.getByRole("textbox", { name: "Gözlenen değer" }), {
		target: { value: "96%" },
	});
	fireEvent.change(controls.getByRole("textbox", { name: "Yöntem" }), {
		target: { value: "Measured at native scale." },
	});
	fireEvent.change(
		controls.getByRole("textbox", { name: "Gerekçe veya gözlem" }),
		{ target: { value: "Measured without pinning a version." } }
	);
	fireEvent.submit(form);
	await waitFor(() => expect(fakeApi.recordEvidence).not.toHaveBeenCalled());
});

test("preserves the waiver rationale and blocked readiness when the API rejects the decision", async () => {
	const { measuredRule } = renderQualityWaiverMeasurement();
	fakeApi.recordEvidence.mockRejectedValue(
		new Error(
			"The measurement scope changed. Refresh before granting a waiver."
		)
	);
	const form = (
		await screen.findByRole("heading", {
			name: `${measuredRule.input} · İstisna Verilebilir Gereksinim`,
		})
	).closest("form") as HTMLFormElement;
	const controls = within(form);
	fireEvent.change(controls.getByRole("combobox", { name: "Sonuç" }), {
		target: { value: "waived" },
	});
	const rationale = "This exception is needed only for combat.";
	fireEvent.change(
		controls.getByRole("textbox", { name: "Gerekçe veya gözlem" }),
		{ target: { value: rationale } }
	);
	fireEvent.submit(form);
	expect(
		await screen.findByText(
			"The measurement scope changed. Refresh before granting a waiver."
		)
	).toBeVisible();
	expect(
		controls.getByRole("textbox", { name: "Gerekçe veya gözlem" })
	).toHaveValue(rationale);
	expect(screen.queryByText("İstisnalarla Hazır")).not.toBeInTheDocument();
	expect(
		controls.getByRole("button", { name: "Kalite İstisnası ver" })
	).toBeEnabled();
});

test("records a human review separately without offering a quality waiver", async () => {
	const template = specializedProfileContractCatalog.find(
		(contract) => contract.profileId === "icon"
	);
	const [itemResult] = readiness.items;
	const humanReview = template?.humanReviews[0];
	if (!(template && itemResult && humanReview)) {
		throw new Error(
			"Missing required icon profile human review test fixtures."
		);
	}
	const profileContracts = {
		profiles: specializedProfileContractCatalog.map((definition) => ({
			definition,
			activeContract:
				definition.profileId === template.profileId
					? {
							activatedAt: "2026-09-29T10:00:00.000Z",
							activatedByUserId: "user-1",
							contract: definition,
							contractRevisionId: `${definition.profileId}@${definition.version}`,
							projectId: "project-1",
						}
					: null,
		})),
	} satisfies SpecializedProfileContractsListOutput;
	fakeApi.readiness = {
		...readiness,
		items: [
			{
				...itemResult,
				qualityRequirements: template.rules.map((rule) => ({
					id: rule.id,
					name: rule.input,
					class: rule.class,
					required: rule.class !== "quality_advisory",
					waiverEligible: rule.waiverEligibility,
					result: "not_assessed",
					isCurrent: false,
				})),
				humanReviewRequirements: [
					{
						id: humanReview.id,
						name: humanReview.label,
						required: true,
						result: "not_assessed",
						isCurrent: false,
					},
				],
			},
		],
	};
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

	const humanReviewForm = within(
		(
			await screen.findByRole("heading", {
				name: `${humanReview.label} · Zorunlu insan incelemesi`,
			})
		).closest("form") as HTMLFormElement
	);
	expect(
		humanReviewForm.queryByRole("option", { name: "Kalite İstisnası ver" })
	).not.toBeInTheDocument();
	expect(
		humanReviewForm.queryByRole("textbox", { name: "Gözlenen değer" })
	).not.toBeInTheDocument();
	fireEvent.change(humanReviewForm.getByRole("combobox", { name: "Sonuç" }), {
		target: { value: "failed" },
	});
	fireEvent.change(humanReviewForm.getByRole("textbox", { name: "Yöntem" }), {
		target: { value: "Compared the icon at target size on both backgrounds." },
	});
	fireEvent.change(
		humanReviewForm.getByRole("textbox", { name: "Gerekçe veya gözlem" }),
		{ target: { value: "The silhouette is not clear at the smallest size." } }
	);
	fireEvent.submit(
		humanReviewForm
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
		result: "failed",
		ruleId: humanReview.id,
		method: "Compared the icon at target size on both backgrounds.",
		rationale: "The silhouette is not clear at the smallest size.",
	});
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

test("pins scene dimensions, an approved character, and two grounds to usage evidence", async () => {
	const [sourceItemResult] = readiness.items;
	const objectProfile = specializedProfileContractCatalog.find(
		(contract) => contract.profileId === "object_weapon_equipment_states"
	);
	const sceneTestId = "object.approved_character_ground_scene";
	if (!(sourceItemResult && objectProfile)) {
		throw new Error("Missing object scene test fixtures.");
	}
	const sceneItem: FamilyReadiness["items"][number]["item"] = {
		id: "placement-test",
		kind: "usage_test",
		name: "Approved character and ground scene",
		disposition: "required",
		assetRecordIds: ["object-record"],
		testId: sceneTestId,
	};
	const sceneReadiness: FamilyReadiness = {
		...readiness,
		activeRevision: readiness.activeRevision
			? { ...readiness.activeRevision, items: [sceneItem] }
			: null,
		items: [{ ...sourceItemResult, item: sceneItem, latestEvidence: [] }],
	};
	const context = {
		cellDimensions: { width: 32, height: 48 },
		approvedCharacterVersionId: "hero-version-3",
		targetGroundVersionIds: ["grass-version-1", "stone-version-4"],
	};
	const persistedEvidence = {
		id: "scene-evidence-1",
		projectId: "project-1",
		assetFamilyId: "family-1",
		revisionId: "revision-1",
		itemId: sceneItem.id,
		kind: "usage_test",
		result: "passed",
		assetVersionIds: ["object-version-1"],
		profileContractRevisionIds: ["object@1"],
		contextRevisionId: "context-1",
		visualWorldId: "world-1",
		useContext: "combat",
		canonicalDesignVersionId: null,
		ruleId: null,
		ruleClass: null,
		testId: sceneTestId,
		usageTestContext: context,
		observedValue: null,
		versionTarget: null,
		method: "Placed the object next to the approved character on both grounds.",
		rationale: "Scale and ground contact remain clear.",
		createdAt: "2026-10-05T09:00:00.000Z",
		createdByUserId: "user-1",
		isCurrent: true,
	} satisfies FamilyReadiness["items"][number]["latestEvidence"][number];
	const [sceneItemResult] = sceneReadiness.items;
	if (!sceneItemResult) {
		throw new Error("Missing object scene item result.");
	}
	const persistedReadiness: FamilyReadiness = {
		...sceneReadiness,
		items: [{ ...sceneItemResult, latestEvidence: [persistedEvidence] }],
	};
	const profileContracts = {
		profiles: specializedProfileContractCatalog.map((definition) => ({
			definition,
			activeContract:
				definition.profileId === objectProfile.profileId
					? {
							activatedAt: "2026-10-05T09:00:00.000Z",
							activatedByUserId: "user-1",
							contract: definition,
							contractRevisionId: "object@1",
							projectId: "project-1",
						}
					: null,
		})),
	} satisfies SpecializedProfileContractsListOutput;
	fakeApi.readiness = sceneReadiness;
	fakeApi.recordEvidence.mockImplementation(() => {
		fakeApi.readiness = persistedReadiness;
		return Promise.resolve(persistedReadiness);
	});
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<FamilyReadinessManager
				assetFamilyId="family-1"
				assetRecords={[
					{
						assetCategory: "object_weapon_equipment_states",
						id: "object-record",
						name: "Bronze chest",
					},
				]}
				familyName="Bronze chest"
				profileContracts={profileContracts}
				projectId="project-1"
				usageTestAssetRecords={[
					{
						assetCategory: "object_weapon_equipment_states",
						id: "object-record",
						name: "Bronze chest",
					},
					{
						assetCategory: "character_creature_animation",
						id: "hero-record",
						name: "Approved Hero",
					},
					{
						assetCategory: "tileset_terrain_texture",
						id: "grass-record",
						name: "Grass",
					},
					{
						assetCategory: "tileset_terrain_texture",
						id: "stone-record",
						name: "Stone",
					},
				]}
				usageTestAssetVersions={[
					{
						assetRecordId: "hero-record",
						id: "hero-version-3",
						reviewDisposition: "approved",
						versionNumber: 3,
					},
					{
						assetRecordId: "grass-record",
						id: "grass-version-1",
						reviewDisposition: "candidate",
						versionNumber: 1,
					},
					{
						assetRecordId: "stone-record",
						id: "stone-version-4",
						reviewDisposition: "candidate",
						versionNumber: 4,
					},
				]}
			/>
		</QueryClientProvider>
	);

	const form = (
		await screen.findByRole("heading", { name: "Kullanım testi sonucu" })
	).closest("form") as HTMLFormElement;
	const controls = within(form);
	fireEvent.change(
		controls.getByRole("spinbutton", { name: "Hücre genişliği (px)" }),
		{
			target: { value: "32" },
		}
	);
	fireEvent.change(
		controls.getByRole("spinbutton", { name: "Hücre yüksekliği (px)" }),
		{
			target: { value: "48" },
		}
	);
	fireEvent.change(
		controls.getByRole("combobox", { name: "Onaylı karakter sürümü" }),
		{
			target: { value: "hero-version-3" },
		}
	);
	fireEvent.change(
		controls.getByRole("combobox", { name: "Birinci zemin sürümü" }),
		{
			target: { value: "grass-version-1" },
		}
	);
	fireEvent.change(
		controls.getByRole("combobox", { name: "İkinci zemin sürümü" }),
		{
			target: { value: "stone-version-4" },
		}
	);
	fireEvent.change(controls.getByRole("textbox", { name: "Yöntem" }), {
		target: { value: persistedEvidence.method },
	});
	fireEvent.change(
		controls.getByRole("textbox", { name: "Gerekçe veya gözlem" }),
		{
			target: { value: persistedEvidence.rationale },
		}
	);
	fireEvent.submit(form);

	await waitFor(() =>
		expect(fakeApi.recordEvidence).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "usage_test",
				testId: sceneTestId,
				usageTestContext: context,
			})
		)
	);
	const evidenceSummary = await screen.findByText(
		`${sceneTestId} · Geçti · Güncel kanıt`
	);
	fireEvent.click(evidenceSummary);
	const evidenceDetails = evidenceSummary.closest("details");
	if (!evidenceDetails) {
		throw new Error("Persisted usage test evidence details are missing.");
	}
	const evidence = within(evidenceDetails);
	expect(evidence.getByText("32 × 48 px")).toBeVisible();
	expect(evidence.getByText("Approved Hero · v3")).toBeVisible();
	expect(evidence.getByText("Grass · v1, Stone · v4")).toBeVisible();
});
