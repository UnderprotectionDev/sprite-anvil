import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
	window.addEventListener("online", onChange);
	window.addEventListener("offline", onChange);
	return () => {
		window.removeEventListener("online", onChange);
		window.removeEventListener("offline", onChange);
	};
}

/** Browser connectivity; the cloud stays authoritative whatever this reports. */
export function useOnlineStatus() {
	return useSyncExternalStore(
		subscribe,
		() => navigator.onLine,
		() => true
	);
}
