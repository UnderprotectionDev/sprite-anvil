import type { SceneQaInput } from "@sprite-anvil/api/scene-qa";
import { Label } from "@sprite-anvil/ui/components/label";
export const sceneQaObservationLabels = {
	scale: "Scale and perspective",
	layering: "Layering and Y-sort",
	transitions: "Animation transitions",
	events: "Hit event and effect",
	camera: "Camera behavior",
	readability: "Contrast and readability",
};
export function SceneQaObservations({
	observations,
	onChange,
}: {
	observations: SceneQaInput["observations"];
	onChange: (observations: SceneQaInput["observations"]) => void;
}) {
	return (
		<>
			{" "}
			<p className="text-muted-foreground text-sm">
				Describe what you observed in each area; there is no automatic quality
				score.
			</p>
			<div className="grid gap-4 sm:grid-cols-2">
				{(
					Object.keys(
						sceneQaObservationLabels
					) as (keyof typeof sceneQaObservationLabels)[]
				).map((key) => (
					<div key={key}>
						<Label htmlFor={`scene-observation-${key}`}>
							{sceneQaObservationLabels[key]}
						</Label>
						<textarea
							className="min-h-24 w-full rounded border bg-background p-3"
							id={`scene-observation-${key}`}
							maxLength={2000}
							onChange={(e) =>
								onChange({ ...observations, [key]: e.target.value })
							}
							value={observations[key]}
						/>
					</div>
				))}
			</div>
		</>
	);
}
