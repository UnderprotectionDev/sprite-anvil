import type {
	FrameOperation,
	SheetFrameView,
} from "@sprite-anvil/api/pixel-editor-structure";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { frameSettingsFormSchema } from "../../schemas";

const fields = [
	["durationMs", "Duration (ms)"],
	["offsetX", "Offset X (px)"],
	["offsetY", "Offset Y (px)"],
	["pivotX", "Pivot X (px)"],
	["pivotY", "Pivot Y (px)"],
] as const;

/** Per-frame duration, X/Y offset and pivot; keep locks the frame against silent change. */
export function FrameSettingsForm({
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
			durationMs: String(frame.durationMs),
			offsetX: String(frame.offsetX),
			offsetY: String(frame.offsetY),
			pivotX: String(frame.pivotX),
			pivotY: String(frame.pivotY),
		},
		validators: { onSubmit: frameSettingsFormSchema },
		onSubmit: ({ value }) => {
			const next = frameSettingsFormSchema.parse(value);
			const operations: FrameOperation[] = [];
			if (next.durationMs !== frame.durationMs) {
				operations.push({
					type: "set-duration",
					frameKey: frame.key,
					durationMs: next.durationMs,
				});
			}
			if (next.offsetX !== frame.offsetX || next.offsetY !== frame.offsetY) {
				operations.push({
					type: "set-offset",
					frameKey: frame.key,
					x: next.offsetX,
					y: next.offsetY,
				});
			}
			if (next.pivotX !== frame.pivotX || next.pivotY !== frame.pivotY) {
				operations.push({
					type: "set-pivot",
					frameKey: frame.key,
					x: next.pivotX,
					y: next.pivotY,
				});
			}
			if (operations.length > 0) {
				onEdit(operations);
			}
		},
	});
	const keepId = `keep-${frame.key}`;

	return (
		<div className="space-y-3">
			<p className="font-medium text-sm">Frame #{frame.index + 1} settings</p>
			<div className="flex items-center gap-2">
				<Checkbox
					checked={frame.keep}
					disabled={disabled}
					id={keepId}
					onCheckedChange={(keep) =>
						onEdit([{ type: "set-keep", frameKey: frame.key, keep }])
					}
				/>
				<Label htmlFor={keepId}>
					Keep (protect this frame from silent changes)
				</Label>
			</div>
			<form
				className="space-y-2"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<fieldset className="grid grid-cols-2 gap-2" disabled={disabled}>
					<legend className="sr-only">Frame values</legend>
					{fields.map(([name, label]) => (
						<form.Field key={name} name={name}>
							{(field) => (
								<Label className="space-y-1 text-xs" htmlFor={`frame-${name}`}>
									<span>{label}</span>
									<Input
										aria-invalid={field.state.meta.errors.length > 0}
										id={`frame-${name}`}
										inputMode="numeric"
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									/>
								</Label>
							)}
						</form.Field>
					))}
				</fieldset>
				<Button disabled={disabled} size="sm" type="submit" variant="outline">
					Apply frame values
				</Button>
			</form>
		</div>
	);
}
