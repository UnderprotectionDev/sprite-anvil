import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { SourceMetadataMappingProposal } from "@sprite-anvil/api/source-metadata-mapping";
import { sourceMetadataMappingFinalizationSchema } from "@sprite-anvil/api/source-metadata-mapping";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { fieldLabel, formatFieldValue } from "./source-metadata-mapping-fields";

export function ProposalFinalizationForm({
	proposal,
	projectId,
	records,
	recordsError,
	finalizationUrl,
}: {
	proposal: SourceMetadataMappingProposal;
	projectId: string;
	records: AssetFamilyCatalog["assetRecords"] | undefined;
	recordsError: boolean;
	finalizationUrl: string;
}) {
	const queryClient = useQueryClient();
	const [assetRecordId, setAssetRecordId] = useState("");
	const [decisions, setDecisions] = useState<Record<string, string>>({});
	const [isFinalizing, setIsFinalizing] = useState(false);
	const [finalizeError, setFinalizeError] = useState<string | null>(null);
	async function finalize() {
		if (!assetRecordId || isFinalizing) {
			return;
		}
		setIsFinalizing(true);
		setFinalizeError(null);
		try {
			const response = await fetch(finalizationUrl, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					assetRecordId,
					decisions: proposal.conflicts.map((conflict) => {
						const selected = conflict.candidates.find(
							(candidate) =>
								JSON.stringify([
									candidate.sourceEntryId,
									candidate.sourcePath,
								]) === decisions[`${conflict.field}\u0000${conflict.key}`]
						);
						return {
							field: conflict.field,
							key: conflict.key,
							sourceEntryId: selected?.sourceEntryId ?? null,
							sourcePath: selected?.sourcePath ?? null,
						};
					}),
				}),
			});
			if (!response.ok) {
				if (response.status === 422) {
					setFinalizeError(
						"Zorunlu kare çakışmalarını çözün ve kaynak dosyayı kontrol edin."
					);
				} else if (response.status === 409) {
					setFinalizeError("Bu öneri başka bir kararla kesinleştirilmiş.");
				} else {
					setFinalizeError(
						"Eşleme kesinleştirilemedi. Kayıtlı sonucu kontrol edin."
					);
				}
				return;
			}
			sourceMetadataMappingFinalizationSchema.parse(await response.json());
			await queryClient.invalidateQueries({
				queryKey: ["source-metadata-mapping-finalization", proposal.id],
			});
		} catch {
			setFinalizeError(
				"Kesinleştirme sonucu doğrulanamadı. Kayıtlı sonucu kontrol edin."
			);
			await queryClient.invalidateQueries({
				queryKey: ["source-metadata-mapping-finalization", proposal.id],
			});
		} finally {
			setIsFinalizing(false);
		}
	}
	return (
		<section
			aria-label="Eşlemeyi kesinleştir"
			className="space-y-3 rounded-md border p-3"
		>
			<label className="block">
				Hedef Varlık Kaydı
				<select
					className="mt-1 w-full rounded-md border bg-background p-2"
					onChange={(event) => setAssetRecordId(event.target.value)}
					value={assetRecordId}
				>
					<option value="">Kayıt seçin</option>
					{records?.map((record) => (
						<option key={record.id} value={record.id}>
							{record.name}
						</option>
					))}
				</select>
			</label>
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
			{proposal.conflicts.map((conflict) => {
				const key = `${conflict.field}\u0000${conflict.key}`;
				return (
					<label className="block" key={key}>
						{fieldLabel(conflict.field)} · {conflict.key}{" "}
						{conflict.field === "frame" ? "(zorunlu)" : "(isteğe bağlı)"}
						<select
							className="mt-1 w-full rounded-md border bg-background p-2"
							onChange={(event) =>
								setDecisions((current) => ({
									...current,
									[key]: event.target.value,
								}))
							}
							value={decisions[key] ?? ""}
						>
							<option value="">
								{conflict.field === "frame" ? "Kaynak seçin" : "Bilinmiyor"}
							</option>
							{conflict.candidates.map((candidate) => (
								<option
									key={`${candidate.sourceEntryId}-${candidate.sourcePath}`}
									value={JSON.stringify([
										candidate.sourceEntryId,
										candidate.sourcePath,
									])}
								>
									{candidate.sourceFileName} ·{" "}
									{formatFieldValue(candidate.value)}
								</option>
							))}
						</select>
					</label>
				);
			})}
			<Button
				disabled={
					!assetRecordId ||
					isFinalizing ||
					proposal.conflicts.some(
						(conflict) =>
							conflict.field === "frame" &&
							!decisions[`${conflict.field}\u0000${conflict.key}`]
					)
				}
				onClick={() => void finalize()}
				type="button"
			>
				{isFinalizing
					? "Kesinleştiriliyor…"
					: "Eşlemeyi kesinleştir ve Aday Sürüm oluştur"}
			</Button>
			{finalizeError ? <p role="alert">{finalizeError}</p> : null}
		</section>
	);
}
