import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import { Slider } from "@sprite-anvil/ui/components/slider";

const playbackPositionLabel = "Playback position";

export function VfxAppearancePlaybackControls({
	ready,
	playing,
	positionMs,
	durationMs,
	onTogglePlayback,
	onRestart,
	onSeek,
}: {
	ready: boolean;
	playing: boolean;
	positionMs: number;
	durationMs: number;
	onTogglePlayback: () => void;
	onRestart: () => void;
	onSeek: (positionMs: number) => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-3">
			<Button disabled={!ready} onClick={onTogglePlayback} type="button">
				{playing ? "Pause" : "Play"}
			</Button>
			<Button disabled={!ready} onClick={onRestart} type="button">
				Restart
			</Button>
			<Label className="w-64">
				{playbackPositionLabel}
				<Slider
					className="min-w-32 flex-1"
					disabled={!ready}
					getAriaLabel={() => playbackPositionLabel}
					max={durationMs}
					min={0}
					onValueChange={(value) =>
						onSeek(Array.isArray(value) ? (value[0] ?? 0) : value)
					}
					value={[positionMs]}
				/>
			</Label>
		</div>
	);
}
