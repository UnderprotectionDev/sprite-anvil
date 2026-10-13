import type { SceneQaSetup } from "@sprite-anvil/api/scene-qa";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { SceneNumberField } from "./scene-qa-fields";
export function SceneQaSettings({
	setup,
	name,
	onChange,
	onNameChange,
}: {
	setup: SceneQaSetup;
	name: string;
	onChange: (setup: SceneQaSetup) => void;
	onNameChange: (name: string) => void;
}) {
	return (
		<>
			{" "}
			<legend className="font-medium text-lg">Scene setup</legend>
			<div>
				<Label htmlFor="scene-name">Scene name</Label>
				<Input
					id="scene-name"
					maxLength={120}
					onChange={(e) => onNameChange(e.target.value)}
					value={name}
				/>
			</div>
			<div className="grid gap-3 sm:grid-cols-4">
				{(["width", "height", "durationMs", "hitAtMs"] as const).map((key) => (
					<SceneNumberField
						key={key}
						label={
							{
								width: "Viewport width",
								height: "Viewport height",
								durationMs: "Duration (ms)",
								hitAtMs: "Hit event time (ms)",
							}[key]
						}
						onChange={(value) => onChange({ ...setup, [key]: value })}
						value={setup[key]}
					/>
				))}
			</div>
			<p className="text-muted-foreground text-sm">
				Idle: 0–30%; walk: 30–60%; attack: 60–85%; then idle. Place the hit
				event inside the attack interval.
			</p>
			<div className="grid gap-3 sm:grid-cols-4">
				<div>
					<Label htmlFor="scene-camera">Camera</Label>
					<select
						className="min-h-11 w-full rounded border bg-background px-3"
						id="scene-camera"
						onChange={(e) => {
							const camera = e.target.value;
							if (
								camera === "fixed" ||
								camera === "follow" ||
								camera === "pan"
							) {
								onChange({ ...setup, camera });
							}
						}}
						value={setup.camera}
					>
						<option value="fixed">Fixed</option>
						<option value="follow">Follow character</option>
						<option value="pan">Pan</option>
					</select>
				</div>
				<div>
					<Label htmlFor="scene-contrast">Contrast background</Label>
					<select
						className="min-h-11 w-full rounded border bg-background px-3"
						id="scene-contrast"
						onChange={(e) =>
							onChange({
								...setup,
								contrast: e.target.value === "light" ? "light" : "dark",
							})
						}
						value={setup.contrast}
					>
						<option value="dark">Dark</option>
						<option value="light">Light</option>
					</select>
				</div>
				{(["x", "y"] as const).map((axis) => (
					<SceneNumberField
						key={axis}
						label={`Walk displacement ${axis.toUpperCase()}`}
						onChange={(value) =>
							onChange({
								...setup,
								movement: { ...setup.movement, [axis]: value },
							})
						}
						value={setup.movement[axis]}
					/>
				))}
			</div>
			<div className="flex flex-wrap gap-4">
				<label className="flex min-h-11 items-center gap-2">
					<input
						checked={setup.ySort}
						onChange={(e) => onChange({ ...setup, ySort: e.target.checked })}
						type="checkbox"
					/>
					Y-sort within layers
				</label>
				<label className="flex min-h-11 items-center gap-2">
					<input
						checked={setup.showOverlays}
						onChange={(e) =>
							onChange({ ...setup, showOverlays: e.target.checked })
						}
						type="checkbox"
					/>
					Show metadata guides
				</label>
			</div>
		</>
	);
}
