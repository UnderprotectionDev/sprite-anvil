import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { VfxClip, VfxFrame } from "@sprite-anvil/api/vfx-synchronization";
import { Button } from "@sprite-anvil/ui/components/button";
import { useState } from "react";

export function emptyVfxFrame(): VfxFrame {
	return {
		assetVersionId: "",
		unitVersionId: "",
		frameKey: "",
		durationMs: 100,
		region: { x: 0, y: 0, width: 16, height: 16 },
		origin: { x: 8, y: 12 },
	};
}
export function VfxClipEditor({
	label,
	clip,
	catalog,
	recordNames,
	versionIds,
	onChange,
}: {
	label: string;
	clip: VfxClip;
	catalog: AssetVersionCatalog;
	recordNames: Record<string, string>;
	versionIds: Set<string>;
	onChange: (clip: VfxClip) => void;
}) {
	const [rowKeys, setRowKeys] = useState(() =>
		clip.frames.map(() => crypto.randomUUID())
	);
	const units = catalog.unitVersions.filter(
		(u) => u.unitType === "frame" && versionIds.has(u.assetVersionId)
	);
	const updateFrame = (index: number, frame: VfxFrame) =>
		onChange({
			...clip,
			frames: clip.frames.map((f, i) => (i === index ? frame : f)),
		});
	return (
		<fieldset className="space-y-3 rounded border p-3">
			<legend>{label}</legend>
			<label className="flex gap-2">
				<input
					checked={clip.looping}
					onChange={(e) => onChange({ ...clip, looping: e.target.checked })}
					type="checkbox"
				/>{" "}
				Loop
			</label>
			{clip.frames.map((frame, index) => (
				<fieldset className="space-y-2 rounded border p-2" key={rowKeys[index]}>
					<legend>
						{label} frame {index + 1}
					</legend>
					<label className="block">
						Frame version
						<select
							className="block w-full rounded border bg-background p-2"
							onChange={(e) => {
								const unit = units.find((u) => u.id === e.target.value);
								if (unit) {
									updateFrame(index, {
										...frame,
										unitVersionId: unit.id,
										assetVersionId: unit.assetVersionId,
										frameKey: unit.unitKey,
									});
								}
							}}
							value={frame.unitVersionId}
						>
							<option value="">Choose a frame</option>
							{units.map((u) => (
								<option key={u.id} value={u.id}>
									{recordNames[u.assetRecordId] ?? u.assetRecordId} ·{" "}
									{u.unitKey} · Unit Version {u.versionNumber} · Asset Version{" "}
									{
										catalog.assetVersions.find((v) => v.id === u.assetVersionId)
											?.versionNumber
									}
								</option>
							))}
						</select>
					</label>
					<div className="flex flex-wrap gap-3">
						<label>
							Duration (ms)
							<input
								className="block w-28 rounded border p-2"
								max={60_000}
								min={1}
								onChange={(e) =>
									updateFrame(index, {
										...frame,
										durationMs: Number(e.target.value),
									})
								}
								type="number"
								value={frame.durationMs}
							/>
						</label>
						{(["x", "y", "width", "height"] as const).map((key) => (
							<label key={key}>
								Region {key}
								<input
									className="block w-24 rounded border p-2"
									max={16_384}
									min={key === "width" || key === "height" ? 1 : 0}
									onChange={(e) =>
										updateFrame(index, {
											...frame,
											region: {
												...frame.region,
												[key]: Number(e.target.value),
											},
										})
									}
									type="number"
									value={frame.region[key]}
								/>
							</label>
						))}
						{(["x", "y"] as const).map((key) => (
							<label key={key}>
								Origin {key}
								<input
									className="block w-24 rounded border p-2"
									max={16_384}
									min={-16_384}
									onChange={(e) =>
										updateFrame(index, {
											...frame,
											origin: {
												...frame.origin,
												[key]: Number(e.target.value),
											},
										})
									}
									type="number"
									value={frame.origin[key]}
								/>
							</label>
						))}
					</div>
					<Button
						disabled={clip.frames.length === 1}
						onClick={() => {
							setRowKeys((keys) => keys.filter((_, i) => i !== index));
							onChange({
								...clip,
								frames: clip.frames.filter((_, i) => i !== index),
							});
						}}
						type="button"
					>
						Remove frame
					</Button>
				</fieldset>
			))}
			<Button
				disabled={clip.frames.length >= 64}
				onClick={() => {
					setRowKeys((keys) => [...keys, crypto.randomUUID()]);
					onChange({ ...clip, frames: [...clip.frames, emptyVfxFrame()] });
				}}
				type="button"
			>
				Add frame
			</Button>
			<p className="text-muted-foreground text-sm">
				Origin uses source image pixels from the top left. The owner origin is
				the attachment point. Frame order follows this list.
			</p>
		</fieldset>
	);
}
