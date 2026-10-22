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
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import {
	draftKey,
	type MeasurementDraft,
	type MeasurementState,
	measurementsDraftFormSchema,
	measurementsSaveFailureMessage,
} from "../../schemas";

const measurementDefinitions = [
	{
		fields: [
			{ key: "width", label: "Genişlik (px)" },
			{ key: "height", label: "Yükseklik (px)" },
		],
		key: "sourceImageDimensions",
		label: "Kaynak Görsel Ölçüsü",
	},
	{
		fields: [
			{ key: "width", label: "Genişlik (px)" },
			{ key: "height", label: "Yükseklik (px)" },
		],
		key: "logicalResolution",
		label: "Mantıksal Çözünürlük",
	},
	{
		fields: [
			{ key: "width", label: "Genişlik (px)" },
			{ key: "height", label: "Yükseklik (px)" },
		],
		key: "cellDimensions",
		label: "Hücre Ölçüsü",
	},
	{
		fields: [
			{ key: "x", label: "X (px)" },
			{ key: "y", label: "Y (px)" },
			{ key: "width", label: "Genişlik (px)" },
			{ key: "height", label: "Yükseklik (px)" },
		],
		key: "visibleContentBounds",
		label: "Görünür İçerik Sınırı",
	},
	{
		fields: [{ key: "value", label: "Ölçek" }],
		key: "displayScale",
		label: "Gösterim Ölçeği",
	},
	{
		fields: [
			{ key: "width", label: "Genişlik (px)" },
			{ key: "height", label: "Yükseklik (px)" },
		],
		key: "atlasDimensions",
		label: "Atlas Ölçüsü",
	},
] as const;

const measurementStates: readonly {
	key: MeasurementState;
	label: string;
}[] = [
	{ key: "proposal", label: "Öneri" },
	{ key: "confirmed", label: "Doğrulanmış değer" },
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
						<NativeSelectOption value="">Seçin</NativeSelectOption>
						<NativeSelectOption value="logicalResolution">
							Mantıksal Çözünürlük
						</NativeSelectOption>
						<NativeSelectOption value="cellDimensions">
							Hücre Ölçüsü
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
				formApi.setFieldValue(
					"draft",
					draftFromMeasurements(saved.measurements)
				);
				const refreshed = await onRefresh();
				if (refreshed.isError) {
					setErrorMessage(
						"Ölçüler kaydedildi ancak kayıt yeniden okunamadı. Sayfayı yenileyerek durumu kontrol edin."
					);
					return;
				}
				setStatusMessage("Ölçüler kaydedildi.");
			} catch (error) {
				setErrorMessage(getErrorMessage(error, measurementsSaveFailureMessage));
			}
		},
		validators: { onSubmit: measurementsDraftFormSchema },
	});

	useEffect(() => {
		form.setFieldValue("draft", draftFromMeasurements(record.measurements));
	}, [form, record.measurements]);

	return (
		<section
			aria-labelledby="asset-record-measurements-heading"
			className="space-y-4 rounded-lg border p-5"
		>
			<header className="space-y-2">
				<h2
					className="font-semibold text-xl"
					id="asset-record-measurements-heading"
				>
					Görsel ölçüleri
				</h2>
				<p
					className="text-muted-foreground text-sm"
					id="asset-record-measurements-help"
				>
					Öneri ve doğrulanmış değer ayrı saklanır. Dosya veya sidecar ölçüsü
					tek başına Mantıksal Çözünürlük değildir. Özel kare ve dikdörtgen
					ölçüler kullanabilirsiniz.
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
							Piksel sanatında doğal sayı olmayan Gösterim Ölçeği keskinliği
							bozabilir. Yüksek çözünürlüklü illüstrasyonlar bu kurala
							zorlanmaz.
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
									<p aria-live="assertive" role="alert">
										{shownError}
									</p>
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
							{isSaving ? "Kaydediliyor…" : "Ölçüleri kaydet"}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</section>
	);
}
