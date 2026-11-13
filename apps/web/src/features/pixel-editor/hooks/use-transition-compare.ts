import { useEffect, useState } from "react";

export const transitionIntervalMs = 800;

export type TransitionPhase = "source" | "draft";

/**
 * Transition compare: switches between the Source and the Working Draft. It
 * never starts by itself and runs only between Start and Stop, so under
 * reduced motion it also begins paused and the user starts it. It stops when
 * the system preference turns on; the manual toggle always works.
 */
export function useTransitionCompare(reducedMotion: boolean) {
	const [phase, setPhase] = useState<TransitionPhase>("draft");
	const [started, setStarted] = useState(false);
	const running = started;

	useEffect(() => {
		if (reducedMotion) {
			setStarted(false);
		}
	}, [reducedMotion]);

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
		start: () => setStarted(true),
		stop: () => setStarted(false),
		toggle: () =>
			setPhase((current) => (current === "draft" ? "source" : "draft")),
	};
}
