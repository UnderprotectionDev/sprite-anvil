import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useEffect } from "react";

export const transitionIntervalMs = 800;

export type TransitionPhase = "source" | "draft";

/**
 * Transition compare: switches between the Source and the Working Draft. It
 * never starts by itself and runs only between Start and Stop, so under
 * reduced motion it also begins paused and the user starts it. It stops when
 * the system preference turns on; the manual toggle always works.
 */
export function useTransitionCompare(reducedMotion: boolean) {
	const comparison = useCreateStore<{
		phase: TransitionPhase;
		running: boolean;
	}>({ phase: "draft", running: false });
	const { phase, running } = useSelector(comparison, (value) => value);

	useEffect(() => {
		if (reducedMotion) {
			comparison.setState((current) => ({ ...current, running: false }));
		}
	}, [comparison, reducedMotion]);

	useEffect(() => {
		if (!running) {
			return;
		}
		const timer = setInterval(
			() => togglePhase(comparison),
			transitionIntervalMs
		);
		return () => clearInterval(timer);
	}, [comparison, running]);

	return {
		phase,
		running,
		start: () =>
			comparison.setState((current) => ({ ...current, running: true })),
		stop: () =>
			comparison.setState((current) => ({ ...current, running: false })),
		toggle: () => togglePhase(comparison),
	};
}

function togglePhase(
	comparison: import("@tanstack/react-store").Store<{
		phase: TransitionPhase;
		running: boolean;
	}>
) {
	comparison.setState((current) => ({
		...current,
		phase: current.phase === "draft" ? "source" : "draft",
	}));
}
