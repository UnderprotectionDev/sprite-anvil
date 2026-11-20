import type {
	AssetRecord,
	AssetRecordMeasurements,
} from "@sprite-anvil/api/asset-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import type { MeasurementDraft, MeasurementState } from "../../schemas";
import {
	draftKey,
	measurementsDraftFormSchema,
	measurementsSaveFailureMessage,
} from "../../schemas";

const measurementDefinitions = [
	{
		fields: [
			{ key: "width", label: "Width (px)" },
			{ key: "height", label: "Height (px)" },
		],
		key: "sourceImageDimensions",
		label: "Source Image Dimensions",
	},
	{
		fields: [
			{ key: "width", label: "Width (px)" },
			{ key: "height", label: "Height (px)" },
		],
		key: "logicalResolution",
		label: "Logical Resolution",
	},
	{
		fields: [
			{ key: "width", label: "Width (px)" },
			{ key: "height", label: "Height (px)" },
		],
		key: "cellDimensions",
		label: "Cell Dimensions",
	},
	{
		fields: [
			{ key: "x", label: "X (px)" },
			{ key: "y", label: "Y (px)" },
			{ key: "width", label: "Width (px)" },
			{ key: "height", label: "Height (px)" },
		],
		key: "visibleContentBounds",
		label: "Visible Content Bounds",
	},
	{
		fields: [{ key: "value", label: "Scale" }],
		key: "displayScale",
		label: "Display Scale",
	},
	{
		fields: [
			{ key: "width", label: "Width (px)" },
			{ key: "height", label: "Height (px)" },
		],
		key: "atlasDimensions",
		label: "Atlas Dimensions",
	},
] as const;

const measurementStates: readonly {
	key: MeasurementState;
	label: string;
}[] = [
	{ key: "proposal", label: "Proposal" },
	{ key: "confirmed", label: "Confirmed value" },
];

function draftFromMeasurements(
	measurements: AssetRecordMeasurements
): MeasurementDraft {
	const draft: MeasurementDraft = {};
	for (const definition of measurementDefinitions) {
		for (const state of measurementStates) {
			const value = measurements[definition.key][state.key];
			if (typeof value === "number") {
				draft[draftKey(definition.key, state.key, "value")] = String(value);
			} else if (value) {
				for (const [field, fieldValue] of Object.entries(value)) {
					draft[draftKey(definition.key, state.key, field)] =
						String(fieldValue);
				}
			}
		}
	}
	return draft;
}

function FieldGroup({
	definition,
	disabled,
	draft,
	onChange,
	state,
}: {
	definition: (typeof measurementDefinitions)[number];
	disabled: boolean;
	draft: MeasurementDraft;
	onChange: (key: string, value: string) => void;
	state: (typeof measurementStates)[number];
}) {
	const hasValue = definition.fields.some((field) =>
		Boolean(draft[draftKey(definition.key, state.key, field.key)]?.trim())
	);
	return (
		<FieldSet
			className="gap-0 space-y-3 rounded-md border p-3"
			disabled={disabled}
		>
			<FieldLegend className="mb-0 px-1">{state.label}</FieldLegend>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{definition.fields.map((field) => {
					const id = `${definition.key}-${state.key}-${field.key}`;
					const key = draftKey(definition.key, state.key, field.key);
					const minimum =
						definition.key === "displayScale" ||
						field.key === "x" ||
						field.key === "y"
							? 0
							: 1;
					return (
						<Label
							className="block space-y-1 text-sm leading-normal"
							htmlFor={id}
							key={field.key}
						>
							<span>
								{field.label}
								{hasValue ? " *" : ""}
							</span>
							<Input
								aria-describedby="asset-record-measurements-help"
								aria-label={`${definition.label} — ${state.label} — ${field.label}`}
								className="min-h-11"
								id={id}
								min={minimum}
								onChange={(event) => onChange(key, event.target.value)}
								required={hasValue}
								step={definition.key === "displayScale" ? "any" : 1}
								type="number"
								value={draft[key] ?? ""}
							/>
						</Label>
					);
				})}
			</div>
			{definition.key === "visibleContentBounds" ? (
				<Label
					className="block space-y-1 text-sm leading-normal"
					htmlFor={`${definition.key}-${state.key}-coordinateSpace`}
				>
					<span>
						Koordinat temeli
						{hasValue ? " *" : ""}
					</span>
					<NativeSelect
						aria-describedby="asset-record-measurements-help"
						aria-label={`${definition.label} — ${state.label} — Koordinat temeli`}
						className="w-full"
						id={`${definition.key}-${state.key}-coordinateSpace`}
						onChange={(event) =>
							onChange(
								draftKey(definition.key, state.key, "coordinateSpace"),
								event.target.value
							)
						}
						required={hasValue}
						value={
							draft[draftKey(definition.key, state.key, "coordinateSpace")] ??
							""
						}
					>
						<NativeSelectOption value="">Select</NativeSelectOption>
						<NativeSelectOption value="logicalResolution">
							Logical Resolution
						</NativeSelectOption>
						<NativeSelectOption value="cellDimensions">
							Cell Dimensions
						</NativeSelectOption>
					</NativeSelect>
				</Label>
			) : null}
		</FieldSet>
	);
}

