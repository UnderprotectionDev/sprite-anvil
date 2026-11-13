// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test } from "vitest";
import { StatusMessage, WriteOutcomeMessage } from "./status-message";

const blindRetryPattern = /not saved|try again/i;
const savedExactly = /^Saved\.$/;

afterEach(cleanup);

test("an error is announced assertively with a visible name and text", () => {
	render(
		<StatusMessage tone="error">Review could not be saved.</StatusMessage>
	);
	const alert = screen.getByRole("alert");
	expect(alert).toHaveTextContent("Error");
	expect(alert).toHaveTextContent("Review could not be saved.");
	expect(alert).not.toHaveAttribute("aria-live");
});

test.each([
	["warning", "Warning"],
	["success", "Success"],
	["info", "Info"],
] as const)(
	"%s is announced politely and names itself in text",
	(tone, label) => {
		render(<StatusMessage tone={tone}>Check complete.</StatusMessage>);
		const status = screen.getByRole("status");
		expect(status).toHaveTextContent(label);
		expect(status).not.toHaveAttribute("aria-live");
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

test("the label and the text read as separate words, not one run-together word", () => {
	render(
		<StatusMessage tone="error">Review could not be saved.</StatusMessage>
	);
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Error: Review could not be saved."
	);
});

test("a message can be a described-by target and a focus target", () => {
	const ref = createRef<HTMLDivElement>();
	render(
		<StatusMessage id="field-error" ref={ref} tabIndex={-1} tone="error">
			Name is required.
		</StatusMessage>
	);
	const alert = screen.getByRole("alert");
	expect(alert).toHaveAttribute("id", "field-error");
	expect(ref.current).toBe(alert);
	expect(alert).toHaveAttribute("tabindex", "-1");
});

test("an uncertain write shows a visible Warning that neither says not-saved nor offers a retry", () => {
	render(
		<WriteOutcomeMessage
			message="The result could not be confirmed. Check the current records."
			uncertain
		/>
	);
	const status = screen.getByRole("status");
	expect(status).toHaveTextContent(
		"Warning: The result could not be confirmed. Check the current records."
	);
	expect(status).not.toHaveTextContent(blindRetryPattern);
	expect(screen.queryByRole("button")).toBeNull();
});

test("a certain write outcome keeps the plain status and nothing renders without text", () => {
	const view = render(
		<WriteOutcomeMessage message="Saved." uncertain={false} />
	);
	expect(screen.getByRole("status")).toHaveTextContent(savedExactly);
	view.rerender(<WriteOutcomeMessage message="" uncertain />);
	expect(screen.queryByRole("status")).toBeNull();
});
