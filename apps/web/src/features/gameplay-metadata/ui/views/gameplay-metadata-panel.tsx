import {
	type GameplayMetadataRecord,
	type GameplayMetadataWriteInput,
	getGameplayMetadataFields,
} from "@sprite-anvil/api/gameplay-metadata";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import { GameplayMetadataForm } from "../forms/gameplay-metadata-form";
import { GameplayMetadataReview } from "./gameplay-metadata-review";

const sourceLabels = {
	finalized_source: "Kesinleştirilmiş kaynak",
	authored: "Kullanıcı girdisi",
	unknown: "Bilinmiyor",
};

export function GameplayMetadataPanel({
	projectId,
	assetRecordId,
}: {
	projectId: string;
	assetRecordId: string;
}) {
	const catalogQuery = useQuery(
		orpc.gameplayMetadata.list.queryOptions({
			input: { projectId, assetRecordId },
		})
	);
	const contractsQuery = useQuery(
		orpc.specializedProfileContracts.list.queryOptions({ input: { projectId } })
	);
	const versionsQuery = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	const [editing, setEditing] = useState<GameplayMetadataRecord | undefined>();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const selected = catalogQuery.data?.records.find(
		(record) => record.id === selectedId
	);
	const selectedVersion = versionsQuery.data?.assetVersions.find(
		(version) =>
			version.id === selected?.assetVersionId &&
			version.assetRecordId === assetRecordId &&
			version.integrityVerified
	);
	const [pending, setPending] = useState(false);
	const [uncertain, setUncertain] = useState<GameplayMetadataWriteInput | null>(
		null
	);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const contracts =
		contractsQuery.data?.profiles.flatMap((profile) =>
			profile.activeContract &&
			getGameplayMetadataFields(profile.activeContract.contract).length
				? [
						{
							...profile.activeContract.contract,
							contractRevisionId: profile.activeContract.contractRevisionId,
						},
					]
				: []
		) ?? [];

	async function save(input: GameplayMetadataWriteInput) {
		setPending(true);
		setMessage(null);
		setError(null);
		try {
			await client.gameplayMetadata.write(input);
			setUncertain(null);
			const result = await catalogQuery.refetch();
			setMessage(
				result.isError
					? "Kayıt kaydedildi; liste yeniden okunamadı. Kayıtları yeniden yükleyin."
					: "Oyun içi bilgiler kaydedildi ve yeniden okundu."
			);
			return true;
		} catch (failure) {
			setError(getErrorMessage(failure, "Oyun içi bilgiler kaydedilemedi."));
			if (isWriteOutcomeUncertain(failure)) {
				setUncertain(input);
			} else {
				// A definitive failure can never commit; release the lock so the
				// user can correct the draft instead of staying stuck behind retry.
				setUncertain(null);
			}
			return false;
		} finally {
			setPending(false);
		}
	}

	async function checkOutcome() {
		const result = await catalogQuery.refetch();
		if (result.isError) {
			return;
		}
		if (result.data?.records.some((record) => record.id === uncertain?.id)) {
			setUncertain(null);
			setError(null);
			setMessage("Oyun içi bilgiler kalıcı kayıttan yeniden okundu.");
		} else {
			setError(
				"Kayıt henüz görünmüyor. Aynı işlemi yeniden deneyin; yeni kayıt oluşturulmaz."
			);
		}
	}

	return (
		<section aria-label="Oyun İçi Bilgileri" className="space-y-4">
			<h2 className="font-medium text-xl">
				Oyun İçi Bilgileri Yazma ve Eşleme
			</h2>
			{catalogQuery.isPending || contractsQuery.isPending ? (
				<p>Oyun içi bilgiler yükleniyor…</p>
			) : null}
			{catalogQuery.isError || contractsQuery.isError ? (
				<p role="alert">
					Oyun içi bilgiler açılamadı.{" "}
					<Button
						onClick={() => {
							catalogQuery.refetch();
							contractsQuery.refetch();
						}}
						type="button"
					>
						Yeniden yükle
					</Button>
				</p>
			) : null}
			{Boolean(catalogQuery.data && contractsQuery.data) &&
				catalogQuery.data && (
					<>
						{!catalogQuery.data.frames.length && (
							<p>
								Önce içe aktarma eşlemesini kesinleştirin veya bir Kare birim
								sürümü oluşturun.
							</p>
						)}
						{!contracts.length && (
							<p>
								Önce projenin Özel Profil Sözleşmeleri sayfasında oyun içi bilgi
								alanları olan bir profil etkinleştirin.
							</p>
						)}
						<GameplayMetadataForm
							contracts={
								editing?.contractSnapshot
									? [
											{
												...editing.contractSnapshot,
												contractRevisionId: editing.contractRevisionId,
											},
										]
									: contracts
							}
							disabled={pending || Boolean(uncertain)}
							frames={catalogQuery.data.frames}
							initialRecord={editing}
							key={`form-${editing?.id ?? "new"}`}
							onSave={async (draft) => {
								const saved = await save({
									...draft,
									projectId,
									assetRecordId,
									id: crypto.randomUUID(),
								});
								if (saved) {
									setEditing(undefined);
								}
								return saved;
							}}
						/>
						{Boolean(editing) && (
							<p className="space-x-2">
								<span>
									Düzenleme yeni, incelenmemiş kayıt oluşturur; eski inceleme
									değişmez.
								</span>
								<Button
									disabled={pending || Boolean(uncertain)}
									onClick={() => setEditing(undefined)}
									type="button"
								>
									Düzenlemeyi iptal et
								</Button>
							</p>
						)}
						{selected && (
							<GameplayMetadataReview
								contract={
									selected.contractSnapshot ??
									contracts.find(
										(contract) =>
											contract.contractRevisionId ===
											selected.contractRevisionId
									)
								}
								frames={catalogQuery.data.frames}
								key={`review-${selected.id}`}
								onReviewed={async (reviewed) => {
									const result = await catalogQuery.refetch();
									if (result.isError) {
										throw new Error(
											"İnceleme kaydedildi; liste yeniden okunamadı. Aynı incelemeyi yeniden deneyin."
										);
									}
									setSelectedId(reviewed.id);
								}}
								previewUrl={selectedVersion?.previewUrl}
								record={selected}
								records={catalogQuery.data.records}
							/>
						)}
						<h3 className="font-medium">Kaydedilen oyun içi bilgiler</h3>
						{!catalogQuery.data.records.length && (
							<p>Henüz oyun içi bilgi kaydı yok.</p>
						)}
						{catalogQuery.data.records.map((record) => (
							<article className="space-y-2 rounded border p-3" key={record.id}>
								<p>{record.review ? "İncelendi" : "Henüz incelenmedi"}</p>
								<p>
									{record.frameKey} — {record.useContext}
								</p>
								<p className="break-all text-muted-foreground text-sm">
									Kesin sürüm: {record.assetVersionId} · Sözleşme:{" "}
									{record.contractRevisionId}
								</p>
								<dl>
									{record.fields.map((field) => (
										<div className="space-y-1" key={field.fieldId}>
											<dt>{field.fieldId}</dt>
											<dd className="break-all font-mono text-sm">
												{field.value === null
													? "Bilinmiyor"
													: JSON.stringify(field.value)}{" "}
												· {sourceLabels[field.source.kind]}
											</dd>
										</div>
									))}
								</dl>
								<div className="flex gap-2">
									<Button
										disabled={pending || Boolean(uncertain)}
										onClick={() => setSelectedId(record.id)}
										type="button"
									>
										Bilgileri incele
									</Button>
									<Button
										disabled={pending || Boolean(uncertain)}
										onClick={() => setEditing(record)}
										type="button"
									>
										Bilgileri düzenle
									</Button>
								</div>
							</article>
						))}
					</>
				)}
			{Boolean(message) && <p role="status">{message}</p>}
			{Boolean(error) && <p role="alert">{error}</p>}
			{uncertain !== null && (
				<div className="flex gap-2">
					<Button disabled={pending} onClick={checkOutcome} type="button">
						Kaydı kontrol et
					</Button>
					<Button
						disabled={pending}
						onClick={() => save(uncertain)}
						type="button"
					>
						Aynı işlemi yeniden dene
					</Button>
				</div>
			)}
		</section>
	);
}
