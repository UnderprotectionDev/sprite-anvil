import { usePrefersReducedMotion } from "@sprite-anvil/ui/hooks/use-prefers-reduced-motion";
import { useEffect, useRef } from "react";

/**
 * For players that never start on their own. When the system asks for reduced
 * motion it calls `onReducedMotion` (stop playback) as the preference turns on
 * and tells the user why playback waits for Play. Renders nothing otherwise.
 * `onReducedMotion` need not be stable: the latest one is always called.
 */
export function ReducedMotionNotice({
	onReducedMotion,
}: {
	onReducedMotion: () => void;
}) {
	const reducedMotion = usePrefersReducedMotion();
	const latest = useRef(onReducedMotion);
	latest.current = onReducedMotion;
	useEffect(() => {
		if (reducedMotion) {
			latest.current();
		}
	}, [reducedMotion]);
	if (!reducedMotion) {
		return null;
	}
	return (
		<p className="text-muted-foreground text-xs" role="note">
			Your system asks for reduced motion, so playback stays paused until you
			press Play. Pause stops it again.
		</p>
	);
}
