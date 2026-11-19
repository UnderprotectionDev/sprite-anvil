// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { FrameSettingsForm } from "./frame-settings-form";

const fieldLabel = /^Duration \(ms\)/u;
const numberError = /whole numbers/iu;

afterEach(cleanup);

test("invalid frame duration explains the error and recovers after correction", async () => {
	const edit = vi.fn();
	const frame = {
		key: "frame-1",
		index: 0,
		origin: { kind: "blank" as const },
		editCount: 0,
		status: "new" as const,
		unitVersionId: null,
		previewUrl: "data:image/png;base64,",
		durationMs: 100,
		offsetX: 0,
		offsetY: 0,
		pivotX: 0,
		pivotY: 0,
		keep: false,
		issue: false,
	};
	render(<FrameSettingsForm disabled={false} frame={frame} onEdit={edit} />);
	fireEvent.change(screen.getByLabelText(fieldLabel), {
		target: { value: "invalid" },
	});
	await userEvent.click(
		screen.getByRole("button", { name: "Apply frame values" })
	);
	await waitFor(() =>
		expect(screen.getByLabelText(fieldLabel).getAttribute("aria-invalid")).toBe(
			"true"
		)
	);
	expect(edit).not.toHaveBeenCalled();
	expect(await screen.findByText(numberError)).toBeTruthy();
	fireEvent.change(screen.getByLabelText(fieldLabel), {
		target: { value: "150" },
	});
	await userEvent.click(
		screen.getByRole("button", { name: "Apply frame values" })
	);
	expect(edit).toHaveBeenCalledTimes(1);
});
