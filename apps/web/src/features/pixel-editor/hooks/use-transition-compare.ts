import { useEffect, useState } from "react";

export const transitionIntervalMs = 800;

export type TransitionPhase = "source" | "draft";

/**
 * Transition compare: switches between the Source and the Working Draft. It
 * never starts by itself, runs only between Start and Stop, and does not run
 * at all when the user prefers reduced motion; the manual toggle still works.
 */
export function useTransitionCompare(reducedMotion: boolean) {
	const [phase, setPhase] = useState<TransitionPhase>("draft");
	const [started, setStarted] = useState(false);
	const running = started && !reducedMotion;

	useEffect(() => {
		if (!running) {
			return;
		}
		const timer = setInterval(
			() => setPhase((current) => (current === "draft" ? "source" : "draft")),
			transitionIntervalMs
		);
		return () => clearInterval(timer);
	}, [running]);

	return {
		phase,
		running,
		start: () => setStarted(!reducedMotion),
		stop: () => setStarted(false),
		toggle: () =>
			setPhase((current) => (current === "draft" ? "source" : "draft")),
	};
}
