import {
	animationMetadataPackageReadInputSchema,
	animationMetadataPackageSizeLimit,
} from "@sprite-anvil/api/animation-metadata-package";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { CompositeVersion } from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

function getCompositeVersionLabel(compositeVersion: CompositeVersion) {
	return `Birleşik Sürüm ${compositeVersion.versionNumber} · ${new Intl.DateTimeFormat(
		"tr-TR",
		{ dateStyle: "medium", timeStyle: "short" }
	).format(new Date(compositeVersion.createdAt))}`;
}

export function AnimationMetadataPackagePanel({
	projectId,
	record,
}: {
	projectId: string;
	record: AssetRecord;
}) {
	if (
		record.availability === "erased" ||
		record.assetCategory !== "character_creature_animation"
	) {
		return null;
	}
	return (
		<AnimationMetadataPackagePanelContent
			projectId={projectId}
			record={record}
		/>
	);
}

function AnimationMetadataPackagePanelContent({
	projectId,
	record,
}: {
	projectId: string;
	record: AssetRecord;
}) {
	const compositeVersionSelectId = useId();
	const packageFileInputId = useId();
	const [selectedCompositeVersionId, setSelectedCompositeVersionId] =
		useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const versionsQuery = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	const compositeVersions = (versionsQuery.data?.compositeVersions ?? [])
		.filter(
			(compositeVersion) =>
				compositeVersion.projectId === projectId &&
				compositeVersion.assetRecordId === record.id
		)
		.toSorted(
			(left, right) =>
				right.versionNumber - left.versionNumber ||
				right.createdAt.localeCompare(left.createdAt)
		);
	const selectedCompositeVersion = compositeVersions.find(
		(compositeVersion) => compositeVersion.id === selectedCompositeVersionId
	);

	async function downloadPackage() {
		if (!selectedCompositeVersion) {
			return;
		}
		setPending(true);
		setError(null);
		setMessage(null);
		try {
			const animationMetadataPackage =
				await client.animationMetadataPackage.createPackage({
					projectId,
					assetRecordId: record.id,
					compositeVersionId: selectedCompositeVersion.id,
				});
			const blob = new Blob([JSON.stringify(animationMetadataPackage)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `animation-metadata-${record.id}-composite-${selectedCompositeVersion.versionNumber}.json`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 1000);
			setMessage("Animasyon metadata paketi indirildi.");
		} catch (failure) {
			setError(
				getErrorMessage(failure, "Animasyon metadata paketi indirilemedi.")
			);
		} finally {
			setPending(false);
		}
	}

	async function rereadPackage(file: File) {
		setPending(true);
		setError(null);
		setMessage(null);
		try {
			if (file.size > animationMetadataPackageSizeLimit) {
				throw new Error("Animasyon metadata paketi 512 KiB sınırını aşıyor.");
			}
			if (!selectedCompositeVersion) {
				throw new Error("Önce Birleşik Sürüm seçin.");
			}
			let packageContents: unknown;
			try {
				packageContents = JSON.parse(await file.text());
			} catch (cause) {
				throw new Error("Animasyon metadata paketi geçerli JSON değil.", {
					cause,
				});
			}
			const input = animationMetadataPackageReadInputSchema.parse({
				projectId,
				assetRecordId: record.id,
				compositeVersionId: selectedCompositeVersion.id,
				package: packageContents,
			});
			await client.animationMetadataPackage.readPackage(input);
			setMessage(
				"Paket yeniden okundu; metadata ve kesin sürümler seçili Birleşik Sürümle eşleşiyor."
			);
		} catch (failure) {
			setError(
				getErrorMessage(failure, "Animasyon metadata paketi yeniden okunamadı.")
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<section
			aria-label="Animasyon Metadata Paketi"
			className="space-y-4 rounded-lg border p-5"
		>
			<div className="space-y-2">
				<h2 className="font-medium text-xl">Animasyon Metadata Paketi</h2>
				<p className="text-muted-foreground text-sm">
					Seçili Birleşik Sürümün bileşim metadata'sını, kareye bağlı Oyun İçi
					Bilgilerini ve kesin sürüm kimliklerini JSON olarak indirin veya
					yeniden okuyarak doğrulayın.
				</p>
			</div>
			{versionsQuery.isPending ? (
				<p aria-live="polite">Birleşik Sürümler yükleniyor…</p>
			) : null}
			{versionsQuery.isError ? (
				<div className="space-y-2">
					<p role="alert">Birleşik Sürümler yüklenemedi.</p>
					<Button
						onClick={() => void versionsQuery.refetch()}
						type="button"
						variant="outline"
					>
						Yeniden yükle
					</Button>
				</div>
			) : null}
			{versionsQuery.isSuccess && compositeVersions.length === 0 ? (
				<p>Bu Varlık Kaydında paketlenebilecek Birleşik Sürüm yok.</p>
			) : null}
			{versionsQuery.isSuccess && compositeVersions.length > 0 ? (
				<div className="space-y-3">
					<div className="space-y-2">
						<label
							className="font-medium text-sm"
							htmlFor={compositeVersionSelectId}
						>
							Birleşik Sürüm
						</label>
						<select
							className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
							disabled={pending}
							id={compositeVersionSelectId}
							onChange={(event) => {
								setSelectedCompositeVersionId(event.target.value);
								setMessage(null);
								setError(null);
							}}
							value={selectedCompositeVersionId}
						>
							<option value="">Birleşik Sürüm seçin</option>
							{compositeVersions.map((compositeVersion) => (
								<option key={compositeVersion.id} value={compositeVersion.id}>
									{getCompositeVersionLabel(compositeVersion)}
								</option>
							))}
						</select>
					</div>
					<Button
						disabled={pending || !selectedCompositeVersion}
						onClick={() => void downloadPackage()}
						type="button"
					>
						Animasyon metadata paketini indir
					</Button>
					<div className="space-y-2">
						<label
							className="block font-medium text-sm"
							htmlFor={packageFileInputId}
						>
							Animasyon metadata paketini yeniden oku
						</label>
						<input
							accept=".json,application/json"
							className="block min-h-11 w-full text-sm"
							disabled={pending || !selectedCompositeVersion}
							id={packageFileInputId}
							onChange={(event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (file) {
									void rereadPackage(file);
								}
							}}
							type="file"
						/>
					</div>
				</div>
			) : null}
			<p className="text-muted-foreground text-sm">
				Paket seçili bileşimin metadata'sını, kareye bağlı Oyun İçi Bilgilerini
				ve kesin sürüm kimliklerini taşır. Kare süreleri ve atlas bölgeleri ayrı
				Kimlik ve Yön Tutarlılığı İncelemesi kaydında kalır; görsel dosyalar ve
				tam Dışa Aktarım Paketi kapsam dışıdır.
			</p>
			{error ? <p role="alert">{error}</p> : null}
			{message ? <p role="status">{message}</p> : null}
		</section>
	);
}
