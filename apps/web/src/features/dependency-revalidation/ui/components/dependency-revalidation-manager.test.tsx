// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type {
	ChangeFacetInput,
	DependencyCatalog,
	DependencyLinkInput,
	DerivativeReReviewInput,
} from "@sprite-anvil/api/dependency-revalidation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { DependencyRevalidationManager } from "./dependency-revalidation-manager";

const reviewedPalettePattern = /Palet güncel Ana Tasarımla uyumlu\./;
const correctionSavedPattern =
	/İçerik düzeltmesi için Aday inceleme kaydı kaydedildi/;

const transport = vi.hoisted(() => ({
	catalog: {
		dependencyLinks: [],
		changeImpacts: [],
		revalidationRequiredVersionIds: [],
		contextRevisions: [],
		reviews: [],
		canonicalDesigns: [],
	} as DependencyCatalog,
	failRead: false,
	failWrite: false,
	lastReview: null as DerivativeReReviewInput | null,
	lastLink: null as DependencyLinkInput | null,
	lastDetermine: null as ChangeFacetInput | null,
}));
vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	const client = {
		dependencyRevalidation: {
			list: () => {
				if (transport.failRead) {
					return Promise.reject(new Error("Read unavailable"));
				}
				return Promise.resolve(structuredClone(transport.catalog));
			},
			reReview: (input: DerivativeReReviewInput) => {
				transport.lastReview = input;
				if (transport.failWrite) {
					return Promise.reject(new Error("Write unavailable"));
				}
				const review = {
					...input,
					id: "review-1",
					createdAt: "2026-10-02T13:00:00.000Z",
				};
				transport.catalog.reviews.push(review);
				if (input.decision === "approved") {
					transport.catalog.revalidationRequiredVersionIds = [];
				}
				return Promise.resolve(review);
			},
			createLink: (input: DependencyLinkInput) => {
				transport.lastLink = input;
				if (transport.failWrite) {
					return Promise.reject(new Error("Write failed"));
				}
				return Promise.resolve({
					...input,
					id: "link-1",
					createdAt: "2026-10-02T11:00:00.000Z",
				});
			},
			determine: (input: {
				projectId: string;
				source: { kind: "canonical_design"; id: string };
				facets: string[];
			}) => {
				transport.lastDetermine = input as ChangeFacetInput;
				if (transport.failWrite) {
					return Promise.reject(new Error("Write failed"));
				}
				const result = {
					...input,
					id: "change-1",
					createdAt: "2026-10-02T12:00:00.000Z",
					affectedVersions: [
						{
							assetVersionId: "east-version",
							assetRecordId: "east",
							status: "revalidation_required" as const,
							reason: "matching_dependency" as const,
							dependencySourceId: "base-version",
						},
					],
				};
				transport.catalog = {
					...transport.catalog,
					changeImpacts: [result],
					revalidationRequiredVersionIds: ["east-version"],
				};
				return Promise.resolve(result);
			},
		},
	};
	return { client, orpc: createTanstackQueryUtils(client as never) };
});

afterEach(() => {
	cleanup();
	transport.catalog = {
		dependencyLinks: [],
		changeImpacts: [],
		revalidationRequiredVersionIds: [],
		contextRevisions: [],
		reviews: [],
		canonicalDesigns: [],
	};
	transport.failRead = false;
	transport.failWrite = false;
	transport.lastReview = null;
	transport.lastLink = null;
	transport.lastDetermine = null;
});

function openManager() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<DependencyRevalidationManager
				canonicalVersionIds={["base-version"]}
				projectId="project-1"
				records={[
					{ id: "base", name: "Ash Knight base" },
					{ id: "east", name: "Ash Knight east" },
				]}
				versions={[
					{
						id: "base-version",
						assetRecordId: "base",
						versionNumber: 1,
						sourceKind: "manual_import",
					},
					{
						id: "east-version",
						assetRecordId: "east",
						assetFamilyId: "family-1",
						reviewDisposition: "approved",
						versionNumber: 1,
						sourceKind: "derived",
					},
				]}
			/>
		</QueryClientProvider>
	);
}

