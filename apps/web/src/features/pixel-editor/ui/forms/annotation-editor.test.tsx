// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { AnnotationEditor } from "./annotation-editor";

const fieldLabel = /^From x/;
const numberError = /whole numbers/i;

afterEach(cleanup);

test("invalid annotation coordinates explain the error and recover after correction", async () => {
	const add = vi.fn();
	render(<AnnotationEditor entries={[]} onAdd={add} onRemove={vi.fn()} />);
	fireEvent.change(screen.getByLabelText(fieldLabel), {
		target: { value: "invalid" },
	});
	await userEvent.click(screen.getByRole("button", { name: "Add annotation" }));
	expect(add).not.toHaveBeenCalled();
	expect(await screen.findByText(numberError)).toBeTruthy();
	expect(screen.getByLabelText(fieldLabel).getAttribute("aria-invalid")).toBe(
		"true"
	);
	fireEvent.change(screen.getByLabelText(fieldLabel), {
		target: { value: "1" },
	});
	await userEvent.click(screen.getByRole("button", { name: "Add annotation" }));
	expect(add).toHaveBeenCalledTimes(1);
});
