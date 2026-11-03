import {
	type CanvasAnchor,
	canvasAnchorSchema,
	type PixelOperation,
} from "@sprite-anvil/api/pixel-editor";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { resizeCanvasFormSchema, scaleFormSchema } from "../../schemas";

const anchorLabels: Record<CanvasAnchor, string> = {
	"top-left": "Top left",
	top: "Top",
	"top-right": "Top right",
	left: "Left",
	center: "Center",
	right: "Right",
	"bottom-left": "Bottom left",
	bottom: "Bottom",
	"bottom-right": "Bottom right",
};

export function ResizeCanvasForm({
	disabled,
	onOperation,
	size,
}: {
	disabled: boolean;
	onOperation: (operation: PixelOperation) => void;
	size: { height: number; width: number };
}) {
	const form = useForm({
		defaultValues: {
			width: String(size.width),
			height: String(size.height),
			anchor: "top-left" as CanvasAnchor,
		},
		validators: { onSubmit: resizeCanvasFormSchema },
		onSubmit: ({ value }) => {
			const parsed = resizeCanvasFormSchema.parse(value);
			onOperation({ type: "resize-canvas", ...parsed });
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
			<p className="font-medium text-sm">Canvas size</p>
			<div className="grid grid-cols-2 gap-2">
				<form.Field name="width">
					{(field) => (
						<Label className="space-y-1 text-xs" htmlFor="resize-width">
							<span>Width (px)</span>
							<Input
								id="resize-width"
								inputMode="numeric"
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<form.Field name="height">
					{(field) => (
						<Label className="space-y-1 text-xs" htmlFor="resize-height">
							<span>Height (px)</span>
							<Input
								id="resize-height"
								inputMode="numeric"
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
			</div>
			<form.Field name="anchor">
				{(field) => (
					<Label className="block space-y-1 text-xs" htmlFor="resize-anchor">
						<span>Fixed anchor</span>
						<NativeSelect
							className="w-full"
							id="resize-anchor"
							onChange={(event) =>
								field.handleChange(canvasAnchorSchema.parse(event.target.value))
							}
							value={field.state.value}
						>
							{canvasAnchorSchema.options.map((anchor) => (
								<NativeSelectOption key={anchor} value={anchor}>
									{anchorLabels[anchor]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.errors}>
				{(errors) => <FormErrors errors={errors} />}
			</form.Subscribe>
			<Button disabled={disabled} size="sm" type="submit" variant="outline">
				Resize canvas
			</Button>
		</form>
	);
}

export function ScaleForm({
	disabled,
	onOperation,
}: {
	disabled: boolean;
	onOperation: (operation: PixelOperation) => void;
}) {
	const form = useForm({
		defaultValues: { factor: "2" },
		validators: { onSubmit: scaleFormSchema },
		onSubmit: ({ value }) => {
			onOperation({ type: "scale", ...scaleFormSchema.parse(value) });
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
			<p className="font-medium text-sm">Integer scale</p>
			<form.Field name="factor">
				{(field) => (
					<Label className="block space-y-1 text-xs" htmlFor="scale-factor">
						<span>Whole-number factor, nearest neighbour</span>
						<Input
							id="scale-factor"
							inputMode="numeric"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.errors}>
				{(errors) => <FormErrors errors={errors} />}
			</form.Subscribe>
			<Button disabled={disabled} size="sm" type="submit" variant="outline">
				Scale
			</Button>
		</form>
	);
}

function FormErrors({ errors }: { errors: unknown[] }) {
	const messages = errors.flatMap((error) => {
		if (typeof error === "string") {
			return [error];
		}
		if (error && typeof error === "object") {
			return Object.values(error as Record<string, unknown>)
				.flat()
				.map((issue) =>
					issue && typeof issue === "object" && "message" in issue
						? String((issue as { message: unknown }).message)
						: String(issue)
				);
		}
		return [];
	});
	return messages.length > 0 ? (
		<p className="text-destructive text-xs" role="alert">
			{messages.join(" ")}
		</p>
	) : null;
}