test("user confirms a palette Change Facet and sees persisted Revalidation Required after reopening", async () => {
	const view = openManager();
	await screen.findByLabelText("Değişen kaynak");
	fireEvent.change(screen.getByLabelText("Değişen kaynak"), {
		target: { value: "base-version" },
	});
	const changeGroup = screen.getByRole("group", { name: "Değişen özellikler" });
	fireEvent.click(within(changeGroup).getByRole("checkbox", { name: "Palet" }));
	fireEvent.click(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	);
	await screen.findByText("Değişiklik etkisi kaydedildi.");
	expect(
		screen.getByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).toBeInTheDocument();
	view.unmount();
	openManager();
	expect(
		await screen.findByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).toBeInTheDocument();
});

test("a catalog error disables mutation and exposes a retry control", async () => {
	transport.failRead = true;
	openManager();
	await screen.findByRole("alert");
	expect(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	).toBeDisabled();
	transport.failRead = false;
	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));
	await waitFor(() =>
		expect(screen.queryByRole("alert")).not.toBeInTheDocument()
	);
});

test("a failed write requires a persisted status check before another mutation", async () => {
	transport.failWrite = true;
	openManager();
	await screen.findByLabelText("Değişen kaynak");
	fireEvent.change(screen.getByLabelText("Değişen kaynak"), {
		target: { value: "base-version" },
	});
	const changeGroup = screen.getByRole("group", { name: "Değişen özellikler" });
	fireEvent.click(within(changeGroup).getByRole("checkbox", { name: "Palet" }));
	fireEvent.click(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	);
	await screen.findByText(
		"İşlem tamamlanamadı veya sonucu doğrulanamadı. Yeniden kaydetmeden önce durumu kontrol edin."
	);
	expect(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	).toBeDisabled();
	expect(
		screen.queryByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).not.toBeInTheDocument();
	transport.failWrite = false;
	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
		).toBeEnabled()
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	);
	expect(
		await screen.findByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).toBeInTheDocument();
});

test("the Dependency Link target only offers Derivative versions", async () => {
	openManager();
	const targetSelect = await screen.findByLabelText("Türetilmiş Varlık Sürümü");
	const values = within(targetSelect)
		.getAllByRole("option")
		.map((option) => option.getAttribute("value"));
	expect(values).toEqual(["", "east-version"]);
});

test("persisted Dependency Links show their source and target versions", async () => {
	transport.catalog = {
		...transport.catalog,
		dependencyLinks: [
			{
				id: "link-1",
				projectId: "project-1",
				source: { kind: "asset_version", id: "base-version" },
				targetAssetVersionId: "east-version",
				facets: ["palette"],
				createdAt: "2026-10-02T11:00:00.000Z",
			},
		],
	};
	openManager();
	expect(
		await screen.findByText(
			"Ash Knight base · v1 → Ash Knight east · v1: Palet"
		)
	).toBeInTheDocument();
});

async function openAffectedDerivative() {
	transport.catalog.contextRevisions = [
		{ id: "context-1", revisionNumber: 2, isActive: true },
	];
	transport.catalog.canonicalDesigns = [
		{ assetFamilyId: "family-1", assetVersionId: "base-version" },
	];
	const view = openManager();
	await screen.findByLabelText("Değişen kaynak");
	fireEvent.change(screen.getByLabelText("Değişen kaynak"), {
		target: { value: "base-version" },
	});
	fireEvent.click(
		within(screen.getByRole("group", { name: "Değişen özellikler" })).getByRole(
			"checkbox",
			{ name: "Palet" }
		)
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	);
	await screen.findByText("Değişiklik etkisi kaydedildi.");
	return view;
}

function selectReReviewScope() {
	fireEvent.change(screen.getByLabelText("İncelenen Bağlam Sürümü"), {
		target: { value: "context-1" },
	});
	fireEvent.change(screen.getByLabelText("İncelenen Ana Tasarım"), {
		target: { value: "base-version" },
	});
	fireEvent.change(screen.getByLabelText("Yeniden inceleme gerekçesi"), {
		target: { value: "Palet güncel Ana Tasarımla uyumlu." },
	});
}

