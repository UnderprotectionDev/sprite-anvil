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
import { useCorrectionAnnotations } from "../../hooks/use-correction-annotations";
import { usePrepareCorrection } from "../../hooks/use-prepare-correction";
import {
	defaultExpectedOutputStructure,
	defaultPreserveConstraint,
} from "../../lib/correction-package";
import { correctionFormSchema } from "../../schemas";
import { AnnotationEditor } from "./annotation-editor";

const regionFields = [
	["regionX", "Left (x)"],
	["regionY", "Top (y)"],
	["regionWidth", "Width"],
	["regionHeight", "Height"],
] as const;

const instructionFields = [
	{
		name: "targetTask",
		label: "Target task",
		hint: "What the generation should do. Leave empty to use the issue note.",
	},
	{
		name: "changeInstruction",
		label: "Change instruction",
		hint: "What must change. Leave empty to use the issue note.",
	},
	{
		name: "expectedOutputStructure",
		label: "Expected output structure",
		hint: `Leave empty for: ${defaultExpectedOutputStructure}`,
	},
	{
		name: "preserveConstraints",
		label: "Preserve constraints (one per line)",
		hint: `Leave empty for: ${defaultPreserveConstraint}`,
	},
	{
		name: "avoidConstraints",
		label: "Avoid constraints (one per line)",
		hint: "Optional.",
	},
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
	const annotations = useCorrectionAnnotations();
	const [prepared, setPrepared] = useState<GenerationPackage | null>(null);
	const { keptUnitIds, prepare, units } = usePrepareCorrection(
		projectId,
		draft
	);
	const form = useForm({
		defaultValues: {
			issueNote: "",
			regionX: String(selection?.x ?? 0),
			regionY: String(selection?.y ?? 0),
			regionWidth: String(selection?.width ?? draft.size.width),
			regionHeight: String(selection?.height ?? draft.size.height),
			targetUnitVersionId: "",
			preservedUnitVersionIds: null as string[] | null,
			targetTask: "",
			changeInstruction: "",
			expectedOutputStructure: "",
			preserveConstraints: "",
			avoidConstraints: "",
		},
		validators: { onSubmit: correctionFormSchema },
		onSubmit: async ({ value }) => {
			const v = correctionFormSchema.parse(value);
			try {
				setPrepared(
					await prepare.mutateAsync({
						annotations: annotations.marks,
						avoidConstraints: v.avoidConstraints,
						changeInstruction: v.changeInstruction,
						expectedOutputStructure: v.expectedOutputStructure,
						issueNote: v.issueNote,
						preserveConstraints: v.preserveConstraints,
						preservedUnitVersionIds: v.preservedUnitVersionIds ?? keptUnitIds,
						redrawRegion: {
							x: v.regionX,
							y: v.regionY,
							width: v.regionWidth,
							height: v.regionHeight,
						},
						targetTask: v.targetTask,
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
				Annotations never change pixels, the source or the Working Draft. The
				package records Working Draft revision {draft.revision} at{" "}
				{draft.size.width}×{draft.size.height} px as the coordinate space.
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
				{instructionFields.map(({ hint, label, name }) => (
					<form.Field key={name} name={name}>
						{(field) => (
							<Label
								className="block space-y-1 text-xs"
								htmlFor={`correction-${name}`}
							>
								<span>{label}</span>
								<Textarea
									id={`correction-${name}`}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
								<span className="block text-muted-foreground">{hint}</span>
							</Label>
						)}
					</form.Field>
				))}
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
					{(field) => {
						const chosen = field.state.value ?? keptUnitIds;
						return (
							<fieldset className="space-y-1">
								<legend className="font-medium text-xs">
									Preserve these Unit Versions
								</legend>
								{keptUnitIds.length > 0 ? (
									<p className="text-muted-foreground text-xs">
										Units of frames marked Keep are preserved by default. Untick
										one to let the generation change it.
									</p>
								) : null}
								{units.length === 0 ? (
									<p className="text-muted-foreground text-xs">
										This Asset Record has no Unit Versions to preserve.
									</p>
								) : null}
								{units.map((unit) => (
									<Label className="items-center gap-2 text-xs" key={unit.id}>
										<Checkbox
											checked={chosen.includes(unit.id)}
											onCheckedChange={(checked) =>
												field.handleChange(
													checked
														? [...chosen, unit.id]
														: chosen.filter((id) => id !== unit.id)
												)
											}
										/>
										<span>{unit.label}</span>
										{keptUnitIds.includes(unit.id) ? (
											<span className="text-muted-foreground">(Keep)</span>
										) : null}
									</Label>
								))}
							</fieldset>
						);
					}}
				</form.Field>
				<AnnotationEditor
					entries={annotations.entries}
					onAdd={annotations.add}
					onRemove={annotations.remove}
				/>
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
