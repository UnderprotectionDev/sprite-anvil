// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import { render as baseRender, cleanup, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { BatchReviewControls } from "./batch-review-controls";

const previewBatchReview = vi.fn();
vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	const client = {
		assetVersions: {
			previewBatchReview: (...args: unknown[]) => previewBatchReview(...args),
		},
	};
	return { client, orpc: createTanstackQueryUtils(client as never) };
});
const queryClient = createQueryClient();
function render(node: ReactElement) {
	return baseRender(
		<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
	);
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

test("confirms the previewed versions and retains the same request key after an unsuccessful write", async () => {
	const user = userEvent.setup();
	const onReview = vi
		.fn()
		.mockResolvedValueOnce(false)
		.mockResolvedValueOnce(true);
	previewBatchReview.mockResolvedValue({
		items: [
			{
				assetVersionId: "one",
				expectedReviewEventId: "previous-review",
				blockers: [],
			},
			{ assetVersionId: "two", expectedReviewEventId: null, blockers: [] },
		],
	});
	render(
		<BatchReviewControls
			onReview={onReview}
			projectId="project"
			versions={[
				{ id: "one", name: "Knight · Sürüm 1" },
				{ id: "two", name: "Shield · Sürüm 2" },
			]}
			writesDisabled={false}
		/>
	);
	await user.click(screen.getByRole("checkbox", { name: "Knight · Sürüm 1" }));
	await user.click(screen.getByRole("checkbox", { name: "Shield · Sürüm 2" }));
	await user.type(
		screen.getByLabelText("Toplu inceleme gerekçesi"),
		"Reviewed both versions"
	);
	await user.click(
		screen.getByRole("button", { name: "Uygunluk ve engelleri göster" })
	);
	await user.click(
		await screen.findByRole("button", { name: "Kararları kaydet" })
	);
	await user.click(screen.getByRole("button", { name: "Kararları kaydet" }));
	expect(onReview.mock.calls[1]?.[0]).toEqual(onReview.mock.calls[0]?.[0]);
	expect(onReview.mock.calls[0]?.[0]).toMatchObject({
		projectId: "project",
		decision: "approved",
		rationale: "Reviewed both versions",
		targets: [
			{ assetVersionId: "one", expectedReviewEventId: "previous-review" },
			{ assetVersionId: "two", expectedReviewEventId: null },
		],
	});
	expect(
		screen.getByRole("checkbox", { name: "Knight · Sürüm 1" })
	).not.toBeChecked();
});

test("shows every selected version and blocks confirmation without silently skipping", async () => {
	const user = userEvent.setup();
	const reviewBatch = vi.fn();
	previewBatchReview.mockResolvedValue({
		items: [
			{ assetVersionId: "one", expectedReviewEventId: null, blockers: [] },
			{
				assetVersionId: "two",
				expectedReviewEventId: null,
				blockers: ["Required evidence missing"],
			},
		],
	});
	render(
		<BatchReviewControls
			onReview={reviewBatch}
			projectId="project"
			versions={[
				{ id: "one", name: "Knight · Sürüm 1" },
				{ id: "two", name: "Shield · Sürüm 2" },
			]}
			writesDisabled={false}
		/>
	);
	await user.click(screen.getByRole("checkbox", { name: "Knight · Sürüm 1" }));
	await user.click(screen.getByRole("checkbox", { name: "Shield · Sürüm 2" }));
	await user.type(
		screen.getByLabelText("Toplu inceleme gerekçesi"),
		"Reviewed both versions"
	);
	await user.click(
		screen.getByRole("button", { name: "Uygunluk ve engelleri göster" })
	);
	expect(
		await screen.findByText("Required evidence missing")
	).toBeInTheDocument();
	expect(
		screen.getByRole("button", { name: "Kararları kaydet" })
	).toBeDisabled();
	await user.click(screen.getByRole("button", { name: "Önizlemeyi iptal et" }));
	expect(reviewBatch).not.toHaveBeenCalled();
});

test("toggles versions from the keyboard and clears the preview when the decision changes", async () => {
	const user = userEvent.setup();
	previewBatchReview.mockResolvedValue({
		items: [
			{ assetVersionId: "one", expectedReviewEventId: null, blockers: [] },
		],
	});
	render(
		<BatchReviewControls
			onReview={vi.fn()}
			projectId="project"
			versions={[
				{ id: "one", name: "Knight · Sürüm 1" },
				{ id: "two", name: "Shield · Sürüm 2" },
			]}
			writesDisabled={false}
		/>
	);
	const knight = screen.getByRole("checkbox", { name: "Knight · Sürüm 1" });
	const showPreview = screen.getByRole("button", {
		name: "Uygunluk ve engelleri göster",
	});
	expect(knight).not.toBeChecked();
	knight.focus();
	expect(knight).toHaveFocus();
	await user.keyboard(" ");
	expect(knight).toBeChecked();
	await user.type(screen.getByLabelText("Toplu inceleme gerekçesi"), "   ");
	expect(showPreview).toBeDisabled();
	await user.type(screen.getByLabelText("Toplu inceleme gerekçesi"), "ok");
	expect(showPreview).toBeEnabled();

	await user.click(showPreview);
	expect(
		await screen.findByRole("button", { name: "Kararları kaydet" })
	).toBeInTheDocument();
	expect(previewBatchReview).toHaveBeenCalledWith(
		{
			projectId: "project",
			assetVersionIds: ["one"],
			decision: "approved",
		},
		expect.anything()
	);

	await user.selectOptions(
		screen.getByLabelText("Toplu inceleme kararı"),
		"rejected"
	);
	expect(screen.queryByRole("button", { name: "Kararları kaydet" })).toBeNull();
	await user.click(showPreview);
	await screen.findByRole("button", { name: "Kararları kaydet" });
	expect(previewBatchReview).toHaveBeenLastCalledWith(
		{
			projectId: "project",
			assetVersionIds: ["one"],
			decision: "rejected",
		},
		expect.anything()
	);

	await user.keyboard("{Tab}");
	knight.focus();
	await user.keyboard(" ");
	expect(knight).not.toBeChecked();
	expect(screen.queryByRole("button", { name: "Kararları kaydet" })).toBeNull();
});

test("disables every batch review control while writes are disabled", () => {
	render(
		<BatchReviewControls
			onReview={vi.fn()}
			projectId="project"
			versions={[{ id: "one", name: "Knight · Sürüm 1" }]}
			writesDisabled
		/>
	);
	expect(
		screen.getByRole("checkbox", { name: "Knight · Sürüm 1" })
	).toHaveAttribute("aria-disabled", "true");
	expect(screen.getByLabelText("Toplu inceleme kararı")).toBeDisabled();
	expect(screen.getByLabelText("Toplu inceleme gerekçesi")).toBeDisabled();
	expect(
		screen.getByRole("group", { name: "Toplu inceleme" })
	).toBeInTheDocument();
});
