import type { PixelOperation } from "@sprite-anvil/api/pixel-editor";
import type {
	FrameOperation,
	SheetFrameView,
} from "@sprite-anvil/api/pixel-editor-structure";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { opaqueHex } from "../../lib/pixel-geometry";
import { framePixelEditFormSchema } from "../../schemas";

type FrameTool = "pen" | "eraser" | "fill";

function toOperation(
	value: ReturnType<typeof framePixelEditFormSchema.parse>
): PixelOperation {
	const at = { x: value.x, y: value.y };
	switch (value.tool) {
		case "eraser":
			return { type: "eraser", size: 1, points: [at] };
		case "fill":
			return { type: "fill", color: opaqueHex(value.color), at };
		default:
			return {
				type: "pen",
				color: opaqueHex(value.color),
				size: 1,
				points: [at],
			};
	}
}

/**
 * Pixel correction for a frame that does not come from the sheet (blank or
 * Asset Version): one pixel or one fill at a time, kept on the frame itself.
 */
export function FramePixelEditForm({
	disabled,
	frame,
	onEdit,
}: {
	disabled: boolean;
	frame: SheetFrameView;
	onEdit: (operations: FrameOperation[]) => void;
}) {
	const form = useForm({
		defaultValues: {
			tool: "pen" as FrameTool,
			x: "0",
			y: "0",
			color: "#000000",
		},
		validators: { onSubmit: framePixelEditFormSchema },
		onSubmit: ({ value }) => {
			onEdit([
				{
					type: "edit-pixels",
					frameKey: frame.key,
					operation: toOperation(framePixelEditFormSchema.parse(value)),
				},
			]);
		},
	});
	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<p className="font-medium text-sm">
				Correct pixels of frame #{frame.index + 1}
			</p>
			<p className="text-muted-foreground text-xs">
				This frame is not cut from the sheet, so its pixels are edited here.
				{frame.keep ? " Turn off Keep first." : ""} {frame.editCount} edit(s) so
				far.
			</p>
			<fieldset className="grid grid-cols-2 gap-2" disabled={disabled}>
				<legend className="sr-only">Pixel correction</legend>
				<form.Field name="tool">
					{(field) => (
						<Label className="space-y-1 text-xs" htmlFor="frame-edit-tool">
							<span>Tool</span>
							<NativeSelect
								className="w-full"
								id="frame-edit-tool"
								onChange={(event) =>
									field.handleChange(event.target.value as FrameTool)
								}
								value={field.state.value}
							>
								<NativeSelectOption value="pen">Pen</NativeSelectOption>
								<NativeSelectOption value="eraser">Eraser</NativeSelectOption>
								<NativeSelectOption value="fill">Fill</NativeSelectOption>
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="color">
					{(field) => (
						<Label className="space-y-1 text-xs" htmlFor="frame-edit-color">
							<span>Colour</span>
							<Input
								className="h-8 w-12 p-0.5"
								id="frame-edit-color"
								onChange={(event) => field.handleChange(event.target.value)}
								type="color"
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				{(["x", "y"] as const).map((name) => (
					<form.Field key={name} name={name}>
						{(field) => (
							<Label
								className="space-y-1 text-xs"
								htmlFor={`frame-edit-${name}`}
							>
								<span>{name === "x" ? "Pixel x" : "Pixel y"}</span>
								<Input
									id={`frame-edit-${name}`}
									inputMode="numeric"
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
				))}
			</fieldset>
			<div className="flex gap-2">
				<Button disabled={disabled} size="sm" type="submit" variant="outline">
					Apply to frame
				</Button>
				<Button
					disabled={disabled || frame.editCount === 0}
					onClick={() =>
						onEdit([{ type: "undo-pixel-edit", frameKey: frame.key }])
					}
					size="sm"
					type="button"
					variant="ghost"
				>
					Undo last frame edit
				</Button>
			</div>
		</form>
	);
}
