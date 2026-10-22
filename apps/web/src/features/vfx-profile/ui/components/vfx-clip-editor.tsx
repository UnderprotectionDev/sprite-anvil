import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { VfxClip, VfxFrame } from "@sprite-anvil/api/vfx-synchronization";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
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
	disabled,
	onValueChange,
}: {
	label: string;
	clip: VfxClip;
	catalog: AssetVersionCatalog;
	recordNames: Record<string, string>;
	versionIds: Set<string>;
	disabled: boolean;
	onValueChange: (clip: VfxClip) => void;
}) {
	const [rowKeys, setRowKeys] = useState(() =>
		clip.frames.map(() => crypto.randomUUID())
	);
	const units = catalog.unitVersions.filter(
		(u) => u.unitType === "frame" && versionIds.has(u.assetVersionId)
	);
	const updateFrame = (index: number, frame: VfxFrame) =>
		onValueChange({
			...clip,
			frames: clip.frames.map((f, i) => (i === index ? frame : f)),
		});
	return (
		<FieldSet className="space-y-3 rounded border p-3">
			<FieldLegend>{label}</FieldLegend>
			<Label className="flex gap-2">
				<Checkbox
					checked={clip.looping}
					disabled={disabled}
					onCheckedChange={(checked) =>
						onValueChange({ ...clip, looping: checked })
					}
				/>{" "}
				Loop
			</Label>
			{clip.frames.map((frame, index) => (
				<FieldSet className="space-y-2 rounded border p-2" key={rowKeys[index]}>
					<FieldLegend>
						{label} frame {index + 1}
					</FieldLegend>
					<Label className="block">
						Frame version
						<NativeSelect
							className="block w-full"
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
							<NativeSelectOption value="">Choose a frame</NativeSelectOption>
							{units.map((u) => (
								<NativeSelectOption key={u.id} value={u.id}>
									{recordNames[u.assetRecordId] ?? u.assetRecordId} ·{" "}
									{u.unitKey} · Unit Version {u.versionNumber} · Asset Version{" "}
									{
										catalog.assetVersions.find((v) => v.id === u.assetVersionId)
											?.versionNumber
									}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
					<div className="flex flex-wrap gap-3">
						<Label className="block">
							Duration (ms)
							<Input
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
						</Label>
						{(["x", "y", "width", "height"] as const).map((key) => (
							<Label className="block" key={key}>
								Region {key}
								<Input
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
							</Label>
						))}
						{(["x", "y"] as const).map((key) => (
							<Label className="block" key={key}>
								Origin {key}
								<Input
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
							</Label>
						))}
					</div>
					<Button
						disabled={clip.frames.length === 1}
						onClick={() => {
							setRowKeys((keys) => keys.filter((_, i) => i !== index));
							onValueChange({
								...clip,
								frames: clip.frames.filter((_, i) => i !== index),
							});
						}}
						type="button"
					>
						Remove frame
					</Button>
				</FieldSet>
			))}
			<Button
				disabled={clip.frames.length >= 64}
				onClick={() => {
					setRowKeys((keys) => [...keys, crypto.randomUUID()]);
					onValueChange({
						...clip,
						frames: [...clip.frames, emptyVfxFrame()],
					});
				}}
				type="button"
			>
				Add frame
			</Button>
			<p className="text-muted-foreground text-sm">
				Origin uses source image pixels from the top left. The owner origin is
				the attachment point. Frame order follows this list.
			</p>
		</FieldSet>
	);
}
