// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SlicingForm } from "./slicing-form";

const fieldLabel = /^Cell width \(px\)/u;
const numberError = /Use whole numbers/iu;

afterEach(cleanup);

test("invalid slicing previews explain the error and recover after correction", async () => {
	const preview = vi.fn();
	render(
		<SlicingForm
			disabled={false}
			initial={{
				cellWidth: 16,
				cellHeight: 16,
				columns: 2,
				rows: 2,
				offsetX: 0,
				offsetY: 0,
				gapX: 0,
				gapY: 0,
				readingOrder: "rows-left-to-right",
			}}
			onApply={vi.fn()}
			onPreview={preview}
		/>
	);
	fireEvent.change(screen.getByLabelText(fieldLabel), {
		target: { value: "invalid" },
	});
	await userEvent.click(
		screen.getByRole("button", { name: "Preview slicing" })
	);
	expect(preview).not.toHaveBeenCalled();
	expect(await screen.findByText(numberError)).toBeTruthy();

	expect(screen.getByLabelText(fieldLabel).getAttribute("aria-invalid")).toBe(
		"true"
	);
	fireEvent.change(screen.getByLabelText(fieldLabel), {
		target: { value: "8" },
	});
	await userEvent.click(
		screen.getByRole("button", { name: "Preview slicing" })
	);
	expect(preview).toHaveBeenCalledTimes(1);
});
