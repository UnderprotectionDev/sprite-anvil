import {
	type GameplayMetadataFrame,
	type GameplayMetadataWriteInput,
	gameplayMetadataFieldIds,
	getGameplayMetadataFields,
} from "@sprite-anvil/api/gameplay-metadata";
import type { SpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { type SyntheticEvent, useId, useState } from "react";

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
}: {
	frames: GameplayMetadataFrame[];
	contracts: (SpecializedProfileContract & { contractRevisionId: string })[];
	onSave: (draft: Draft) => Promise<boolean>;
	disabled: boolean;
}) {
	const formId = useId();
	const [selectedFrame, setSelectedFrame] = useState(() =>
		frameIdentity(frames[0])
	);
	const [selectedContractRevision, setSelectedContractRevision] = useState(
		() => contracts[0]?.contractRevisionId ?? ""
	);
	const [useContext, setUseContext] = useState("");
	const [values, setValues] = useState<Record<string, string>>({});
	const [selectedSourcePivot, setSelectedSourcePivot] = useState("");
	const [error, setError] = useState<string | null>(null);
	const frame = frames.find(
		(candidate) => frameIdentity(candidate) === selectedFrame
	);
	const contract = contracts.find(
		(candidate) => candidate.contractRevisionId === selectedContractRevision
	);
	const definitions = contract ? getGameplayMetadataFields(contract) : [];
	const sourcePivot = frame?.sourcePivots.find(
		(pivot) => pivotIdentity(pivot) === selectedSourcePivot
	);

	async function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		if (!(frame && contract && useContext.trim())) {
			setError("Kare, etkin profil ve kullanım bağlamı seçin.");
			return;
		}
		try {
			if (selectedSourcePivot && !sourcePivot) {
				throw new Error(
					"Seçili kaynak artık kullanılamıyor. Dönüş noktası kaynağını yeniden seçin."
				);
			}
			const fields = definitions.map((definition) => {
				const fieldId = gameplayMetadataFieldIds.find(
					(candidate) => candidate === definition.id
				);
				if (!fieldId) {
					throw new Error("Desteklenmeyen alan.");
				}
				const pivot = fieldId === "pivot" ? sourcePivot : undefined;
				if (pivot) {
					const { value: _value, ...source } = pivot;
					return { fieldId, source };
				}
				const text = values[fieldId]?.trim();
				if (!text && definition.required) {
					throw new Error(`${definition.label} zorunludur.`);
				}
				return {
					fieldId,
					source: text
						? { kind: "authored" as const, value: JSON.parse(text) }
						: null,
				};
			});
			await onSave({
				assetVersionId: frame.assetVersionId,
				frameKey: frame.frameKey,
				profileId: contract.profileId,
				contractRevisionId: contract.contractRevisionId,
				useContext: useContext.trim(),
				fields,
			});
		} catch (failure) {
			if (failure instanceof SyntaxError) {
				setError(
					"Alanlara geçerli JSON girin; boş isteğe bağlı alanlar Bilinmiyor kalır."
				);
			} else {
				setError(
					failure instanceof Error
						? failure.message
						: "Oyun içi bilgiler kaydedilemedi."
				);
			}
		}
	}

	return (
		<form className="space-y-4" onSubmit={submit}>
			<fieldset
				className="space-y-4"
				disabled={disabled || !frames.length || !contracts.length}
			>
				<label className="block space-y-1" htmlFor={`${formId}-frame`}>
					<span>Kare ve kesin sürüm</span>
					<select
						className="w-full rounded border p-2"
						id={`${formId}-frame`}
						onChange={(event) => {
							setSelectedFrame(event.target.value);
							setSelectedSourcePivot("");
							setValues({});
						}}
						value={selectedFrame}
					>
						<option value="">Kare seçin</option>
						{frames.map((candidate) => (
							<option
								key={`${candidate.assetVersionId}:${candidate.frameKey}`}
								value={frameIdentity(candidate)}
							>
								{candidate.frameKey} — {candidate.assetVersionId}
							</option>
						))}
					</select>
				</label>
				<label className="block space-y-1" htmlFor={`${formId}-profile`}>
					<span>Etkin özel profil</span>
					<select
						className="w-full rounded border p-2"
						id={`${formId}-profile`}
						onChange={(event) => {
							setSelectedContractRevision(event.target.value);
							setSelectedSourcePivot("");
							setValues({});
						}}
						value={selectedContractRevision}
					>
						<option value="">Profil seçin</option>
						{contracts.map((definition) => (
							<option
								key={definition.contractRevisionId}
								value={definition.contractRevisionId}
							>
								{definition.name} {definition.version}
							</option>
						))}
					</select>
				</label>
				<label className="block space-y-1" htmlFor={`${formId}-context`}>
					<span>Kullanım bağlamı</span>
					<input
						className="w-full rounded border p-2"
						id={`${formId}-context`}
						maxLength={512}
						onChange={(event) => setUseContext(event.target.value)}
						required
						value={useContext}
					/>
				</label>
				{definitions.some((definition) => definition.id === "pivot") &&
					Boolean(frame?.sourcePivots.length) && (
						<label
							className="block space-y-1"
							htmlFor={`${formId}-source-pivot`}
						>
							<span>Dönüş noktası kaynağı</span>
							<select
								className="w-full rounded border p-2"
								id={`${formId}-source-pivot`}
								onChange={(event) => setSelectedSourcePivot(event.target.value)}
								value={selectedSourcePivot}
							>
								<option value="">Elle yaz</option>
								{frame?.sourcePivots.map((pivot) => (
									<option
										key={pivotIdentity(pivot)}
										value={pivotIdentity(pivot)}
									>
										Kesinleştirilmiş kaynak: {JSON.stringify(pivot.value)}
									</option>
								))}
							</select>
						</label>
					)}
				{definitions.map((definition) => (
					<div className="space-y-1" key={definition.id}>
						<label className="block" htmlFor={`${formId}-${definition.id}`}>
							{definition.label} (JSON)
						</label>
						<textarea
							aria-describedby={`${formId}-${definition.id}-help`}
							className="min-h-20 w-full rounded border p-2 font-mono text-sm"
							disabled={definition.id === "pivot" && selectedSourcePivot !== ""}
							id={`${formId}-${definition.id}`}
							maxLength={16_384}
							onChange={(event) =>
								setValues({ ...values, [definition.id]: event.target.value })
							}
							value={
								definition.id === "pivot" && selectedSourcePivot !== ""
									? JSON.stringify(sourcePivot?.value)
									: (values[definition.id] ?? "")
							}
						/>
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
			</fieldset>
			{Boolean(error) && <p role="alert">{error}</p>}
		</form>
	);
}
