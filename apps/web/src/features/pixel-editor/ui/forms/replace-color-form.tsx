import type { PixelDraft } from "@sprite-anvil/api/pixel-editor";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useColorReplacePreview } from "../../hooks/use-pixel-draft";
import { replaceColorFormSchema } from "../../schemas";
import { ColorSwatch } from "../components/color-swatch";

export function ReplaceColorForm({
	disabled,
	draft,
	initialFrom,
	onApply,
	projectId,
}: {
	disabled: boolean;
	draft: PixelDraft;
	initialFrom: string;
	onApply: (values: { from: string; to: string }) => void;
	projectId: string;
}) {
	const form = useForm({
		defaultValues: {
			from: initialFrom,
			to: draft.palette.colors[0] ?? "",
		},
		validators: { onSubmit: replaceColorFormSchema },
		onSubmit: ({ value }) => onApply(replaceColorFormSchema.parse(value)),
	});
	const values = useStore(form.store, (state) => state.values);
	const preview = useColorReplacePreview(
		projectId,
		draft,
		values.from,
		values.to
	);

	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<p className="font-medium text-sm">Replace colour</p>
			<form.Field name="from">
				{(field) => (
					<Label className="block space-y-1 text-xs" htmlFor="replace-from">
						<span>Source colour</span>
						<NativeSelect
							className="w-full"
							id="replace-from"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						>
							{draft.usedColors.map((usage) => (
								<NativeSelectOption key={usage.color} value={usage.color}>
									{usage.color} ({usage.pixelCount} px)
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			<form.Field name="to">
				{(field) => (
					<Label className="block space-y-1 text-xs" htmlFor="replace-to">
						<span>Target palette colour</span>
						<NativeSelect
							className="w-full"
							id="replace-to"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						>
							{draft.palette.colors.map((color) => (
								<NativeSelectOption key={color} value={color}>
									{color}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			<p aria-live="polite" className="flex items-center gap-2 text-xs">
				<ColorSwatch color={values.from} />
				<span>to</span>
				<ColorSwatch color={values.to} />
				<span>
					{preview.data
						? `${preview.data.affectedPixelCount} pixels would change`
						: "Choose two colours to preview the change"}
				</span>
			</p>
			<Button
				disabled={
					disabled || !preview.data || preview.data.affectedPixelCount === 0
				}
				size="sm"
				type="submit"
				variant="outline"
			>
				Replace colour
			</Button>
		</form>
	);
}
