// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { setColor, setZoom } from "@/lib/studio-store";

import { StudioToolbar } from "./studio-toolbar";

afterEach(() => {
	setZoom(16);
	setColor("#242b48");
});

test("zoom control updates the displayed canvas scale", () => {
	render(<StudioToolbar />);
	fireEvent.change(screen.getByLabelText("Zoom"), { target: { value: "24" } });
	expect(screen.getByText("24×")).toBeTruthy();
});
