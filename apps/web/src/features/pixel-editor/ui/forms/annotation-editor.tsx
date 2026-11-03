import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type {
	AnnotationEntry,
	CorrectionAnnotation,
} from "../../hooks/use-correction-annotations";
import { correctionAnnotationFormSchema } from "../../schemas";

const kindLabels: Record<CorrectionAnnotation["kind"], string> = {
	arrow: "Arrow",
	line: "Line",
	region: "Region",
	note: "Text note",
	pivot: "Pivot",
	"ground-line": "Ground line",
};

function describe(mark: CorrectionAnnotation) {
	switch (mark.kind) {
		case "region":
			return `Region ${mark.rect.width}×${mark.rect.height} at ${mark.rect.x},${mark.rect.y}`;
		case "note":
			return `Note at ${mark.at.x},${mark.at.y}: ${mark.text}`;
		case "pivot":
			return `Pivot at ${mark.at.x},${mark.at.y}`;
		case "ground-line":
			return `Ground line at row ${mark.y}`;
		default:
			return `${kindLabels[mark.kind]} ${mark.from.x},${mark.from.y} to ${mark.to.x},${mark.to.y}`;
	}
}

type CoordinateField = readonly ["x" | "y" | "x2" | "y2", string];

function coordinateFields(
	kind: CorrectionAnnotation["kind"]
): CoordinateField[] {
	switch (kind) {
		case "ground-line":
			return [["y", "Row (y)"]];
		case "pivot":
			return [
				["x", "Pivot x"],
				["y", "Pivot y"],
			];
		case "note":
			return [
				["x", "From x"],
				["y", "From y"],
			];
		case "region":
			return [
				["x", "Left (x)"],
				["y", "Top (y)"],
				["x2", "Width"],
				["y2", "Height"],
			];
		default:
			return [
				["x", "From x"],
				["y", "From y"],
				["x2", "To x"],
				["y2", "To y"],
			];
	}
}

type FormValues = ReturnType<typeof correctionAnnotationFormSchema.parse>;

function toMark(v: FormValues): CorrectionAnnotation | null {
	switch (v.kind) {
		case "note":
			return v.text
				? { kind: "note", at: { x: v.x, y: v.y }, text: v.text }
				: null;
		case "region":
			return {
				kind: "region",
				rect: {
					x: v.x,
					y: v.y,
					width: Math.max(1, v.x2),
					height: Math.max(1, v.y2),
				},
			};
		case "pivot":
			return { kind: "pivot", at: { x: v.x, y: v.y } };
		case "ground-line":
			return { kind: "ground-line", y: v.y };
		default:
			return {
				kind: v.kind,
				from: { x: v.x, y: v.y },
				to: { x: v.x2, y: v.y2 },
			};
	}
}

function AnnotationAdder({
	onAdd,
}: {
	onAdd: (mark: CorrectionAnnotation) => void;
}) {
	const form = useForm({
		defaultValues: {
			kind: "arrow" as CorrectionAnnotation["kind"],
			x: "0",
			y: "0",
			x2: "1",
			y2: "1",
			text: "",
		},
		validators: { onSubmit: correctionAnnotationFormSchema },
		onSubmit: ({ value, formApi }) => {
			const mark = toMark(correctionAnnotationFormSchema.parse(value));
			if (mark) {
				onAdd(mark);
				formApi.reset();
			}
		},
	});
	return (
		<div className="space-y-2 rounded-md border p-2">
			<p className="font-medium text-xs">Add an annotation</p>
			<form.Field name="kind">
				{(field) => (
					<Label className="block space-y-1 text-xs" htmlFor="annotation-kind">
						<span>Annotation type</span>
						<NativeSelect
							className="w-full"
							id="annotation-kind"
							onChange={(event) =>
								field.handleChange(
									event.target.value as CorrectionAnnotation["kind"]
								)
							}
							value={field.state.value}
						>
							{Object.entries(kindLabels).map(([kind, label]) => (
								<NativeSelectOption key={kind} value={kind}>
									{label}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.values.kind}>
				{(kind) => (
					<div className="grid grid-cols-2 gap-2">
						{coordinateFields(kind).map(([name, label]) => (
							<form.Field key={name} name={name}>
								{(field) => (
									<Label
										className="block space-y-1 text-xs"
										htmlFor={`annotation-${name}`}
									>
										<span>{label}</span>
										<Input
											id={`annotation-${name}`}
											inputMode="numeric"
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											value={field.state.value}
										/>
									</Label>
								)}
							</form.Field>
						))}
						{kind === "note" ? (
							<form.Field name="text">
								{(field) => (
									<Label
										className="col-span-2 block space-y-1 text-xs"
										htmlFor="annotation-text"
									>
										<span>Note text</span>
										<Input
											id="annotation-text"
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											value={field.state.value}
										/>
									</Label>
								)}
							</form.Field>
						) : null}
					</div>
				)}
			</form.Subscribe>
			<Button
				onClick={() => form.handleSubmit()}
				size="sm"
				type="button"
				variant="outline"
			>
				Add annotation
			</Button>
		</div>
	);
}

/**
 * Annotations for a correction, in the Working Draft's pixel coordinates.
 * Includes the pivot and ground line marks; none of them change pixels.
 */
export function AnnotationEditor({
	entries,
	onAdd,
	onRemove,
}: {
	entries: AnnotationEntry[];
	onAdd: (mark: CorrectionAnnotation) => void;
	onRemove: (id: string) => void;
}) {
	return (
		<div className="space-y-2">
			<AnnotationAdder onAdd={onAdd} />
			{entries.length > 0 ? (
				<ul aria-label="Annotations" className="space-y-1 text-xs">
					{entries.map(({ id, mark }) => (
						<li className="flex items-center justify-between gap-2" key={id}>
							<span>{describe(mark)}</span>
							<Button
								aria-label={`Remove annotation: ${describe(mark)}`}
								onClick={() => onRemove(id)}
								size="sm"
								type="button"
								variant="ghost"
							>
								Remove
							</Button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
