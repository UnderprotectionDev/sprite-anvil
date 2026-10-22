// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { AssetFamiliesView } from "./asset-families-view";

const errorToast = vi.hoisted(() => vi.fn());
const fakeApi = vi.hoisted(() => ({
	createAssetFamily: vi.fn(),
	createAssetRecord: vi.fn(),
	createRelationship: vi.fn(),
	createSubjectIdentity: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: { dismiss: vi.fn(), error: errorToast },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
			<a href={to}>{children}</a>
		),
	};
});

vi.mock(
	"@/features/asset-versions/ui/components/asset-version-controls",
	() => ({
		AssetVersionControls: () => null,
	})
);

function queryOptions<T>(key: string, data: T) {
	return {
		queryKey: () => [key],
		queryOptions: () => ({ queryKey: [key], queryFn: async () => data }),
	};
}

function mutation(mutationFn: (input: unknown) => Promise<unknown>) {
	return {
		mutationOptions: (options?: object) => ({ ...options, mutationFn }),
	};
}

const catalog = vi.hoisted(() => ({
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
		{
			createdAt: "2026-09-28T12:00:00.000Z",
			id: "family-2",
			name: "Marketing",
			projectId: "project-1",
			subjectIdentityId: "subject-1",
			useContext: "Store art",
			visualWorldId: "world-1",
		},
	],
	assetRecords: [
		{
			assetFamilyId: "family-1",
			createdAt: "2026-09-28T12:00:00.000Z",
			id: "record-1",
			name: "Idle",
			projectId: "project-1",
		},
		{
			assetFamilyId: "family-1",
			createdAt: "2026-09-28T12:00:00.000Z",
			id: "record-2",
			name: "Run",
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
		{
			createdAt: "2026-09-28T12:00:00.000Z",
			id: "subject-2",
			name: "Iron Key",
			projectId: "project-1",
		},
	],
}));

const unusedMutation = vi.hoisted(() => ({
	mutationOptions: (options?: object) => ({
		...options,
		mutationFn: () => Promise.reject(new Error("unexpected write")),
	}),
}));

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		assetFamilies: {
			createAssetFamily: mutation((input) => fakeApi.createAssetFamily(input)),
			createAssetRecord: mutation((input) => fakeApi.createAssetRecord(input)),
			createRelationship: mutation((input) =>
				fakeApi.createRelationship(input)
			),
			createSubjectIdentity: mutation((input) =>
				fakeApi.createSubjectIdentity(input)
			),
			list: queryOptions("asset-families", catalog),
		},
		assetRecords: { list: queryOptions("asset-records", []) },
		assetVersions: {
			createCompositeVersion: unusedMutation,
			previewBatchReview: unusedMutation,
			recordProviderGeneration: unusedMutation,
			review: unusedMutation,
			reviewBatch: unusedMutation,
			reviewCompositeVersion: unusedMutation,
			selectCanonicalDesign: unusedMutation,
			list: queryOptions("asset-versions", {
				assetVersions: [],
				canonicalDesigns: [],
				compositeVersions: [],
				unitVersions: [],
			}),
		},
		contextScopes: {
			list: queryOptions("context-scopes", {
				visualWorlds: [
					{ id: "world-1", name: "Forest" },
					{ id: "world-2", name: "Desert" },
				],
			}),
		},
		directionalReviews: {
			save: unusedMutation,
			list: queryOptions("directional-reviews", []),
		},
		animationTimingReviews: {
			save: unusedMutation,
			list: queryOptions("timing-reviews", []),
		},
		dependencyRevalidation: {
			createLink: unusedMutation,
			determine: unusedMutation,
			pinHistoricalComposition: unusedMutation,
			reReview: unusedMutation,
			listHistoricalCompositions: queryOptions("historical", { pins: [] }),
			historicalCompositionOptions: queryOptions("historical-options", {
				contracts: [],
				evidence: [],
			}),
			list: queryOptions("dependency-revalidation", {
				canonicalDesigns: [],
				changeImpacts: [],
				contextRevisions: [],
				dependencyLinks: [],
				reviews: [],
				revalidationRequiredVersionIds: [],
			}),
		},
		familyReadiness: {
			activate: unusedMutation,
			recordEvidence: unusedMutation,
			saveDraft: unusedMutation,
			list: queryOptions("family-readiness", {
				activeRevision: null,
				items: [],
				revisions: [],
				status: "not_configured",
			}),
		},
		projectContexts: {
			list: queryOptions("projects", [
				{ id: "project-1", name: "Forest Quest" },
			]),
		},
		specializedProfileContracts: {
			list: queryOptions("profiles", { profiles: [], projectId: "project-1" }),
		},
	},
}));

