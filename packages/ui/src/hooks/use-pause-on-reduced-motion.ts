import { useEffect } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * For players that never start on their own: returns whether the system asks
 * for reduced motion and calls `pause` whenever that preference turns on, so
 * playback already running stops and waits for the user to press Play again.
 * `pause` must be stable (a state setter bound to `false`, for example).
 */
export function usePauseOnReducedMotion(pause: () => void) {
	const reducedMotion = usePrefersReducedMotion();
	useEffect(() => {
		if (reducedMotion) {
			pause();
		}
	}, [reducedMotion, pause]);
	return reducedMotion;
}
