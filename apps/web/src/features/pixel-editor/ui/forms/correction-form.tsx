import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type { PixelDraft, PixelRect } from "@sprite-anvil/api/pixel-editor";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
	type CorrectionAnnotation,
	usePrepareCorrection,
} from "../../hooks/use-prepare-correction";
import {
	correctionAnnotationFormSchema,
	correctionFormSchema,
} from "../../schemas";

function describe(mark: CorrectionAnnotation) {
	switch (mark.kind) {
		case "region":
			return `Region ${mark.rect.width}×${mark.rect.height} at ${mark.rect.x},${mark.rect.y}`;
		case "note":
			return `Note at ${mark.at.x},${mark.at.y}: ${mark.text}`;
		default:
			return `${mark.kind === "arrow" ? "Arrow" : "Line"} ${mark.from.x},${mark.from.y} to ${mark.to.x},${mark.to.y}`;
	}
}

type CoordinateField = readonly ["x" | "y" | "x2" | "y2", string];

function coordinateFields(
	kind: CorrectionAnnotation["kind"]
): CoordinateField[] {
	const isRegion = kind === "region";
	const origin: CoordinateField[] = [
		["x", isRegion ? "Left (x)" : "From x"],
		["y", isRegion ? "Top (y)" : "From y"],
	];
	if (kind === "note") {
		return origin;
	}
	return [
		...origin,
		["x2", isRegion ? "Width" : "To x"],
		["y2", isRegion ? "Height" : "To y"],
	];
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
			const v = correctionAnnotationFormSchema.parse(value);
			if (v.kind === "note") {
				if (!v.text) {
					return;
				}
				onAdd({ kind: "note", at: { x: v.x, y: v.y }, text: v.text });
			} else if (v.kind === "region") {
				onAdd({
					kind: "region",
					rect: {
						x: v.x,
						y: v.y,
						width: Math.max(1, v.x2),
						height: Math.max(1, v.y2),
					},
				});
			} else {
				onAdd({
					kind: v.kind,
					from: { x: v.x, y: v.y },
					to: { x: v.x2, y: v.y2 },
				});
			}
			formApi.reset();
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
							<NativeSelectOption value="arrow">Arrow</NativeSelectOption>
							<NativeSelectOption value="line">Line</NativeSelectOption>
							<NativeSelectOption value="region">Region</NativeSelectOption>
							<NativeSelectOption value="note">Text note</NativeSelectOption>
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

const regionFields = [
	["regionX", "Left (x)"],
	["regionY", "Top (y)"],
	["regionWidth", "Width"],
	["regionHeight", "Height"],
] as const;

/**
 * Prepares a Production Package for a selective correction. Annotations stay
 * in this form; they are sent with the package and never change pixels.
 */
export function CorrectionForm({
	disabled,
	draft,
	projectId,
	selection,
}: {
	disabled: boolean;
	draft: PixelDraft;
	projectId: string;
	selection: PixelRect | null;
}) {
	const [entries, setEntries] = useState<
		{ id: string; mark: CorrectionAnnotation }[]
	>([]);
	const [prepared, setPrepared] = useState<GenerationPackage | null>(null);
	const { prepare, units } = usePrepareCorrection(projectId, draft);
	const form = useForm({
		defaultValues: {
			issueNote: "",
			regionX: String(selection?.x ?? 0),
			regionY: String(selection?.y ?? 0),
			regionWidth: String(selection?.width ?? draft.size.width),
			regionHeight: String(selection?.height ?? draft.size.height),
			targetUnitVersionId: "",
			preservedUnitVersionIds: [] as string[],
		},
		validators: { onSubmit: correctionFormSchema },
		onSubmit: async ({ value }) => {
			const v = correctionFormSchema.parse(value);
			try {
				setPrepared(
					await prepare.mutateAsync({
						annotations: entries.map((entry) => entry.mark),
						issueNote: v.issueNote,
						preservedUnitVersionIds: v.preservedUnitVersionIds,
						redrawRegion: {
							x: v.regionX,
							y: v.regionY,
							width: v.regionWidth,
							height: v.regionHeight,
						},
						targetUnitVersionId: v.targetUnitVersionId || null,
					})
				);
			} catch {
				// The mutation error is rendered below.
			}
		},
	});

	return (
		<section aria-label="Prepare Production Package" className="space-y-3">
			<h3 className="font-medium text-sm">Prepare Production Package</h3>
			<p className="text-muted-foreground text-xs">
				Sends the region, note and preserved units to a new Production Package.
				Annotations never change pixels, the source or the Working Draft.
			</p>
			<form
				className="space-y-3"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="issueNote">
					{(field) => (
						<Label className="block space-y-1 text-xs" htmlFor="issue-note">
							<span>Issue note</span>
							<Textarea
								id="issue-note"
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<fieldset className="space-y-2">
					<legend className="font-medium text-xs">Redraw region (px)</legend>
					<div className="grid grid-cols-2 gap-2">
						{regionFields.map(([name, label]) => (
							<form.Field key={name} name={name}>
								{(field) => (
									<Label
										className="block space-y-1 text-xs"
										htmlFor={`correction-${name}`}
									>
										<span>{label}</span>
										<Input
											id={`correction-${name}`}
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
					</div>
					<Button
						disabled={!selection}
						onClick={() => {
							if (selection) {
								form.setFieldValue("regionX", String(selection.x));
								form.setFieldValue("regionY", String(selection.y));
								form.setFieldValue("regionWidth", String(selection.width));
								form.setFieldValue("regionHeight", String(selection.height));
							}
						}}
						size="sm"
						type="button"
						variant="outline"
					>
						Use current selection
					</Button>
				</fieldset>
				<form.Field name="targetUnitVersionId">
					{(field) => (
						<Label className="block space-y-1 text-xs" htmlFor="target-unit">
							<span>Target Unit Version</span>
							<NativeSelect
								className="w-full"
								id="target-unit"
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							>
								<NativeSelectOption value="">Whole version</NativeSelectOption>
								{units.map((unit) => (
									<NativeSelectOption key={unit.id} value={unit.id}>
										{unit.label}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="preservedUnitVersionIds">
					{(field) => (
						<fieldset className="space-y-1">
							<legend className="font-medium text-xs">
								Preserve these Unit Versions
							</legend>
							{units.length === 0 ? (
								<p className="text-muted-foreground text-xs">
									This Asset Record has no Unit Versions to preserve.
								</p>
							) : null}
							{units.map((unit) => (
								<Label className="items-center gap-2 text-xs" key={unit.id}>
									<Checkbox
										checked={field.state.value.includes(unit.id)}
										onCheckedChange={(checked) =>
											field.handleChange(
												checked
													? [...field.state.value, unit.id]
													: field.state.value.filter((id) => id !== unit.id)
											)
										}
									/>
									<span>{unit.label}</span>
								</Label>
							))}
						</fieldset>
					)}
				</form.Field>
				<AnnotationAdder
					onAdd={(mark) =>
						setEntries((current) => [
							...current,
							{ id: crypto.randomUUID(), mark },
						])
					}
				/>
				{entries.length > 0 ? (
					<ul aria-label="Annotations" className="space-y-1 text-xs">
						{entries.map(({ id, mark }) => (
							<li className="flex items-center justify-between gap-2" key={id}>
								<span>{describe(mark)}</span>
								<Button
									aria-label={`Remove annotation: ${describe(mark)}`}
									onClick={() =>
										setEntries((current) =>
											current.filter((entry) => entry.id !== id)
										)
									}
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
				<Button disabled={disabled || prepare.isPending} type="submit">
					Prepare Production Package
				</Button>
			</form>
			{prepare.isError ? (
				<p className="text-destructive text-xs" role="alert">
					{prepare.error instanceof Error
						? prepare.error.message
						: "The Production Package could not be prepared."}
				</p>
			) : null}
			{prepared ? (
				<p className="text-xs" role="status">
					Production Package prepared with {prepared.lockedUnits.length}{" "}
					preserved unit(s). A returned result is imported as a separate option
					and never replaces this draft.
				</p>
			) : null}
		</section>
	);
}
