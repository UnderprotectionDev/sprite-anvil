// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ReducedMotionNotice } from "./reduced-motion-notice";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function stubReducedMotion(initial: boolean) {
	let matches = initial;
	const listeners = new Set<() => void>();
	vi.stubGlobal("matchMedia", (query: string) => ({
		get matches() {
			return matches;
		},
		media: query,
		addEventListener: (_: string, listener: () => void) =>
			listeners.add(listener),
		removeEventListener: (_: string, listener: () => void) =>
			listeners.delete(listener),
	}));
	return (next: boolean) => {
		matches = next;
		act(() => {
			for (const listener of listeners) {
				listener();
			}
		});
	};
}

test("renders nothing and never pauses without a reduced-motion preference", () => {
	stubReducedMotion(false);
	const onReducedMotion = vi.fn();
	render(<ReducedMotionNotice onReducedMotion={onReducedMotion} />);
	expect(screen.queryByRole("note")).toBeNull();
	expect(onReducedMotion).not.toHaveBeenCalled();
});

test("explains the paused start and pauses playback when the preference is on", () => {
	stubReducedMotion(true);
	const onReducedMotion = vi.fn();
	render(<ReducedMotionNotice onReducedMotion={onReducedMotion} />);
	expect(screen.getByRole("note")).toHaveTextContent("reduced motion");
	expect(onReducedMotion).toHaveBeenCalledOnce();
});

test("pauses with the latest callback when the preference turns on later, without a stable callback", () => {
	const setPreference = stubReducedMotion(false);
	const first = vi.fn();
	const second = vi.fn();
	const { rerender } = render(<ReducedMotionNotice onReducedMotion={first} />);
	rerender(<ReducedMotionNotice onReducedMotion={second} />);
	setPreference(true);
	expect(first).not.toHaveBeenCalled();
	expect(second).toHaveBeenCalledOnce();
	expect(screen.getByRole("note")).toBeVisible();
});
