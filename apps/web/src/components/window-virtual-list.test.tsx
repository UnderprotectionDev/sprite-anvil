// @vitest-environment jsdom

import { WindowVirtualList } from "@sprite-anvil/ui/components/window-virtual-list";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
	Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

test("bounds 600 items and updates the window when the document scrolls", () => {
	// jsdom does not update an element's viewport rectangle during document scroll.
	const measureList = vi
		.spyOn(HTMLUListElement.prototype, "getBoundingClientRect")
		.mockImplementation(() => new DOMRect(0, -window.scrollY, 1024, 0));
	const items = Array.from({ length: 600 }, (_, index) => `Item ${index}`);
	render(
		<WindowVirtualList
			getItemKey={(item) => item}
			items={items}
			renderItem={(item) => <button type="button">{item}</button>}
		/>
	);
	expect(screen.getByRole("button", { name: "Item 0" })).toBeTruthy();
	expect(screen.getAllByRole("listitem").length).toBeLessThan(100);
	measureList.mockClear();
	act(() => {
		Object.defineProperty(window, "scrollY", {
			configurable: true,
			value: 16_000,
		});
		fireEvent.scroll(window);
	});
	expect(screen.queryByRole("button", { name: "Item 0" })).toBeNull();
	expect(screen.getByRole("button", { name: "Item 100" })).toBeTruthy();
	expect(screen.getAllByRole("listitem").length).toBeLessThan(100);
	expect(measureList).not.toHaveBeenCalled();
});
