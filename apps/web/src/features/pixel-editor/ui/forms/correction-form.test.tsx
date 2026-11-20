// @vitest-environment jsdom

import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { CorrectionForm } from "./correction-form";

const { mutateAsync } = vi.hoisted(() => ({
	mutateAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../hooks/use-prepare-correction", () => ({
	usePrepareCorrection: () => ({
		keptUnitIds: [],
		prepare: { mutateAsync },
		units: [],
	}),
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const draft: PixelDraft = {
	appliedOperationCount: 0,
	assetRecordId: "22222222-2222-4222-8222-222222222222",
	canRedo: false,
	canUndo: false,
	committedAssetVersionId: null,
	diff: { boundingBox: null, changedPixelCount: 0, sizeChanged: false },
	id: "33333333-3333-4333-8333-333333333333",
	operations: [],
	outOfPaletteColors: [],
	palette: { colors: [], origin: "source-image" },
	previewUrl: "/preview",
	projectId,
	revision: 7,
	size: { height: 16, width: 32 },
	sourceAssetVersionId: "44444444-4444-4444-8444-444444444444",
	sourcePreviewUrl: "/source",
	sourceSize: { height: 16, width: 32 },
	status: "open",
	updatedAt: "2026-01-01T00:00:00.000Z",
	usedColors: [],
};

afterEach(() => {
	cleanup();
	mutateAsync.mockClear();
});

test("surfaces an invalid correction region and sends the normalized package after correction", async () => {
	render(
		<CorrectionForm
			disabled={false}
			draft={draft}
			projectId={projectId}
			selection={null}
		/>
	);
	const left = screen.getByLabelText("Left (x)");
	const submit = screen.getByRole("button", {
		name: "Prepare Production Package",
	});
	fireEvent.change(screen.getByLabelText("Issue note"), {
		target: { value: " " },
	});
	await userEvent.click(submit);
	expect(await screen.findByText("Describe the issue.")).toBeTruthy();
	expect(mutateAsync).not.toHaveBeenCalled();

	fireEvent.change(screen.getByLabelText("Issue note"), {
		target: { value: "  Sword tip is clipped  " },
	});
	fireEvent.change(left, { target: { value: " " } });
	await userEvent.click(submit);
	expect(await screen.findByRole("alert")).toBeTruthy();
	expect(mutateAsync).not.toHaveBeenCalled();

	fireEvent.change(left, { target: { value: "2" } });
	await userEvent.click(submit);
	await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
	expect(mutateAsync).toHaveBeenCalledWith(
		expect.objectContaining({
			correction: expect.objectContaining({
				annotations: [],
				issueNote: "Sword tip is clipped",
				redrawRegion: { height: 16, width: 32, x: 2, y: 0 },
				targetUnitVersionId: null,
			}),
			projectId,
			targetTask: "Sword tip is clipped",
		})
	);
});
