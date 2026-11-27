// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import { ProjectSetupForm } from "./project-setup-form";

afterEach(() => {
	cleanup();
});

test("submits the typed project name and general art direction", async () => {
	const onSubmit = vi.fn();
	render(<ProjectSetupForm isPending={false} onSubmit={onSubmit} />);

	const name = screen.getByLabelText("Project name");
	const artDirection = screen.getByLabelText("Art direction");
	expect(name).toBeRequired();
	expect(name).toHaveAttribute("maxLength", "60");
	expect(artDirection).not.toBeRequired();
	expect(artDirection).toHaveAttribute("maxLength", "400");

	fireEvent.click(screen.getByRole("button", { name: "Create project" }));
	expect(onSubmit).not.toHaveBeenCalled();

	fireEvent.change(name, { target: { value: " Moonlit Vale " } });
	fireEvent.change(artDirection, { target: { value: "Soft dusk light." } });
	fireEvent.click(screen.getByRole("button", { name: "Create project" }));

	await waitFor(() =>
		expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
			name: " Moonlit Vale ",
			generalArtDirection: "Soft dusk light.",
		})
	);
});

test("an uncertain outcome locks the fields and offers a state check", () => {
	const onSubmit = vi.fn();
	const onCheckOutcome = vi.fn();
	render(
		<ProjectSetupForm
			isOutcomeUncertain
			isPending={false}
			onCheckOutcome={onCheckOutcome}
			onSubmit={onSubmit}
		/>
	);

	expect(screen.getByLabelText("Project name")).toBeDisabled();
	expect(screen.getByLabelText("Art direction")).toBeDisabled();
	const submit = screen.getByRole("button", { name: "Create project" });
	expect(submit).toBeDisabled();
	fireEvent.submit(submit.closest("form") as HTMLFormElement);
	expect(onSubmit).not.toHaveBeenCalled();

	fireEvent.click(screen.getByRole("button", { name: "Check status" }));
	expect(onCheckOutcome).toHaveBeenCalledOnce();
});

test("a pending create disables the fields and shows progress", () => {
	render(<ProjectSetupForm isPending onCancel={vi.fn()} onSubmit={vi.fn()} />);

	expect(screen.getByRole("heading", { name: "New project" })).toBeVisible();
	expect(screen.getByLabelText("Project name")).toBeDisabled();
	expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
});
