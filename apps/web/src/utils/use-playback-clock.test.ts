// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { usePlaybackClock } from "./use-playback-clock";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

test("a shared playback clock stops at the end and keeps the seek position when paused", () => {
	const callbacks = new Map<number, FrameRequestCallback>();
	let nextId = 0;
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		nextId += 1;
		callbacks.set(nextId, callback);
		return nextId;
	});
	vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
	vi.spyOn(performance, "now").mockReturnValue(0);
	const frame = (now: number) => {
		const queued = [...callbacks.values()];
		callbacks.clear();
		act(() => {
			for (const callback of queued) {
				callback(now);
			}
		});
	};

	const { result } = renderHook(() => usePlaybackClock({ durationMs: 100 }));
	act(() => result.current.setPlaying(true));
	frame(25);
	expect(result.current.elapsedMs).toBe(25);
	frame(105);
	expect(result.current.elapsedMs).toBe(100);
	expect(result.current.playing).toBe(false);
	expect(callbacks.size).toBe(0);
	act(() => result.current.setElapsedMs(50));
	frame(150);
	expect(result.current.elapsedMs).toBe(50);
});