export function AssetRecordMeasurementsForm({
	onRefresh,
	record,
}: {
	onRefresh: () => Promise<{ isError: boolean }>;
	record: AssetRecord;
}) {
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const updateMeasurements = useMutation(
		orpc.assetRecords.updateMeasurements.mutationOptions(mutationMeta)
	);

	const form = useForm({
		defaultValues: { draft: draftFromMeasurements(record.measurements) },
		onSubmit: async ({ formApi, value }) => {
			setErrorMessage(null);
			setStatusMessage(null);
			try {
				const { draft: measurements } =
					measurementsDraftFormSchema.parse(value);
				const saved = await updateMeasurements.mutateAsync({
					assetRecordId: record.id,
					measurements,
					projectId: record.projectId,
				});
				formApi.reset({ draft: draftFromMeasurements(saved.measurements) });
				const refreshed = await onRefresh();
				if (refreshed.isError) {
					setErrorMessage(
						"Dimensions saved, but the record could not be reloaded. Refresh the page to check the state."
					);
					return;
				}
				setStatusMessage("Dimensions saved.");
			} catch (error) {
				setErrorMessage(getErrorMessage(error, measurementsSaveFailureMessage));
			}
		},
		validators: { onSubmit: measurementsDraftFormSchema },
	});

	return (
		<section
			aria-labelledby="asset-record-measurements-heading"
			className="space-y-4 rounded-lg border p-5"
		>
			<header className="space-y-2">
				<h2
					className="text-xl font-semibold"
					id="asset-record-measurements-heading"
				>
					Image dimensions
				</h2>
				<p
					className="text-muted-foreground text-sm"
					id="asset-record-measurements-help"
				>
					Proposed and confirmed values are stored separately. File or sidecar
					dimensions alone do not establish Logical Resolution. You can use
					custom square and rectangular dimensions.
				</p>
			</header>
			<form.Subscribe selector={(state) => state.values.draft}>
				{(draft) =>
					["proposal", "confirmed"].some((state) => {
						const value = Number(
							draft[
								draftKey("displayScale", state as MeasurementState, "value")
							]
						);
						return (
							Number.isFinite(value) && value > 0 && !Number.isInteger(value)
						);
					}) ? (
						<p className="text-sm" role="status">
							A non-integer Display Scale can reduce pixel art sharpness.
							High-resolution illustrations are not subject to this rule.
						</p>
					) : null
				}
			</form.Subscribe>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="draft">
					{(field) => {
						const validationMessage =
							field.state.meta.errors[0]?.message ?? null;
						const shownError = errorMessage ?? validationMessage;
						return (
							<>
								{measurementDefinitions.map((definition) => (
									<section
										aria-labelledby={`${definition.key}-heading`}
										className="space-y-3 rounded-md border p-4"
										key={definition.key}
									>
										<h3
											className="font-medium"
											id={`${definition.key}-heading`}
										>
											{definition.label}
										</h3>
										<div className="grid gap-3 lg:grid-cols-2">
											{measurementStates.map((state) => (
												<form.Subscribe
													key={state.key}
													selector={(formState) => formState.isSubmitting}
												>
													{(isSaving) => (
														<FieldGroup
															definition={definition}
															disabled={isSaving}
															draft={field.state.value}
															onChange={(key, value) => {
																field.handleChange({
																	...field.state.value,
																	[key]: value,
																});
																setErrorMessage(null);
																setStatusMessage(null);
															}}
															state={state}
														/>
													)}
												</form.Subscribe>
											))}
										</div>
									</section>
								))}
								{shownError ? (
									<StatusMessage tone="error">{shownError}</StatusMessage>
								) : null}
							</>
						);
					}}
				</form.Field>
				{statusMessage ? (
					<p aria-live="polite" role="status">
						{statusMessage}
					</p>
				) : null}
				<form.Subscribe selector={(state) => state.isSubmitting}>
					{(isSaving) => (
						<Button className="min-h-11" disabled={isSaving} type="submit">
							{isSaving ? "Saving…" : "Save dimensions"}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</section>
	);
}
