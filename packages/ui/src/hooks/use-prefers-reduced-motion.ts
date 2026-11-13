import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

function canMatchMedia() {
	return (
		typeof window !== "undefined" && typeof window.matchMedia === "function"
	);
}

function subscribe(onChange: () => void) {
	if (!canMatchMedia()) {
		return () => undefined;
	}
	const media = window.matchMedia(query);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
}

/** True when the user asked the system to reduce motion. */
export function usePrefersReducedMotion() {
	return useSyncExternalStore(
		subscribe,
		() => canMatchMedia() && window.matchMedia(query).matches,
		() => false
	);
}