beforeEach(() => {
	for (const mock of Object.values(fakeApi)) {
		mock.mockReset();
		mock.mockResolvedValue({ id: "created-id" });
	}
});

afterEach(() => {
	cleanup();
	errorToast.mockClear();
});

async function openSetup() {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<AssetFamiliesView projectId="project-1" />
		</QueryClientProvider>
	);
	const user = userEvent.setup();
	await user.click(
		await screen.findByRole("button", { name: "Aile ve temsil ilişkileri" })
	);
	await screen.findByRole("textbox", { name: "Varlık Kimliği adı" });
	return user;
}

test("creates a Subject Identity with the typed name and clears the draft", async () => {
	const user = await openSetup();
	const submit = screen.getByRole("button", { name: "Varlık Kimliği oluştur" });
	expect(submit).toBeDisabled();
	const name = screen.getByRole("textbox", { name: "Varlık Kimliği adı" });
	await user.type(name, "   ");
	expect(submit).toBeDisabled();
	await user.clear(name);
	await user.type(name, "Moss Golem");
	expect(submit).toBeEnabled();
	await user.click(submit);

	await waitFor(() =>
		expect(fakeApi.createSubjectIdentity).toHaveBeenCalledWith({
			name: "Moss Golem",
			projectId: "project-1",
		})
	);
	expect(await screen.findByText("Varlık Kimliği kaydedildi.")).toBeVisible();
	expect(name).toHaveValue("");
});

test("keeps the Subject Identity draft and reports a failed save", async () => {
	fakeApi.createSubjectIdentity.mockRejectedValue(new Error("Boom"));
	const user = await openSetup();
	const name = screen.getByRole("textbox", { name: "Varlık Kimliği adı" });
	await user.type(name, "Moss Golem");
	await user.click(
		screen.getByRole("button", { name: "Varlık Kimliği oluştur" })
	);

	await waitFor(() => expect(errorToast).toHaveBeenCalled());
	expect(name).toHaveValue("Moss Golem");
	expect(screen.queryByText("Varlık Kimliği kaydedildi.")).toBeNull();
});

test("creates an Asset Family from the selected identity and Visual World", async () => {
	const user = await openSetup();
	const submit = screen.getByRole("button", { name: "Varlık Ailesi oluştur" });
	const familyName = screen.getByRole("textbox", { name: "Varlık Ailesi adı" });
	const useContext = screen.getByRole("textbox", { name: "Kullanım bağlamı" });
	const identity = screen.getByRole("combobox", { name: "Varlık Kimliği" });
	const world = screen.getByRole("combobox", { name: "Görsel Dünya" });
	expect(identity).toHaveValue("subject-1");
	expect(world).toHaveValue("world-1");
	expect(submit).toBeDisabled();

	await user.type(familyName, "Cutscene");
	expect(submit).toBeDisabled();
	await user.type(useContext, "Intro");
	expect(submit).toBeEnabled();

	await user.selectOptions(identity, "subject-2");
	await user.selectOptions(world, "world-2");
	await user.click(submit);

	await waitFor(() =>
		expect(fakeApi.createAssetFamily).toHaveBeenCalledWith({
			name: "Cutscene",
			projectId: "project-1",
			subjectIdentityId: "subject-2",
			useContext: "Intro",
			visualWorldId: "world-2",
		})
	);
	expect(await screen.findByText("Varlık Ailesi kaydedildi.")).toBeVisible();
	expect(familyName).toHaveValue("");
	expect(useContext).toHaveValue("");
	expect(screen.getByRole("combobox", { name: "Varlık Kimliği" })).toHaveValue(
		"subject-2"
	);
});

test("blocks a duplicate Asset Family name for the same identity ignoring case", async () => {
	const user = await openSetup();
	await user.type(
		screen.getByRole("textbox", { name: "Varlık Ailesi adı" }),
		"  gameplay "
	);
	await user.type(
		screen.getByRole("textbox", { name: "Kullanım bağlamı" }),
		"x"
	);
	expect(
		screen.getByRole("button", { name: "Varlık Ailesi oluştur" })
	).toBeDisabled();
	await user.selectOptions(
		screen.getByRole("combobox", { name: "Varlık Kimliği" }),
		"subject-2"
	);
	expect(
		screen.getByRole("button", { name: "Varlık Ailesi oluştur" })
	).toBeEnabled();
});