test("user re-reviews the exact affected Derivative and reads its new Review Event after reopening", async () => {
	const view = await openAffectedDerivative();
	selectReReviewScope();
	fireEvent.click(
		screen.getByRole("button", { name: "Güncel Uygunluğu Onayla" })
	);
	await screen.findByText(
		"Güncel uygunluk için yeni İnceleme Kaydı kaydedildi."
	);
	expect(transport.lastReview).toEqual({
		projectId: "project-1",
		assetVersionId: "east-version",
		contextRevisionId: "context-1",
		canonicalDesignVersionId: "base-version",
		changeImpactIds: ["change-1"],
		decision: "approved",
		rationale: "Palet güncel Ana Tasarımla uyumlu.",
	});
	view.unmount();
	openManager();
	expect(await screen.findByText(reviewedPalettePattern)).toBeInTheDocument();
	expect(
		screen.queryByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).not.toBeInTheDocument();
});

test("content correction preserves Revalidation Required and leads to immutable version preparation", async () => {
	const view = await openAffectedDerivative();
	selectReReviewScope();
	fireEvent.click(
		screen.getByRole("button", { name: "İçerik Düzeltmesi Gerekli" })
	);
	await screen.findByText(correctionSavedPattern);
	expect(transport.lastReview?.decision).toBe("candidate");
	view.unmount();
	openManager();
	expect(
		await screen.findByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).toBeInTheDocument();
	expect(
		screen.getByRole("link", { name: "Birim veya Birleşik Sürüm Hazırla" })
	).toHaveAttribute("href", "#asset-version-controls-heading");
});

test("a failed re-review preserves the applicability blocker and requires a status check", async () => {
	await openAffectedDerivative();
	selectReReviewScope();
	transport.failWrite = true;
	fireEvent.click(
		screen.getByRole("button", { name: "Güncel Uygunluğu Onayla" })
	);
	await screen.findByText(
		"İşlem tamamlanamadı veya sonucu doğrulanamadı. Yeniden kaydetmeden önce durumu kontrol edin."
	);
	expect(
		screen.getByRole("button", { name: "Güncel Uygunluğu Onayla" })
	).toBeDisabled();
	expect(
		screen.getByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).toBeInTheDocument();
	transport.failWrite = false;
	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Güncel Uygunluğu Onayla" })
		).toBeEnabled()
	);
	expect(transport.catalog.reviews).toEqual([]);
});

test("missing current context or family Canonical Design prevents re-review", async () => {
	const view = await openAffectedDerivative();
	transport.catalog.contextRevisions = [];
	transport.catalog.canonicalDesigns = [];
	view.unmount();
	openManager();
	await screen.findByText(
		"Yeniden inceleme için etkin Bağlam Sürümü ve ailenin güncel Ana Tasarımı gereklidir."
	);
	expect(
		screen.getByRole("button", { name: "Güncel Uygunluğu Onayla" })
	).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "İçerik Düzeltmesi Gerekli" })
	).toBeDisabled();
});

test("a Dependency Link saves the exact source, Derivative target and selected facets", async () => {
	const user = userEvent.setup();
	openManager();
	const save = await screen.findByRole("button", {
		name: "Bağımlılık Bağlantısını Kaydet",
	});
	await waitFor(() =>
		expect(screen.getByLabelText("Bağımlılık kaynağı")).toBeEnabled()
	);
	expect(save).toBeDisabled();
	await user.selectOptions(
		screen.getByLabelText("Bağımlılık kaynağı"),
		"base-version"
	);
	expect(save).toBeDisabled();
	await user.selectOptions(
		screen.getByLabelText("Türetilmiş Varlık Sürümü"),
		"east-version"
	);
	expect(save).toBeEnabled();
	const linkGroup = screen.getByRole("group", { name: "Bağımlı özellikler" });
	const identity = within(linkGroup).getByRole("checkbox", { name: "Kimlik" });
	await user.click(identity);
	expect(identity).toBeChecked();
	await user.type(
		within(linkGroup).getByLabelText("Diğer özellik"),
		"  pelerin  "
	);
	await user.click(save);
	await screen.findByText("Bağımlılık Bağlantısı kaydedildi.");
	expect(transport.lastLink).toEqual({
		projectId: "project-1",
		source: { kind: "asset_version", id: "base-version" },
		targetAssetVersionId: "east-version",
		facets: ["identity", "pelerin"],
	});
});

