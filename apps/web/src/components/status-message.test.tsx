// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { StatusMessage } from "./status-message";

afterEach(cleanup);

test("an error is announced assertively with a visible name and text", () => {
	render(
		<StatusMessage tone="error">Review could not be saved.</StatusMessage>
	);
	const alert = screen.getByRole("alert");
	expect(alert).toHaveTextContent("Error");
	expect(alert).toHaveTextContent("Review could not be saved.");
	expect(alert).toHaveAttribute("aria-live", "assertive");
});

test.each([
	["warning", "Warning"],
	["success", "Success"],
	["info", "Note"],
] as const)(
	"%s is announced politely and names itself in text",
	(tone, label) => {
		render(<StatusMessage tone={tone}>Check complete.</StatusMessage>);
		const status = screen.getByRole("status");
		expect(status).toHaveTextContent(label);
		expect(status).toHaveAttribute("aria-live", "polite");
		expect(screen.queryByRole("alert")).toBeNull();
	}
);

test("a support reference is shown as text, not as a color or tooltip", () => {
	render(
		<StatusMessage supportReference="SUP-123" tone="error">
			The result could not be confirmed.
		</StatusMessage>
	);
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Support reference: SUP-123"
	);
});

test("tones that share a color family stay distinguishable by label alone", () => {
	const labels = (["error", "warning", "success", "info"] as const).map(
		(tone) => {
			const view = render(<StatusMessage tone={tone}>x</StatusMessage>);
			const text = (
				view.container.querySelector(
					"[data-slot='status-label']"
				) as HTMLElement
			).textContent;
			view.unmount();
			return text;
		}
	);
	expect(new Set(labels).size).toBe(4);
});
