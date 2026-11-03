import type { PixelOperation, PixelRect } from "@sprite-anvil/api/pixel-editor";
import { pixelEditorMaxBrushSize } from "@sprite-anvil/api/pixel-editor";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useStore } from "@tanstack/react-store";
import { opaqueHex } from "../../lib/pixel-geometry";
import {
	type PixelEditorToolStore,
	type PixelTool,
	patchToolState,
	pixelTools,
} from "../../store/pixel-editor-tool-store";
import { ResizeCanvasForm, ScaleForm } from "../forms/canvas-transform-forms";
import { ColorSwatch } from "./color-swatch";

const toolLabels: Record<PixelTool, string> = {
	pen: "Pen",
	eraser: "Eraser",
	picker: "Colour picker",
	line: "Line",
	fill: "Fill (exact match)",
	select: "Rectangle select",
	move: "Move selection",
	crop: "Crop",
};

const brushSizes = Array.from(
	{ length: pixelEditorMaxBrushSize },
	(_, index) => index + 1
);

export function ToolPanel({
	disabled,
	onOperation,
	size,
	store,
}: {
	disabled: boolean;
	onOperation: (operation: PixelOperation) => void;
	size: { height: number; width: number };
	store: PixelEditorToolStore;
}) {
	const state = useStore(store, (current) => current);
	const selection: PixelRect | null = state.selection;

	return (
		<div className="space-y-5">
			<section aria-label="Tools" className="space-y-2">
				<h3 className="font-medium text-sm">Tools</h3>
				<div className="grid grid-cols-2 gap-1">
					{pixelTools.map((tool) => (
						<Button
							aria-pressed={state.tool === tool}
							className="justify-start whitespace-normal text-left"
							key={tool}
							onClick={() => patchToolState(store, { tool })}
							size="sm"
							type="button"
							variant={state.tool === tool ? "default" : "outline"}
						>
							{toolLabels[tool]}
						</Button>
					))}
				</div>
				<Label className="block space-y-1 text-xs" htmlFor="brush-size">
					<span>Brush size (whole pixels)</span>
					<NativeSelect
						className="w-full"
						id="brush-size"
						onChange={(event) =>
							patchToolState(store, { brushSize: Number(event.target.value) })
						}
						value={String(state.brushSize)}
					>
						{brushSizes.map((value) => (
							<NativeSelectOption key={value} value={String(value)}>
								{value} px
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Label>
				<div className="flex items-center gap-2">
					<Label
						className="flex items-center gap-2 text-xs"
						htmlFor="tool-color"
					>
						<span>Colour</span>
						<Input
							className="h-8 w-12 p-0.5"
							id="tool-color"
							onChange={(event) =>
								patchToolState(store, { color: opaqueHex(event.target.value) })
							}
							type="color"
							value={state.color.slice(0, 7)}
						/>
					</Label>
					<ColorSwatch color={state.color} />
					<span className="font-mono text-xs">{state.color}</span>
				</div>
			</section>

			<section aria-label="Selection and orientation" className="space-y-2">
				<h3 className="font-medium text-sm">
					{selection
						? `Selection ${selection.width}×${selection.height}`
						: "Whole canvas"}
				</h3>
				<div className="grid grid-cols-2 gap-1">
					<Button
						disabled={disabled}
						onClick={() =>
							onOperation({ type: "flip", axis: "horizontal", rect: selection })
						}
						size="sm"
						type="button"
						variant="outline"
					>
						Flip horizontal
					</Button>
					<Button
						disabled={disabled}
						onClick={() =>
							onOperation({ type: "flip", axis: "vertical", rect: selection })
						}
						size="sm"
						type="button"
						variant="outline"
					>
						Flip vertical
					</Button>
					<Button
						disabled={disabled}
						onClick={() =>
							onOperation({
								type: "rotate-90",
								direction: "clockwise",
								rect: selection,
							})
						}
						size="sm"
						type="button"
						variant="outline"
					>
						Rotate 90° right
					</Button>
					<Button
						disabled={disabled}
						onClick={() =>
							onOperation({
								type: "rotate-90",
								direction: "counterclockwise",
								rect: selection,
							})
						}
						size="sm"
						type="button"
						variant="outline"
					>
						Rotate 90° left
					</Button>
					<Button
						disabled={disabled || !selection}
						onClick={() => {
							if (selection) {
								onOperation({ type: "crop", rect: selection });
								patchToolState(store, { selection: null });
							}
						}}
						size="sm"
						type="button"
						variant="outline"
					>
						Crop to selection
					</Button>
					<Button
						disabled={!selection}
						onClick={() => patchToolState(store, { selection: null })}
						size="sm"
						type="button"
						variant="ghost"
					>
						Clear selection
					</Button>
				</div>
				<p className="text-muted-foreground text-xs">
					Rotation needs a square selection or the whole canvas.
				</p>
			</section>

			<ResizeCanvasForm
				disabled={disabled}
				key={`${size.width}x${size.height}`}
				onOperation={onOperation}
				size={size}
			/>
			<ScaleForm disabled={disabled} onOperation={onOperation} />
		</div>
	);
}
