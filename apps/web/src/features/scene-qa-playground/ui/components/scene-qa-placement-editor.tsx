import type { SceneQaPlacement } from "@sprite-anvil/api/scene-qa";
import { Button } from "@sprite-anvil/ui/components/button";
import { SceneNumberField } from "./scene-qa-fields";

const clipNames = ["idle", "walk", "attack"] as const;
export function SceneQaPlacementEditor({
	placement,
	onChange,
	onRemove,
}: {
	placement: SceneQaPlacement;
	onChange: (p: SceneQaPlacement) => void;
	onRemove: () => void;
}) {
	return (
		<fieldset className="space-y-4 rounded-lg border p-4">
			<legend className="px-2 font-medium">
				{placement.role} · {placement.assetVersionId}
			</legend>
			<div className="grid gap-3 sm:grid-cols-4">
				{(["x", "y", "layer", "scale"] as const).map((key) => (
					<SceneNumberField
						key={key}
						label={
							{
								x: "Position X",
								y: "Position Y",
								layer: "Layer",
								scale: "Integer scale",
							}[key]
						}
						onChange={(value) => onChange({ ...placement, [key]: value })}
						value={placement[key]}
					/>
				))}
			</div>
			<details>
				<summary className="cursor-pointer py-2">
					Placement points and areas
				</summary>
				<p className="text-muted-foreground text-sm">
					Coordinates are authored in frame pixels. These guides do not change
					source metadata.
				</p>
				<div className="grid gap-3 sm:grid-cols-4">
					{(["pivot", "groundPoint", "sortPoint", "origin"] as const).flatMap(
						(key) =>
							(["x", "y"] as const).map((axis) => (
								<SceneNumberField
									key={`${key}-${axis}`}
									label={`${{ pivot: "Pivot", groundPoint: "Ground", sortPoint: "Sort", origin: "Effect origin" }[key]} ${axis.toUpperCase()}`}
									onChange={(value) =>
										onChange({
											...placement,
											[key]: { ...placement[key], [axis]: value },
										})
									}
									value={placement[key][axis]}
								/>
							))
					)}
				</div>
				{placement.areas.map((area, index) => (
					<fieldset
						className="mt-3 grid gap-2 sm:grid-cols-5"
						// biome-ignore lint/suspicious/noArrayIndexKey: Areas are ordered slots with fully controlled inputs.
						key={`${area.kind}-${index}`}
					>
						<legend>{area.kind}</legend>
						{(["x", "y", "width", "height"] as const).map((key) => (
							<SceneNumberField
								key={key}
								label={`Area ${key}`}
								onChange={(value) =>
									onChange({
										...placement,
										areas: placement.areas.map((a, i) =>
											i === index ? { ...a, [key]: value } : a
										),
									})
								}
								value={area[key]}
							/>
						))}
						<Button
							onClick={() =>
								onChange({
									...placement,
									areas: placement.areas.filter((_, i) => i !== index),
								})
							}
							type="button"
							variant="outline"
						>
							Remove area
						</Button>
					</fieldset>
				))}
				<div className="mt-3 flex flex-wrap gap-2">
					{(["hitbox", "hurtbox", "collision"] as const).map((kind) => (
						<Button
							disabled={placement.areas.length >= 16}
							key={kind}
							onClick={() =>
								onChange({
									...placement,
									areas: [
										...placement.areas,
										{ kind, x: 0, y: 0, width: 16, height: 16 },
									],
								})
							}
							type="button"
							variant="outline"
						>
							Add {kind}
						</Button>
					))}
				</div>
			</details>
			<details open={placement.role === "character"}>
				<summary className="cursor-pointer py-2">Animation frames</summary>
				<p className="text-muted-foreground text-sm">
					Use source image regions for each state. Frame durations are
					preserved.
				</p>
				{(placement.role === "character" || placement.role === "object"
					? clipNames
					: (["idle"] as const)
				).map((clip) => (
					<fieldset className="mt-3 space-y-2" key={clip}>
						<legend className="font-medium">{clip}</legend>
						{placement.clips[clip].map((frame, index) => (
							<div
								className="grid gap-2 sm:grid-cols-6"
								// biome-ignore lint/suspicious/noArrayIndexKey: Frame slot identity is its ordered position; all values are controlled.
								key={`${clip}-${index}`}
							>
								{(["x", "y", "width", "height", "durationMs"] as const).map(
									(key) => (
										<SceneNumberField
											key={key}
											label={`Frame ${index + 1} ${{ x: "X", y: "Y", width: "width", height: "height", durationMs: "duration (ms)" }[key]}`}
											onChange={(value) =>
												onChange({
													...placement,
													clips: {
														...placement.clips,
														[clip]: placement.clips[clip].map((f, i) =>
															i === index ? { ...f, [key]: value } : f
														),
													},
												})
											}
											value={frame[key]}
										/>
									)
								)}
								<Button
									disabled={
										placement.clips[clip].length === 1 &&
										(clip === "idle" || placement.role === "character")
									}
									onClick={() =>
										onChange({
											...placement,
											clips: {
												...placement.clips,
												[clip]: placement.clips[clip].filter(
													(_, i) => i !== index
												),
											},
										})
									}
									type="button"
									variant="outline"
								>
									Remove frame
								</Button>
							</div>
						))}
						<Button
							disabled={placement.clips[clip].length >= 64}
							onClick={() =>
								onChange({
									...placement,
									clips: {
										...placement.clips,
										[clip]: [
											...placement.clips[clip],
											{
												...(placement.clips.idle[0] ?? {
													x: 0,
													y: 0,
													width: 1,
													height: 1,
												}),
												durationMs: 100,
											},
										],
									},
								})
							}
							type="button"
							variant="outline"
						>
							Add {clip} frame
						</Button>
					</fieldset>
				))}
			</details>
			<Button onClick={onRemove} type="button" variant="outline">
				Remove placement
			</Button>
		</fieldset>
	);
}
