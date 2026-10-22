import { ORPCError } from "@orpc/client";
import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { SourceMetadataMappingProposal } from "@sprite-anvil/api/source-metadata-mapping";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import {
	fieldLabel,
	formatFieldValue,
} from "../../lib/source-metadata-mapping-fields";
import { sourceMetadataMappingFinalizationFormSchema } from "../../schemas";

function decisionKey(conflict: { field: string; key: string }) {
	return `${conflict.field}\u0000${conflict.key}`;
}

export function ProposalFinalizationForm({
	proposal,
	projectId,
	records,
	recordsError,
	entryId,
}: {
	proposal: SourceMetadataMappingProposal;
	projectId: string;
	records: AssetFamilyCatalog["assetRecords"] | undefined;
	recordsError: boolean;
	entryId: string;
}) {
	const queryClient = useQueryClient();
	const finalizeMutation = useMutation({
		...orpc.imports.finalizeSourceMetadataMapping.mutationOptions(),
		...mutationMeta,
	});
	const isFinalizing = finalizeMutation.isPending;
	const [finalizeError, setFinalizeError] = useState<string | null>(null);
	const finalizationLocation = {
		entryId,
		projectId,
		proposalId: proposal.id,
	};
	const invalidateFinalization = () =>
		queryClient.invalidateQueries({
			queryKey: orpc.imports.getSourceMetadataMappingFinalization.queryKey({
				input: finalizationLocation,
			}),
		});
	const form = useForm({
		defaultValues: {
			assetRecordId: "",
			decisions: {} as Record<string, string>,
		},
		onSubmit: async ({ value }) => {
			if (isFinalizing) {
				return;
			}
			setFinalizeError(null);
			try {
				await finalizeMutation.mutateAsync({
					...finalizationLocation,
					input: {
						assetRecordId: value.assetRecordId,
						decisions: proposal.conflicts.map((conflict) => {
							const selected = conflict.candidates.find(
								(candidate) =>
									JSON.stringify([
										candidate.sourceEntryId,
										candidate.sourcePath,
									]) === value.decisions[decisionKey(conflict)]
							);
							return {
								field: conflict.field,
								key: conflict.key,
								sourceEntryId: selected?.sourceEntryId ?? null,
								sourcePath: selected?.sourcePath ?? null,
							};
						}),
					},
				});
				await invalidateFinalization();
			} catch (error) {
				if (error instanceof ORPCError) {
					if (error.status === 422 || error.status === 400) {
						setFinalizeError(
							"Zorunlu kare çakışmalarını çözün ve kaynak dosyayı kontrol edin."
						);
					} else if (error.status === 409) {
						setFinalizeError("Bu öneri başka bir kararla kesinleştirilmiş.");
					} else {
						setFinalizeError(
							"Eşleme kesinleştirilemedi. Kayıtlı sonucu kontrol edin."
						);
					}
					return;
				}
				setFinalizeError(
					"Kesinleştirme sonucu doğrulanamadı. Kayıtlı sonucu kontrol edin."
				);
				await invalidateFinalization();
			}
		},
		validators: { onSubmit: sourceMetadataMappingFinalizationFormSchema },
	});
	return (
		<section
			aria-label="Eşlemeyi kesinleştir"
			className="space-y-3 rounded-md border p-3"
		>
			<form.Field name="assetRecordId">
				{(field) => (
					<Label className="block text-sm leading-normal">
						Hedef Varlık Kaydı
						<NativeSelect
							className="mt-1 w-full"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						>
							<NativeSelectOption value="">Kayıt seçin</NativeSelectOption>
							{records?.map((record) => (
								<NativeSelectOption key={record.id} value={record.id}>
									{record.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			{records?.length === 0 ? (
				<p>
					Önce{" "}
					<Link params={{ projectId }} to="/projects/$projectId/asset-families">
						Varlık Aileleri
					</Link>{" "}
					ekranında hedef Varlık Kaydı oluşturun.
				</p>
			) : null}
			{recordsError ? (
				<p role="alert">Hedef Varlık Kayıtları okunamadı.</p>
			) : null}
			<form.Field name="decisions">
				{(field) =>
					proposal.conflicts.map((conflict) => {
						const key = decisionKey(conflict);
						return (
							<Label className="block text-sm leading-normal" key={key}>
								{fieldLabel(conflict.field)} · {conflict.key}{" "}
								{conflict.field === "frame" ? "(zorunlu)" : "(isteğe bağlı)"}
								<NativeSelect
									className="mt-1 w-full"
									onChange={(event) =>
										field.handleChange({
											...field.state.value,
											[key]: event.target.value,
										})
									}
									value={field.state.value[key] ?? ""}
								>
									<NativeSelectOption value="">
										{conflict.field === "frame" ? "Kaynak seçin" : "Bilinmiyor"}
									</NativeSelectOption>
									{conflict.candidates.map((candidate) => (
										<NativeSelectOption
											key={`${candidate.sourceEntryId}-${candidate.sourcePath}`}
											value={JSON.stringify([
												candidate.sourceEntryId,
												candidate.sourcePath,
											])}
										>
											{candidate.sourceFileName} ·{" "}
											{formatFieldValue(candidate.value)}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Label>
						);
					})
				}
			</form.Field>
			<form.Subscribe
				selector={(state) =>
					!state.values.assetRecordId ||
					proposal.conflicts.some(
						(conflict) =>
							conflict.field === "frame" &&
							!state.values.decisions[decisionKey(conflict)]
					)
				}
			>
				{(incomplete) => (
					<Button
						disabled={incomplete || isFinalizing}
						onClick={() => void form.handleSubmit()}
						type="button"
					>
						{isFinalizing
							? "Kesinleştiriliyor…"
							: "Eşlemeyi kesinleştir ve Aday Sürüm oluştur"}
					</Button>
				)}
			</form.Subscribe>
			{finalizeError ? <p role="alert">{finalizeError}</p> : null}
		</section>
	);
}
