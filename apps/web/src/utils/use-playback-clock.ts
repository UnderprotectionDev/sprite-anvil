import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useCallback, useEffect, useEffectEvent } from "react";

export function usePlaybackClock({
	durationMs,
	enabled = true,
	looping = false,
	maxFrameDeltaMs = Number.POSITIVE_INFINITY,
	onAdvance,
	playbackRate = 1,
	startOnFirstFrame = false,
}: {
	durationMs: number;
	enabled?: boolean;
	looping?: boolean;
	maxFrameDeltaMs?: number;
	onAdvance?: (deltaMs: number) => void;
	playbackRate?: number;
	startOnFirstFrame?: boolean;
}) {
	const clock = useCreateStore({ playing: false, elapsedMs: 0 });
	const { elapsedMs, playing } = useSelector(clock, (state) => state);
	const setPlaying = useCallback(
		(next: boolean | ((playing: boolean) => boolean)) =>
			clock.setState((state) => ({
				...state,
				playing: typeof next === "function" ? next(state.playing) : next,
			})),
		[clock]
	);
	const setElapsedMs = useCallback(
		(next: number) =>
			clock.setState((state) => ({ ...state, elapsedMs: next })),
		[clock]
	);
	const notifyAdvance = useEffectEvent((delta: number) => onAdvance?.(delta));

	useEffect(() => {
		if (!(playing && enabled)) {
			return;
		}
		let previous = startOnFirstFrame ? null : performance.now();
		const tick = (timestamp: number) => {
			const { state } = clock;
			if (!state.playing) {
				return;
			}
			if (previous !== null) {
				const delta = Math.min(timestamp - previous, maxFrameDeltaMs);
				notifyAdvance(delta);
				const next = state.elapsedMs + delta * playbackRate;
				if (!looping && next >= durationMs) {
					clock.setState(() => ({ playing: false, elapsedMs: durationMs }));
					return;
				}
				setElapsedMs(next);
			}
			previous = timestamp;
			frame = requestAnimationFrame(tick);
		};
		let frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [
		clock,
		durationMs,
		enabled,
		looping,
		maxFrameDeltaMs,
		playbackRate,
		playing,
		setElapsedMs,
		startOnFirstFrame,
	]);

	return { elapsedMs, playing, setElapsedMs, setPlaying };
}
