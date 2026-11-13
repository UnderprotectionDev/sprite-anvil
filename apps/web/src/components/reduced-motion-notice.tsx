/**
 * Tells the user why playback starts paused when the system asks for reduced
 * motion. Renders nothing otherwise.
 */
export function ReducedMotionNotice({
	reducedMotion,
}: {
	reducedMotion: boolean;
}) {
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
