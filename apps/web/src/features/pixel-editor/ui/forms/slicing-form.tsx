import {
	type SheetReadingOrder,
	type SheetSlicing,
	sheetReadingOrders,
} from "@sprite-anvil/api/pixel-editor-structure";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { StatusMessage } from "@/components/status-message";
import { slicingFormSchema } from "../../schemas";

const readingOrderLabels: Record<SheetReadingOrder, string> = {
	"rows-left-to-right": "Rows, left to right",
	"rows-right-to-left": "Rows, right to left",
	"columns-top-to-bottom": "Columns, top to bottom",
	"columns-bottom-to-top": "Columns, bottom to top",
};

const numberFields = [
	["cellWidth", "Cell width (px)"],
	["cellHeight", "Cell height (px)"],
	["columns", "Columns"],
	["rows", "Rows"],
	["offsetX", "Start offset X (px)"],
	["offsetY", "Start offset Y (px)"],
	["gapX", "Gap X (px)"],
	["gapY", "Gap Y (px)"],
] as const;

/** Slicing parameters: preview never changes the source; applying creates the frames. */
export function SlicingForm({
	disabled,
	initial,
	onApply,
	onPreview,
}: {
	disabled: boolean;
	initial: SheetSlicing;
	onApply: (slicing: SheetSlicing) => void;
	onPreview: (slicing: SheetSlicing) => void;
}) {
	const form = useForm({
		defaultValues: {
			cellWidth: String(initial.cellWidth),
			cellHeight: String(initial.cellHeight),
			columns: String(initial.columns),
			rows: String(initial.rows),
			offsetX: String(initial.offsetX),
			offsetY: String(initial.offsetY),
			gapX: String(initial.gapX),
			gapY: String(initial.gapY),
			readingOrder: initial.readingOrder as SheetReadingOrder,
		},
		validators: { onSubmit: slicingFormSchema },
		onSubmit: ({ value }) => onApply(slicingFormSchema.parse(value)),
	});

	return (
		<form
			className="space-y-3"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<p className="font-medium text-sm">Sprite sheet slicing</p>
			<div className="grid grid-cols-2 gap-2">
				{numberFields.map(([name, label]) => (
					<form.Field key={name} name={name}>
						{(field) => (
							<Label className="space-y-1 text-xs" htmlFor={`slicing-${name}`}>
								<span>{label}</span>
								<Input
									aria-invalid={field.state.meta.errors.length > 0}
									id={`slicing-${name}`}
									inputMode="numeric"
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
				))}
			</div>
			<form.Field name="readingOrder">
				{(field) => (
					<Label className="block space-y-1 text-xs" htmlFor="slicing-order">
						<span>Reading order</span>
						<NativeSelect
							className="w-full"
							id="slicing-order"
							onChange={(event) =>
								field.handleChange(event.target.value as SheetReadingOrder)
							}
							value={field.state.value}
						>
							{sheetReadingOrders.map((order) => (
								<NativeSelectOption key={order} value={order}>
									{readingOrderLabels[order]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.errors}>
				{(errors) =>
					errors.length > 0 ? (
						<StatusMessage tone="error">
							Check the highlighted numbers: all values must be whole numbers
							within range.
						</StatusMessage>
					) : null
				}
			</form.Subscribe>
			<div className="flex flex-wrap gap-2">
				<Button
					disabled={disabled}
					onClick={() => {
						const parsed = slicingFormSchema.safeParse(form.state.values);
						if (parsed.success) {
							onPreview(parsed.data);
						}
					}}
					size="sm"
					type="button"
					variant="outline"
				>
					Preview slicing
				</Button>
				<Button disabled={disabled} size="sm" type="submit">
					Apply slicing
				</Button>
			</div>
		</form>
	);
}
