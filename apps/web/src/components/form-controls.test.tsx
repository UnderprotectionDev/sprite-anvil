// @vitest-environment jsdom

import { Input } from "@sprite-anvil/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

afterEach(cleanup);

test("opens the design list and reports the choice through onChange", async () => {
	const user = userEvent.setup();
	const onChange = vi.fn();
	render(
		<NativeSelect
			aria-label="Export format"
			onChange={(event) => onChange(event.target.value)}
		>
			<NativeSelectOption value="png">PNG frames</NativeSelectOption>
			<NativeSelectOption value="sheet">Sprite sheet</NativeSelectOption>
		</NativeSelect>
	);
	const select = screen.getByRole("combobox", { name: "Export format" });
	select.focus();
	await user.keyboard("{ArrowDown}");
	const listbox = await screen.findByRole("listbox");
	expect(listbox.textContent).toContain("Sprite sheet");
	await user.keyboard("{ArrowDown}{Enter}");
	expect(onChange).toHaveBeenCalledWith("sheet");
	expect(screen.queryByRole("listbox")).toBeNull();
});

test("steps a number input from its arrow area", () => {
	const onChange = vi.fn();
	render(
		<Input
			aria-label="fps"
			defaultValue={12}
			onChange={(event) => onChange(event.target.value)}
			type="number"
		/>
	);
	const input = screen.getByRole("spinbutton", { name: "fps" });
	vi.spyOn(input, "getBoundingClientRect").mockReturnValue(
		new DOMRect(0, 0, 100, 40)
	);
	fireEvent.mouseDown(input, { clientX: 82, clientY: 10 });
	expect(onChange).toHaveBeenLastCalledWith("13");
	fireEvent.mouseUp(window);
	fireEvent.mouseDown(input, { clientX: 82, clientY: 30 });
	expect(onChange).toHaveBeenLastCalledWith("12");
	fireEvent.mouseUp(window);
});

test("names the open list after the field and follows option changes", async () => {
	const user = userEvent.setup();
	const onChange = vi.fn();
	const view = (values: string[]) => (
		<label>
			Category
			<NativeSelect onChange={(event) => onChange(event.target.value)}>
				{values.map((value) => (
					<NativeSelectOption key={value} value={value}>
						{value}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</label>
	);
	const { rerender } = render(view(["Icon", "Tileset"]));
	screen.getByRole("combobox").focus();
	await user.keyboard("{ArrowDown}");
	const listbox = await screen.findByRole("listbox", { name: "Category" });
	rerender(view(["Character", "Icon", "Tileset"]));
	await within(listbox).findByRole("option", { name: "Character" });
	await user.click(
		await within(listbox).findByRole("option", { name: "Tileset" })
	);
	expect(onChange).toHaveBeenLastCalledWith("Tileset");
});

test("ignores clicks above the arrows and stops repeating once removed", () => {
	vi.useFakeTimers();
	const onChange = vi.fn();
	const { unmount } = render(
		<Input
			aria-label="speed"
			defaultValue={1}
			onChange={(event) => onChange(event.target.value)}
			type="number"
		/>
	);
	const input = screen.getByRole("spinbutton", { name: "speed" });
	vi.spyOn(input, "getBoundingClientRect").mockReturnValue(
		new DOMRect(0, 0, 100, 44)
	);
	fireEvent.mouseDown(input, { clientX: 82, clientY: 3 });
	expect(onChange).not.toHaveBeenCalled();
	fireEvent.mouseDown(input, { clientX: 82, clientY: 15 });
	unmount();
	vi.advanceTimersByTime(1000);
	expect(vi.getTimerCount()).toBe(0);
	vi.useRealTimers();
});
