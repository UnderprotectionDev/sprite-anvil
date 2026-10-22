// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { SceneQaSetup } from "@sprite-anvil/api/scene-qa";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SceneQaSettings } from "./scene-qa-settings";

const setup: SceneQaSetup = {
	width: 640,
	height: 360,
	durationMs: 4000,
	camera: "fixed",
	contrast: "dark",
	ySort: true,
	showOverlays: false,
	movement: { x: 64, y: 32 },
	hitAtMs: 2700,
	placements: [],
};
afterEach(cleanup);

test("scene toggles are named checkboxes that report the toggled setup", async () => {
	const onChange = vi.fn();
	render(
		<SceneQaSettings
			name=""
			onChange={onChange}
			onNameChange={vi.fn()}
			setup={setup}
		/>
	);
	const ySort = screen.getByRole("checkbox", { name: "Y-sort within layers" });
	const overlays = screen.getByRole("checkbox", {
		name: "Show metadata guides",
	});
	expect(ySort).toBeChecked();
	expect(overlays).not.toBeChecked();

	fireEvent.click(ySort);
	expect(onChange).toHaveBeenLastCalledWith({ ...setup, ySort: false });

	const user = userEvent.setup();
	overlays.focus();
	await user.keyboard(" ");
	expect(onChange).toHaveBeenLastCalledWith({ ...setup, showOverlays: true });
});

test("camera and contrast selects report their chosen values", () => {
	const onChange = vi.fn();
	render(
		<SceneQaSettings
			name=""
			onChange={onChange}
			onNameChange={vi.fn()}
			setup={setup}
		/>
	);
	const camera = screen.getByLabelText("Camera");
	expect(camera).toHaveValue("fixed");
	fireEvent.change(camera, { target: { value: "pan" } });
	expect(onChange).toHaveBeenLastCalledWith({ ...setup, camera: "pan" });

	const contrast = screen.getByLabelText("Contrast background");
	expect(contrast).toHaveValue("dark");
	fireEvent.change(contrast, { target: { value: "light" } });
	expect(onChange).toHaveBeenLastCalledWith({ ...setup, contrast: "light" });
});

test("a disabled scene fieldset blocks every setup control", async () => {
	const onChange = vi.fn();
	render(
		<fieldset disabled>
			<SceneQaSettings
				name=""
				onChange={onChange}
				onNameChange={vi.fn()}
				setup={setup}
			/>
		</fieldset>
	);
	const user = userEvent.setup();
	await user.click(
		screen.getByRole("checkbox", { name: "Y-sort within layers" })
	);
	await user.click(
		screen.getByRole("checkbox", { name: "Show metadata guides" })
	);
	expect(onChange).not.toHaveBeenCalled();
	expect(screen.getByLabelText("Camera")).toBeDisabled();
	expect(screen.getByLabelText("Contrast background")).toBeDisabled();
});
