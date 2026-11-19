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
import { DependencyRevalidationManager } from "@/components/dependency-revalidation-manager";

const reviewedPalettePattern = /Palet güncel Ana Tasarımla uyumlu\./u;
const correctionSavedPattern =
	/Candidate review record saved for content correction/u;

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
	await screen.findByLabelText("Changed source");
	fireEvent.change(screen.getByLabelText("Changed source"), {
		target: { value: "base-version" },
	});
	const changeGroup = screen.getByRole("group", { name: "Changed features" });
	fireEvent.click(
		within(changeGroup).getByRole("checkbox", { name: "Palette" })
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Determine Change Impact" })
	);
	await screen.findByText("Change Impact saved.");
	expect(
		screen.getByText("Ash Knight east · v1: Revalidation Required")
	).toBeInTheDocument();
	view.unmount();
	openManager();
	expect(
		await screen.findByText("Ash Knight east · v1: Revalidation Required")
	).toBeInTheDocument();
});

test("a catalog error disables mutation and exposes a retry control", async () => {
	transport.failRead = true;
	openManager();
	await screen.findByRole("alert");
	expect(
		screen.getByRole("button", { name: "Determine Change Impact" })
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
	await screen.findByLabelText("Changed source");
	fireEvent.change(screen.getByLabelText("Changed source"), {
		target: { value: "base-version" },
	});
	const changeGroup = screen.getByRole("group", { name: "Changed features" });
	fireEvent.click(
		within(changeGroup).getByRole("checkbox", { name: "Palette" })
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Determine Change Impact" })
	);
	await screen.findByText(
		"The operation could not be completed or verified. Check the status before saving again."
	);
	expect(
		screen.getByRole("button", { name: "Determine Change Impact" })
	).toBeDisabled();
	expect(
		screen.queryByText("Ash Knight east · v1: Revalidation Required")
	).not.toBeInTheDocument();
	transport.failWrite = false;
	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Determine Change Impact" })
		).toBeEnabled()
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Determine Change Impact" })
	);
	expect(
		await screen.findByText("Ash Knight east · v1: Revalidation Required")
	).toBeInTheDocument();
});

test("the Dependency Link target only offers Derivative versions", async () => {
	openManager();
	const targetSelect = await screen.findByLabelText("Derived Asset Version");
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
			"Ash Knight base · v1 → Ash Knight east · v1: Palette"
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
	await screen.findByLabelText("Changed source");
	fireEvent.change(screen.getByLabelText("Changed source"), {
		target: { value: "base-version" },
	});
	fireEvent.click(
		within(screen.getByRole("group", { name: "Changed features" })).getByRole(
			"checkbox",
			{ name: "Palette" }
		)
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Determine Change Impact" })
	);
	await screen.findByText("Change Impact saved.");
	return view;
}

function selectReReviewScope() {
	fireEvent.change(screen.getByLabelText("Reviewed Context Revision"), {
		target: { value: "context-1" },
	});
	fireEvent.change(screen.getByLabelText("Reviewed Canonical Design"), {
		target: { value: "base-version" },
	});
	fireEvent.change(screen.getByLabelText("Re-review rationale"), {
		target: { value: "Palet güncel Ana Tasarımla uyumlu." },
	});
}

test("user re-reviews the exact affected Derivative and reads its new Review Event after reopening", async () => {
	const view = await openAffectedDerivative();
	selectReReviewScope();
	fireEvent.click(
		screen.getByRole("button", { name: "Confirm Current Applicability" })
	);
	await screen.findByText("New Review Record saved for current applicability.");
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
		screen.queryByText("Ash Knight east · v1: Revalidation Required")
	).not.toBeInTheDocument();
});

test("content correction preserves Revalidation Required and leads to immutable version preparation", async () => {
	const view = await openAffectedDerivative();
	selectReReviewScope();
	fireEvent.click(
		screen.getByRole("button", { name: "Content Correction Required" })
	);
	await screen.findByText(correctionSavedPattern);
	expect(transport.lastReview?.decision).toBe("candidate");
	view.unmount();
	openManager();
	expect(
		await screen.findByText("Ash Knight east · v1: Revalidation Required")
	).toBeInTheDocument();
	expect(
		screen.getByRole("link", { name: "Prepare Unit or Composite Version" })
	).toHaveAttribute("href", "#asset-version-controls-heading");
});

