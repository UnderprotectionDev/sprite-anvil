import type { SceneQaSetup } from "@sprite-anvil/api/scene-qa";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
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
			<FieldLegend className="font-medium text-lg">Scene setup</FieldLegend>
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
					<NativeSelect
						className="min-h-11 w-full"
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
						<NativeSelectOption value="fixed">Fixed</NativeSelectOption>
						<NativeSelectOption value="follow">
							Follow character
						</NativeSelectOption>
						<NativeSelectOption value="pan">Pan</NativeSelectOption>
					</NativeSelect>
				</div>
				<div>
					<Label htmlFor="scene-contrast">Contrast background</Label>
					<NativeSelect
						className="min-h-11 w-full"
						id="scene-contrast"
						onChange={(e) =>
							onChange({
								...setup,
								contrast: e.target.value === "light" ? "light" : "dark",
							})
						}
						value={setup.contrast}
					>
						<NativeSelectOption value="dark">Dark</NativeSelectOption>
						<NativeSelectOption value="light">Light</NativeSelectOption>
					</NativeSelect>
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
				<Label className="min-h-11 text-sm" htmlFor="scene-y-sort">
					<Checkbox
						checked={setup.ySort}
						id="scene-y-sort"
						onCheckedChange={(checked) =>
							onChange({ ...setup, ySort: checked })
						}
					/>
					Y-sort within layers
				</Label>
				<Label className="min-h-11 text-sm" htmlFor="scene-show-overlays">
					<Checkbox
						checked={setup.showOverlays}
						id="scene-show-overlays"
						onCheckedChange={(checked) =>
							onChange({ ...setup, showOverlays: checked })
						}
					/>
					Show metadata guides
				</Label>
			</div>
		</>
	);
}
