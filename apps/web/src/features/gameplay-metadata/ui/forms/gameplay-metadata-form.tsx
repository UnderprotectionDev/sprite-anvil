import {
	type GameplayMetadataFrame,
	type GameplayMetadataRecord,
	type GameplayMetadataWriteInput,
	gameplayMetadataFieldIds,
	getGameplayMetadataFields,
} from "@sprite-anvil/api/gameplay-metadata";
import type { SpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useId, useState } from "react";
import {
	type GameplayMetadataFormValues,
	gameplayMetadataFormSchema,
} from "../../schemas";

type Draft = Omit<
	GameplayMetadataWriteInput,
	"id" | "projectId" | "assetRecordId"
>;

function frameIdentity(frame: GameplayMetadataFrame | undefined) {
	return frame ? JSON.stringify([frame.assetVersionId, frame.frameKey]) : "";
}

function pivotIdentity(pivot: GameplayMetadataFrame["sourcePivots"][number]) {
	return JSON.stringify([
		pivot.proposalId,
		pivot.sourceEntryId,
		pivot.sourcePath,
	]);
}

export function GameplayMetadataForm({
	frames,
	contracts,
	onSave,
	disabled,
	initialRecord,
}: {
	frames: GameplayMetadataFrame[];
	contracts: (SpecializedProfileContract & { contractRevisionId: string })[];
	onSave: (draft: Draft) => Promise<boolean>;
	disabled: boolean;
	initialRecord?: GameplayMetadataRecord;
}) {
	const formId = useId();
	// Shown from the latest submit until the next one, as a single alert.
	const [error, setError] = useState<string | null>(null);
	function resolve(draft: GameplayMetadataFormValues) {
		const frame = frames.find(
			(candidate) => frameIdentity(candidate) === draft.frame
		);
		const contract = contracts.find(
			(candidate) => candidate.contractRevisionId === draft.contractRevision
		);
		return {
			frame,
			contract,
			definitions: contract ? getGameplayMetadataFields(contract) : [],
			sourcePivot: frame?.sourcePivots.find(
				(pivot) => pivotIdentity(pivot) === draft.sourcePivot
			),
		};
	}
	const schema = gameplayMetadataFormSchema(resolve);
	// The draft is seeded once, so later catalog reorders never reset it.
	const [defaultValues] = useState<GameplayMetadataFormValues>(() => {
		const pivot = initialRecord?.fields.find(
			(field) => field.fieldId === "pivot"
		);
		return {
			frame: frameIdentity(
				initialRecord ? { ...initialRecord, sourcePivots: [] } : frames[0]
			),
			contractRevision:
				initialRecord?.contractRevisionId ??
				contracts[0]?.contractRevisionId ??
				"",
			useContext: initialRecord?.useContext ?? "",
			fieldValues: Object.fromEntries(
				initialRecord?.fields.map((field) => [
					field.fieldId,
					field.value === null ? "" : JSON.stringify(field.value),
				]) ?? []
			),
			sourcePivot:
				pivot?.source.kind === "finalized_source"
					? pivotIdentity({ ...pivot.source, value: pivot.value })
					: "",
		};
	});
	const form = useForm({
		defaultValues,
		onSubmit: async ({ value }) => {
			const { frame, contract, definitions, sourcePivot } = resolve(value);
			if (!(frame && contract)) {
				return;
			}
			const fields = definitions.flatMap((definition): Draft["fields"] => {
				const fieldId = gameplayMetadataFieldIds.find(
					(candidate) => candidate === definition.id
				);
				if (!fieldId) {
					return [];
				}
				const pivot = fieldId === "pivot" ? sourcePivot : undefined;
				if (pivot) {
					const { value: _value, ...source } = pivot;
					return [{ fieldId, source }];
				}
				const text = value.fieldValues[fieldId]?.trim();
				return [
					{
						fieldId,
						source: text
							? { kind: "authored" as const, value: JSON.parse(text) }
							: null,
					},
				];
			});
			try {
				await onSave({
					assetVersionId: frame.assetVersionId,
					frameKey: frame.frameKey,
					profileId: contract.profileId,
					contractRevisionId: contract.contractRevisionId,
					useContext: value.useContext.trim(),
					fields,
				});
			} catch (failure) {
				setError(
					failure instanceof Error
						? failure.message
						: "Oyun içi bilgiler kaydedilemedi."
				);
			}
		},
		onSubmitInvalid: ({ formApi }) => {
			const [message] = formApi.state.errors;
			setError(typeof message === "string" ? message : null);
		},
		validators: {
			onSubmit: ({ value }) =>
				schema.safeParse(value).error?.issues[0]?.message,
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const { frame, contract, definitions, sourcePivot } = resolve(values);
	const selectedSourcePivot = values.sourcePivot;

	function clearDraftFields() {
		form.setFieldValue("sourcePivot", "");
		form.setFieldValue("fieldValues", {});
	}

	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				setError(null);
				void form.handleSubmit();
			}}
		>
			<FieldSet
				className="space-y-4"
				disabled={disabled || !frames.length || !contracts.length}
			>
				<form.Field name="frame">
					{(field) => (
						<Label className="block space-y-1" htmlFor={`${formId}-frame`}>
							<span>Kare ve kesin sürüm</span>
							<NativeSelect
								className="w-full"
								disabled={Boolean(initialRecord)}
								id={`${formId}-frame`}
								onChange={(event) => {
									field.handleChange(event.target.value);
									clearDraftFields();
								}}
								value={field.state.value}
							>
								<NativeSelectOption value="">Kare seçin</NativeSelectOption>
								{frames.map((candidate) => (
									<NativeSelectOption
										key={`${candidate.assetVersionId}:${candidate.frameKey}`}
										value={frameIdentity(candidate)}
									>
										{candidate.frameKey} — {candidate.assetVersionId}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="contractRevision">
					{(field) => (
						<Label className="block space-y-1" htmlFor={`${formId}-profile`}>
							<span>Etkin özel profil</span>
							<NativeSelect
								className="w-full"
								disabled={Boolean(initialRecord)}
								id={`${formId}-profile`}
								onChange={(event) => {
									field.handleChange(event.target.value);
									clearDraftFields();
								}}
								value={field.state.value}
							>
								<NativeSelectOption value="">Profil seçin</NativeSelectOption>
								{contracts.map((definition) => (
									<NativeSelectOption
										key={definition.contractRevisionId}
										value={definition.contractRevisionId}
									>
										{definition.name} {definition.version}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="useContext">
					{(field) => (
						<Label className="block space-y-1" htmlFor={`${formId}-context`}>
							<span>Kullanım bağlamı</span>
							<Input
								className="w-full"
								id={`${formId}-context`}
								maxLength={512}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								required
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				{definitions.some((definition) => definition.id === "pivot") &&
					Boolean(frame?.sourcePivots.length) && (
						<form.Field name="sourcePivot">
							{(field) => (
								<Label
									className="block space-y-1"
									htmlFor={`${formId}-source-pivot`}
								>
									<span>Dönüş noktası kaynağı</span>
									<NativeSelect
										className="w-full"
										id={`${formId}-source-pivot`}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									>
										<NativeSelectOption value="">Elle yaz</NativeSelectOption>
										{frame?.sourcePivots.map((pivot) => (
											<NativeSelectOption
												key={pivotIdentity(pivot)}
												value={pivotIdentity(pivot)}
											>
												Kesinleştirilmiş kaynak: {JSON.stringify(pivot.value)}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Label>
							)}
						</form.Field>
					)}
				{definitions.map((definition) => (
					<div className="space-y-1" key={definition.id}>
						<Label className="block" htmlFor={`${formId}-${definition.id}`}>
							{definition.label} (JSON)
						</Label>
						<form.Field name={`fieldValues.${definition.id}`}>
							{(field) => (
								<Textarea
									aria-describedby={`${formId}-${definition.id}-help`}
									className="min-h-20 w-full font-mono text-sm"
									disabled={
										definition.id === "pivot" && selectedSourcePivot !== ""
									}
									id={`${formId}-${definition.id}`}
									maxLength={16_384}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={
										definition.id === "pivot" && selectedSourcePivot !== ""
											? JSON.stringify(sourcePivot?.value)
											: (field.state.value ?? "")
									}
								/>
							)}
						</form.Field>
						<p
							className="text-muted-foreground text-sm"
							id={`${formId}-${definition.id}-help`}
						>
							{definition.required ? "Zorunlu" : "Boş bırakılırsa Bilinmiyor"} ·{" "}
							{definition.unit ?? "birimsiz"} ·{" "}
							{definition.coordinateSystem ?? "koordinat sistemi yok"}
						</p>
						{contract?.exportMappings
							.filter((mapping) => mapping.fieldId === definition.id)
							.map((mapping) => (
								<p className="text-muted-foreground text-sm" key={mapping.id}>
									Dışa aktarım: {mapping.targetPath} · Eksik değer:{" "}
									{mapping.absentBehavior} · Yeniden okuma:{" "}
									{mapping.readbackCheck}
								</p>
							))}
					</div>
				))}
				<p className="text-muted-foreground text-sm">
					Vuruş alanı (hitbox), hasar alma alanı (hurtbox) ve çarpışma
					bilgilerini Çarpışma alanları içinde açıkça yazın. Görsel şeffaflıktan
					oyun fiziği üretilmez. Nokta örneği: {'{"x":12,"y":24}'}.
				</p>
				<Button disabled={!(frame && contract)} type="submit">
					Oyun içi bilgileri kaydet
				</Button>
			</FieldSet>
			{Boolean(error) && <p role="alert">{error}</p>}
			{Boolean(initialRecord) && !frame && (
				<p role="alert">
					Bütünlük hatası: düzenlenen kaydın kare veya kesin sürüm bağlantısı
					kayboldu.
				</p>
			)}
		</form>
	);
}
