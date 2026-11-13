// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
	transitionIntervalMs,
	useTransitionCompare,
} from "./use-transition-compare";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

test("does not play on its own and switches only between Start and Stop", () => {
	const { result } = renderHook(() => useTransitionCompare(false));
	expect(result.current.running).toBe(false);
	act(() => {
		vi.advanceTimersByTime(transitionIntervalMs * 3);
	});
	expect(result.current.phase).toBe("draft");

	act(() => result.current.start());
	expect(result.current.running).toBe(true);
	act(() => {
		vi.advanceTimersByTime(transitionIntervalMs);
	});
	expect(result.current.phase).toBe("source");
	act(() => {
		vi.advanceTimersByTime(transitionIntervalMs);
	});
	expect(result.current.phase).toBe("draft");

	act(() => result.current.stop());
	act(() => {
		vi.advanceTimersByTime(transitionIntervalMs * 4);
	});
	expect(result.current.running).toBe(false);
	expect(result.current.phase).toBe("draft");
});

test("under reduced motion nothing plays until the user presses Start, and Stop always works", () => {
	const { result } = renderHook(() => useTransitionCompare(true));
	expect(result.current.running).toBe(false);
	act(() => {
		vi.advanceTimersByTime(transitionIntervalMs * 3);
	});
	expect(result.current.phase).toBe("draft");

	act(() => result.current.start());
	expect(result.current.running).toBe(true);
	act(() => {
		vi.advanceTimersByTime(transitionIntervalMs);
	});
	expect(result.current.phase).toBe("source");
	act(() => result.current.stop());
	expect(result.current.running).toBe(false);
});

test("playback stops when the system starts asking for reduced motion", () => {
	const { result, rerender } = renderHook(
		({ reduced }) => useTransitionCompare(reduced),
		{ initialProps: { reduced: false } }
	);
	act(() => result.current.start());
	expect(result.current.running).toBe(true);
	rerender({ reduced: true });
	expect(result.current.running).toBe(false);
	act(() => {
		vi.advanceTimersByTime(transitionIntervalMs * 3);
	});
	expect(result.current.running).toBe(false);
	expect(result.current.phase).toBe("draft");
});

test("the manual toggle compares without any animation", () => {
	const { result } = renderHook(() => useTransitionCompare(true));
	act(() => result.current.toggle());
	expect(result.current.phase).toBe("source");
	act(() => result.current.toggle());
	expect(result.current.phase).toBe("draft");
});
