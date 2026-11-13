import { expect, test } from "vitest";
import {
	focusIndicatorThickness,
	hasVisibleFocusIndicator,
	minimumFocusThickness,
	shadowRingThickness,
} from "./focus-indicator";

test("a solid outline counts by its width", () => {
	expect(
		focusIndicatorThickness({
			outlineStyle: "solid",
			outlineWidth: 2,
			boxShadow: "none",
		})
	).toBe(2);
});

test("an outline style of none counts as no outline", () => {
	expect(
		focusIndicatorThickness({
			outlineStyle: "none",
			outlineWidth: 3,
			boxShadow: "none",
		})
	).toBe(0);
});

test("a solid box-shadow ring counts by its spread, ignoring blurred drop shadows", () => {
	expect(shadowRingThickness("rgb(0, 0, 0) 0px 0px 0px 3px")).toBe(3);
	expect(shadowRingThickness("rgb(0, 0, 0) 0px 4px 8px 0px")).toBe(0);
	expect(shadowRingThickness("none")).toBe(0);
});

test("the thickest layer of a shadow list wins and rgba commas do not split a layer", () => {
	expect(
		shadowRingThickness(
			"rgba(0, 0, 0, 0.5) 0px 0px 0px 1px, rgb(1, 2, 3) 0px 0px 0px 4px"
		)
	).toBe(4);
});

test("the visible focus indicator is at least 2 CSS px thick", () => {
	expect(minimumFocusThickness).toBe(2);
	expect(
		hasVisibleFocusIndicator({
			outlineStyle: "solid",
			outlineWidth: 1,
			boxShadow: "none",
		})
	).toBe(false);
	expect(
		hasVisibleFocusIndicator({
			outlineStyle: "none",
			outlineWidth: 0,
			boxShadow: "rgb(0, 0, 0) 0px 0px 0px 2px",
		})
	).toBe(true);
});
