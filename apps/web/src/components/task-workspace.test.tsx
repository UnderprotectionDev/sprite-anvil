// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { expect, test } from "vitest";
import { TaskWorkspace } from "./task-workspace";

test("shows one task at a time and preserves unfinished input across tasks", () => {
	render(
		<TaskWorkspace
			label="Record tasks"
			sections={[
				{
					id: "inspect",
					label: "Inspect",
					description: "Find versions",
					content: <p>Saved versions</p>,
				},
				{
					id: "edit",
					label: "Edit",
					description: "Change metadata",
					content: <input aria-label="Name" defaultValue="Knight" />,
				},
			]}
		/>
	);
	expect(screen.getByText("Saved versions")).toBeVisible();
	expect(screen.getByLabelText("Name")).not.toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Edit" }));
	fireEvent.change(screen.getByLabelText("Name"), {
		target: { value: "Knight draft" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
	expect(screen.getByLabelText("Name")).not.toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Edit" }));
	expect(screen.getByLabelText("Name")).toHaveValue("Knight draft");
	expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
		"aria-pressed",
		"true"
	);
});
