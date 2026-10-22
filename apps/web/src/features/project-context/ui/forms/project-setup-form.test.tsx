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

	const name = screen.getByLabelText("Proje adı");
	const artDirection = screen.getByLabelText("Genel sanat yaklaşımı");
	expect(name).toBeRequired();
	expect(name).toHaveAttribute("maxLength", "120");
	expect(artDirection).toBeRequired();
	expect(artDirection).toHaveAttribute("maxLength", "1000");

	fireEvent.click(screen.getByRole("button", { name: "Projeyi oluştur" }));
	expect(onSubmit).not.toHaveBeenCalled();

	fireEvent.change(name, { target: { value: " Moonlit Vale " } });
	fireEvent.change(artDirection, { target: { value: "Soft dusk light." } });
	fireEvent.click(screen.getByRole("button", { name: "Projeyi oluştur" }));

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

	expect(screen.getByLabelText("Proje adı")).toBeDisabled();
	expect(screen.getByLabelText("Genel sanat yaklaşımı")).toBeDisabled();
	const submit = screen.getByRole("button", { name: "Projeyi oluştur" });
	expect(submit).toBeDisabled();
	fireEvent.submit(submit.closest("form") as HTMLFormElement);
	expect(onSubmit).not.toHaveBeenCalled();

	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));
	expect(onCheckOutcome).toHaveBeenCalledOnce();
});

test("a pending create disables the fields and shows progress", () => {
	render(<ProjectSetupForm isPending onCancel={vi.fn()} onSubmit={vi.fn()} />);

	expect(screen.getByRole("heading", { name: "Yeni proje" })).toBeVisible();
	expect(screen.getByLabelText("Proje adı")).toBeDisabled();
	expect(screen.getByRole("button", { name: "Oluşturuluyor…" })).toBeDisabled();
});
