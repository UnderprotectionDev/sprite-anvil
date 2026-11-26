import { useEffect, useRef, useState } from "react";

// Paper · 06 Extra primitives · Delayed loading. A fast request never flashes a
// loader: the indicator appears only after `delay` and, once shown, stays at
// least `minDuration` so it does not flicker.
export const DELAYED_VISIBILITY_DELAY_MS = 200;
export const DELAYED_VISIBILITY_MIN_DURATION_MS = 400;

export interface DelayedVisibilityOptions {
	/** Wait this long after `active` turns on before showing. */
	delay?: number;
	/** Once shown, stay visible at least this long. */
	minDuration?: number;
}

/**
 * When the indicator is visible for a request of `durationMs`, in ms from the
 * request start, or `null` when the request ends before the delay.
 */
export function delayedVisibilityWindow(
	durationMs: number,
	{
		delay = DELAYED_VISIBILITY_DELAY_MS,
		minDuration = DELAYED_VISIBILITY_MIN_DURATION_MS,
	}: DelayedVisibilityOptions = {}
): { from: number; until: number } | null {
	if (durationMs <= delay) {
		return null;
	}
	return { from: delay, until: Math.max(durationMs, delay + minDuration) };
}

/**
 * Debounces a loading flag for display: true only after `active` has been on
 * for `delay`, then held for at least `minDuration` after it turns off.
 */
export function useDelayedVisibility(
	active: boolean,
	{
		delay = DELAYED_VISIBILITY_DELAY_MS,
		minDuration = DELAYED_VISIBILITY_MIN_DURATION_MS,
	}: DelayedVisibilityOptions = {}
) {
	const [visible, setVisible] = useState(false);
	const shownAt = useRef(0);

	useEffect(() => {
		if (active && !visible) {
			const timer = window.setTimeout(() => {
				shownAt.current = performance.now();
				setVisible(true);
			}, delay);
			return () => window.clearTimeout(timer);
		}
		if (!active && visible) {
			const remaining = minDuration - (performance.now() - shownAt.current);
			const timer = window.setTimeout(
				() => setVisible(false),
				Math.max(0, remaining)
			);
			return () => window.clearTimeout(timer);
		}
	}, [active, visible, delay, minDuration]);

	return visible;
}
