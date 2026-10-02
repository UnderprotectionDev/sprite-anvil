// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { BatchReviewControls } from "./batch-review-controls";

const previewBatchReview = vi.fn();
vi.mock("@/utils/orpc", () => ({
	client: {
		assetVersions: {
			previewBatchReview: (...args: unknown[]) => previewBatchReview(...args),
		},
	},
}));
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
	await user.click(screen.getByLabelText("Knight · Sürüm 1"));
	await user.click(screen.getByLabelText("Shield · Sürüm 2"));
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
	expect(screen.getByLabelText("Knight · Sürüm 1")).not.toBeChecked();
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
	await user.click(screen.getByLabelText("Knight · Sürüm 1"));
	await user.click(screen.getByLabelText("Shield · Sürüm 2"));
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
