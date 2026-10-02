import type {
	GameplayMetadataFrame,
	GameplayMetadataRecord,
} from "@sprite-anvil/api/gameplay-metadata";
import {
	getGameplayMetadataIntegrityErrors,
	getGameplayMetadataReviewSourceErrors,
} from "@sprite-anvil/api/gameplay-metadata-integrity";
import { gameplayMetadataPackageReadInputSchema } from "@sprite-anvil/api/gameplay-metadata-package";
import type { SpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useId, useState } from "react";
import { getErrorMessage } from "@/utils/get-error-message";
import { client } from "@/utils/orpc";
import { GameplayMetadataOverlay } from "../components/gameplay-metadata-overlay";

export function GameplayMetadataReview({
	record,
	records,
	frames,
	previewUrl,
	onReviewed,
	contract = record.contractSnapshot,
}: {
	record: GameplayMetadataRecord;
	records: GameplayMetadataRecord[];
	frames: GameplayMetadataFrame[];
	previewUrl: string | undefined;
	onReviewed: (record: GameplayMetadataRecord) => Promise<void>;
	contract?: SpecializedProfileContract;
}) {
	const fileInputId = useId();
	const [ready, setReady] = useState(false);
	const [pending, setPending] = useState(false);
	const [decisionId] = useState(() => crypto.randomUUID());
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const errors = [
		...getGameplayMetadataIntegrityErrors(record, frames, contract),
		...getGameplayMetadataReviewSourceErrors(record, records),
	];
	const target = {
		projectId: record.projectId,
		assetRecordId: record.assetRecordId,
		recordId: record.id,
	};

	async function act(action: () => Promise<void>) {
		setPending(true);
		setError(null);
		setMessage(null);
		try {
			await action();
		} catch (failure) {
			setError(getErrorMessage(failure, "Oyun içi bilgiler doğrulanamadı."));
		} finally {
			setPending(false);
		}
	}

	async function review() {
		await act(async () => {
			const reviewed = await client.gameplayMetadata.review({
				...target,
				id: decisionId,
			});
			await onReviewed(reviewed);
		});
	}

	async function download() {
		await act(async () => {
			const result = await client.gameplayMetadata.createPackage(target);
			const blob = new Blob([JSON.stringify(result)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `gameplay-metadata-${record.id}.json`;
			anchor.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			setMessage("İncelenmiş oyun içi bilgiler paketi indirildi.");
		});
	}

	async function reread(file: File) {
		await act(async () => {
			if (file.size > 524_288) {
				throw new Error("Paket 512 KiB sınırını aşıyor.");
			}
			const input = gameplayMetadataPackageReadInputSchema.parse({
				...target,
				package: JSON.parse(await file.text()),
			});
			await client.gameplayMetadata.readPackage(input);
			setMessage(
				"Paket yeniden okundu; incelenmiş alanlar, kare ve kesin sürüm korunuyor."
			);
		});
	}

	return (
		<section
			aria-label="Bilgileri İnceleme ve Koruma"
			className="space-y-3 rounded border p-4"
		>
			<h3 className="font-medium text-lg">Bilgileri İnceleme ve Koruma</h3>
			<p>
				{record.frameKey} · {record.assetVersionId} · {record.useContext}
			</p>
			<p>{record.review ? "İncelendi" : "Henüz incelenmedi"}</p>
			{errors.map((failure) => (
				<p key={failure} role="alert">
					Bütünlük hatası: {failure}
				</p>
			))}
			{!previewUrl && (
				<p role="alert">Kesin sürümün doğrulanmış görseli bulunamadı.</p>
			)}
			{previewUrl && !errors.length && (
				<GameplayMetadataOverlay
					onReady={setReady}
					previewUrl={previewUrl}
					record={record}
				/>
			)}
			<dl>
				{record.fields.map((field) => (
					<div key={field.fieldId}>
						<dt>
							{contract?.metadataFields.find(
								(definition) => definition.id === field.fieldId
							)?.label ?? field.fieldId}
						</dt>
						<dd className="break-all font-mono text-sm">
							{field.value === null
								? "Bilinmiyor"
								: JSON.stringify(field.value)}
						</dd>
					</div>
				))}
			</dl>
			{!record.review && (
				<Button
					disabled={pending || !ready || !previewUrl || Boolean(errors.length)}
					onClick={review}
					type="button"
				>
					İncelemeyi kaydet
				</Button>
			)}
			{Boolean(record.review) && (
				<div className="space-y-2">
					<Button
						disabled={pending || Boolean(errors.length)}
						onClick={download}
						type="button"
					>
						Oyun içi bilgiler paketini indir
					</Button>
					<label className="block" htmlFor={fileInputId}>
						Paketi yeniden oku
					</label>
					<input
						accept=".json,application/json"
						disabled={pending || Boolean(errors.length)}
						id={fileInputId}
						onChange={(event) => {
							const file = event.target.files?.[0];
							event.target.value = "";
							if (file) {
								reread(file);
							}
						}}
						type="file"
					/>
					<p className="text-muted-foreground text-sm">
						Bu paket yalnız oyun içi bilgileri taşır; görsel dosyaları ve tam
						Dışa Aktarım Paketi değildir. Yeniden okuma kalıcı inceleme kaydıyla
						karşılaştırır ve veriyi değiştirmez.
					</p>
				</div>
			)}
			{error ? <p role="alert">{error}</p> : null}
			{message ? <p role="status">{message}</p> : null}
		</section>
	);
}
