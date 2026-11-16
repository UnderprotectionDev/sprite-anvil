// @vitest-environment jsdom

import { WindowVirtualList } from "@sprite-anvil/ui/components/window-virtual-list";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
	vi.restoreAllMocks();
	Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

test("bounds 600 items and updates the window when the document scrolls", () => {
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
});
