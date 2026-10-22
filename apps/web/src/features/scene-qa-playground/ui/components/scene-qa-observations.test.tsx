// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SceneQaObservations } from "./scene-qa-observations";

const observations = {
	scale: "",
	layering: "Sorted.",
	transitions: "",
	events: "",
	camera: "",
	readability: "",
};
afterEach(cleanup);

test("each observation area is a labelled text field that reports its edit", () => {
	const onChange = vi.fn();
	render(
		<SceneQaObservations observations={observations} onChange={onChange} />
	);
	const layering = screen.getByLabelText("Layering and Y-sort");
	expect(layering).toHaveValue("Sorted.");
	expect(layering).toHaveAttribute("maxLength", "2000");

	fireEvent.change(screen.getByLabelText("Camera behavior"), {
		target: { value: "Follows smoothly." },
	});
	expect(onChange).toHaveBeenCalledExactlyOnceWith({
		...observations,
		camera: "Follows smoothly.",
	});
});