test("a failed re-review preserves the applicability blocker and requires a status check", async () => {
	await openAffectedDerivative();
	selectReReviewScope();
	transport.failWrite = true;
	fireEvent.click(
		screen.getByRole("button", { name: "Confirm Current Applicability" })
	);
	await screen.findByText(
		"The operation could not be completed or verified. Check the status before saving again."
	);
	expect(
		screen.getByRole("button", { name: "Confirm Current Applicability" })
	).toBeDisabled();
	expect(
		screen.getByText("Ash Knight east · v1: Revalidation Required")
	).toBeInTheDocument();
	transport.failWrite = false;
	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Confirm Current Applicability" })
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
		"Re-review requires the Active Context Revision and the family's current Canonical Design."
	);
	expect(
		screen.getByRole("button", { name: "Confirm Current Applicability" })
	).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Content Correction Required" })
	).toBeDisabled();
});

test("a Dependency Link saves the exact source, Derivative target and selected facets", async () => {
	const user = userEvent.setup();
	openManager();
	const save = await screen.findByRole("button", {
		name: "Save Dependency Link",
	});
	await waitFor(() =>
		expect(screen.getByLabelText("Dependency source")).toBeEnabled()
	);
	expect(save).toBeDisabled();
	await user.selectOptions(
		screen.getByLabelText("Dependency source"),
		"base-version"
	);
	expect(save).toBeDisabled();
	await user.selectOptions(
		screen.getByLabelText("Derived Asset Version"),
		"east-version"
	);
	expect(save).toBeEnabled();
	const linkGroup = screen.getByRole("group", { name: "Dependent features" });
	const identity = within(linkGroup).getByRole("checkbox", {
		name: "Identity",
	});
	await user.click(identity);
	expect(identity).toBeChecked();
	await user.type(
		within(linkGroup).getByLabelText("Other feature"),
		"  pelerin  "
	);
	await user.click(save);
	await screen.findByText("Dependency Link saved.");
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
		expect(screen.getByLabelText("Dependency source")).toBeEnabled()
	);
	await user.selectOptions(
		screen.getByLabelText("Dependency source"),
		"base-version"
	);
	await user.selectOptions(
		screen.getByLabelText("Dependency source type"),
		"context_revision"
	);
	expect(screen.getByLabelText("Dependency source")).toHaveValue("");
	await user.selectOptions(
		screen.getByLabelText("Dependency source"),
		"context-1"
	);
	await user.selectOptions(
		screen.getByLabelText("Derived Asset Version"),
		"east-version"
	);
	await user.click(
		screen.getByRole("button", { name: "Save Dependency Link" })
	);
	await screen.findByText("Dependency Link saved.");
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
		expect(screen.getByLabelText("Changed source")).toBeEnabled()
	);
	const determine = screen.getByRole("button", {
		name: "Determine Change Impact",
	});
	await user.selectOptions(
		screen.getByLabelText("Changed source"),
		"base-version"
	);
	expect(determine).toBeDisabled();
	const changeGroup = screen.getByRole("group", { name: "Changed features" });
	const other = within(changeGroup).getByLabelText("Other feature");
	await user.type(other, "   ");
	expect(determine).toBeDisabled();
	await user.type(other, "kask");
	expect(determine).toBeEnabled();
	await user.click(determine);
	await screen.findByText("Change Impact saved.");
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
		expect(screen.getByLabelText("Changed source")).toBeEnabled()
	);
	await user.selectOptions(
		screen.getByLabelText("Changed source"),
		"base-version"
	);
	const changeGroup = screen.getByRole("group", { name: "Changed features" });
	await user.click(
		within(changeGroup).getByRole("checkbox", { name: "Palette" })
	);
	await user.click(
		screen.getByRole("button", { name: "Determine Change Impact" })
	);
	await screen.findByText(
		"The operation could not be completed or verified. Check the status before saving again."
	);
	const theme = within(changeGroup).getByRole("checkbox", { name: "Theme" });
	await user.click(theme);
	expect(theme).not.toBeChecked();
});

test("re-review stays unavailable for a blank rationale and saves a trimmed candidate decision", async () => {
	const user = userEvent.setup();
	await openAffectedDerivative();
	await user.selectOptions(
		screen.getByLabelText("Reviewed Context Revision"),
		"context-1"
	);
	await user.selectOptions(
		screen.getByLabelText("Reviewed Canonical Design"),
		"base-version"
	);
	const rationale = screen.getByLabelText("Re-review rationale");
	await user.type(rationale, "   ");
	expect(
		screen.getByRole("button", { name: "Confirm Current Applicability" })
	).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Content Correction Required" })
	).toBeDisabled();
	await user.type(rationale, "Kask silueti bozuk.  ");
	await user.click(
		screen.getByRole("button", { name: "Content Correction Required" })
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