test("changing the Dependency Link source kind clears the chosen source", async () => {
	const user = userEvent.setup();
	transport.catalog.contextRevisions = [
		{ id: "context-1", revisionNumber: 2, isActive: true },
	];
	openManager();
	await waitFor(() =>
		expect(screen.getByLabelText("Bağımlılık kaynağı")).toBeEnabled()
	);
	await user.selectOptions(
		screen.getByLabelText("Bağımlılık kaynağı"),
		"base-version"
	);
	await user.selectOptions(
		screen.getByLabelText("Bağımlılık kaynak türü"),
		"context_revision"
	);
	expect(screen.getByLabelText("Bağımlılık kaynağı")).toHaveValue("");
	await user.selectOptions(
		screen.getByLabelText("Bağımlılık kaynağı"),
		"context-1"
	);
	await user.selectOptions(
		screen.getByLabelText("Türetilmiş Varlık Sürümü"),
		"east-version"
	);
	await user.click(
		screen.getByRole("button", { name: "Bağımlılık Bağlantısını Kaydet" })
	);
	await screen.findByText("Bağımlılık Bağlantısı kaydedildi.");
	expect(transport.lastLink).toEqual({
		projectId: "project-1",
		source: { kind: "context_revision", id: "context-1" },
		targetAssetVersionId: "east-version",
		facets: [],
	});
});

test("a Change Facet needs a source and at least one non-blank facet", async () => {
	const user = userEvent.setup();
	openManager();
	await waitFor(() =>
		expect(screen.getByLabelText("Değişen kaynak")).toBeEnabled()
	);
	const determine = screen.getByRole("button", {
		name: "Değişiklik Etkisini Belirle",
	});
	await user.selectOptions(
		screen.getByLabelText("Değişen kaynak"),
		"base-version"
	);
	expect(determine).toBeDisabled();
	const changeGroup = screen.getByRole("group", { name: "Değişen özellikler" });
	const other = within(changeGroup).getByLabelText("Diğer özellik");
	await user.type(other, "   ");
	expect(determine).toBeDisabled();
	await user.type(other, "kask");
	expect(determine).toBeEnabled();
	await user.click(determine);
	await screen.findByText("Değişiklik etkisi kaydedildi.");
	expect(transport.lastDetermine).toEqual({
		projectId: "project-1",
		source: { kind: "canonical_design", id: "base-version" },
		facets: ["kask"],
	});
});

test("an uncertain write locks the facet checkboxes until the status check", async () => {
	const user = userEvent.setup();
	transport.failWrite = true;
	openManager();
	await waitFor(() =>
		expect(screen.getByLabelText("Değişen kaynak")).toBeEnabled()
	);
	await user.selectOptions(
		screen.getByLabelText("Değişen kaynak"),
		"base-version"
	);
	const changeGroup = screen.getByRole("group", { name: "Değişen özellikler" });
	await user.click(
		within(changeGroup).getByRole("checkbox", { name: "Palet" })
	);
	await user.click(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	);
	await screen.findByText(
		"İşlem tamamlanamadı veya sonucu doğrulanamadı. Yeniden kaydetmeden önce durumu kontrol edin."
	);
	const theme = within(changeGroup).getByRole("checkbox", { name: "Tema" });
	await user.click(theme);
	expect(theme).not.toBeChecked();
});

test("re-review stays unavailable for a blank rationale and saves a trimmed candidate decision", async () => {
	const user = userEvent.setup();
	await openAffectedDerivative();
	await user.selectOptions(
		screen.getByLabelText("İncelenen Bağlam Sürümü"),
		"context-1"
	);
	await user.selectOptions(
		screen.getByLabelText("İncelenen Ana Tasarım"),
		"base-version"
	);
	const rationale = screen.getByLabelText("Yeniden inceleme gerekçesi");
	await user.type(rationale, "   ");
	expect(
		screen.getByRole("button", { name: "Güncel Uygunluğu Onayla" })
	).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "İçerik Düzeltmesi Gerekli" })
	).toBeDisabled();
	await user.type(rationale, "Kask silueti bozuk.  ");
	await user.click(
		screen.getByRole("button", { name: "İçerik Düzeltmesi Gerekli" })
	);
	await screen.findByText(correctionSavedPattern);
	expect(transport.lastReview).toEqual({
		projectId: "project-1",
		assetVersionId: "east-version",
		contextRevisionId: "context-1",
		canonicalDesignVersionId: "base-version",
		changeImpactIds: ["change-1"],
		decision: "candidate",
		rationale: "Kask silueti bozuk.",
	});
});