test("creates an Asset Record with the chosen identity criteria", async () => {
	const user = await openSetup();
	const submit = screen.getByRole("button", { name: "Varlık Kaydı ekle" });
	const name = screen.getByRole("textbox", { name: "Varlık Kaydı adı" });
	const independent = screen.getByRole("checkbox", {
		name: "Bağımsız ürün anlamı",
	});
	const delivery = screen.getByRole("checkbox", { name: "Teslimat kimliği" });
	const [recordFamily] = screen.getAllByRole("combobox", {
		name: "Varlık Ailesi",
	});
	expect(recordFamily).toHaveValue("family-1");
	await user.type(name, "Jump");
	expect(submit).toBeDisabled();
	await user.click(independent);
	await user.click(delivery);
	expect(independent).toBeChecked();
	await user.click(independent);
	expect(independent).not.toBeChecked();
	await user.click(independent);
	expect(submit).toBeEnabled();
	await user.click(submit);

	await waitFor(() =>
		expect(fakeApi.createAssetRecord).toHaveBeenCalledWith({
			assetFamilyId: "family-1",
			identityCriteria: ["delivery_identity", "independent_product_meaning"],
			name: "Jump",
			projectId: "project-1",
		})
	);
	expect(await screen.findByText("Varlık Kaydı kaydedildi.")).toBeVisible();
	expect(name).toHaveValue("");
	expect(independent).not.toBeChecked();
	expect(delivery).not.toBeChecked();
});

test("toggles an identity criterion with the Space key", async () => {
	const user = await openSetup();
	const criterion = screen.getByRole("checkbox", {
		name: "Bağımsız yaşam döngüsü",
	});
	criterion.focus();
	await user.keyboard(" ");
	expect(criterion).toBeChecked();
	await user.keyboard(" ");
	expect(criterion).not.toBeChecked();
});

test("blocks a duplicate Asset Record name inside the selected family", async () => {
	const user = await openSetup();
	await user.type(
		screen.getByRole("textbox", { name: "Varlık Kaydı adı" }),
		" idle "
	);
	await user.click(screen.getByRole("checkbox", { name: "Teslimat kimliği" }));
	expect(
		screen.getByRole("button", { name: "Varlık Kaydı ekle" })
	).toBeDisabled();
});

test("creates a relationship between two records of the selected family", async () => {
	const user = await openSetup();
	const submit = screen.getByRole("button", { name: "İlişki ekle" });
	const source = screen.getByRole("combobox", { name: "Kaynak Varlık Kaydı" });
	const target = screen.getByRole("combobox", { name: "İlgili Varlık Kaydı" });
	expect(source).toHaveValue("record-1");
	expect(target).toHaveValue("record-2");
	await user.selectOptions(
		screen.getByRole("combobox", { name: "İlişki türü" }),
		"animation"
	);
	await user.click(submit);

	await waitFor(() =>
		expect(fakeApi.createRelationship).toHaveBeenCalledWith({
			assetFamilyId: "family-1",
			projectId: "project-1",
			sourceAssetRecordId: "record-1",
			targetAssetRecordId: "record-2",
			type: "animation",
		})
	);
	expect(await screen.findByText("İlişki kaydedildi.")).toBeVisible();
});

test("disables the relationship form for a family with fewer than two records", async () => {
	const user = await openSetup();
	const [, relationshipFamily] = screen.getAllByRole("combobox", {
		name: "Varlık Ailesi",
	});
	await user.selectOptions(relationshipFamily as HTMLElement, "family-2");
	expect(screen.getByRole("button", { name: "İlişki ekle" })).toBeDisabled();
	expect(
		screen.getByRole("combobox", { name: "Kaynak Varlık Kaydı" })
	).toBeDisabled();
	await user.selectOptions(relationshipFamily as HTMLElement, "family-1");
	expect(screen.getByRole("button", { name: "İlişki ekle" })).toBeEnabled();
});

test("shows the canonical design as the fixed source of a derivative relationship", async () => {
	const user = await openSetup();
	await user.selectOptions(
		screen.getByRole("combobox", { name: "İlişki türü" }),
		"derivative"
	);
	expect(screen.getByText("Önce onaylı bir Ana Tasarım seçin.")).toBeVisible();
	expect(screen.getByRole("button", { name: "İlişki ekle" })).toBeDisabled();
});
