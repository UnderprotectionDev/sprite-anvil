import type {
	AssetVersion,
	UnitVersion,
	UnitVersionType,
} from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { type SyntheticEvent, useState } from "react";
import type { useAssetVersionWrites } from "../hooks/use-asset-version-writes";
import { reviewDispositionLabels } from "./review-disposition-labels";

export const unitTypeLabels: Record<UnitVersionType, string> = {
	frame: "Kare",
	direction: "Yön",
	tile: "Karo",
	state: "Durum",
};

const unitTypes = Object.keys(unitTypeLabels) as UnitVersionType[];

export function UnitVersionCorrectionForm({
	assetRecordId,
	assetVersions,
	unitVersions,
	writes,
}: {
	assetRecordId: string;
	assetVersions: AssetVersion[];
	unitVersions: UnitVersion[];
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	const [unitType, setUnitType] = useState<UnitVersionType>("frame");
	const [unitKey, setUnitKey] = useState("");
	const [sourceAssetVersionId, setSourceAssetVersionId] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const normalizedUnitKey = unitKey.trim();
	const sourceVersions = assetVersions.filter((version) => {
		const unitVersion = unitVersions.find(
			(candidate) => candidate.assetVersionId === version.id
		);
		return (
			!unitVersion ||
			(unitVersion.unitType === unitType &&
				unitVersion.unitKey === normalizedUnitKey)
		);
	});
	const selectedSource = sourceVersions.find(
		(version) => version.id === sourceAssetVersionId
	);
	const formId = `unit-version-correction-${assetRecordId}`;

	async function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!(selectedSource && file && normalizedUnitKey)) {
			return;
		}
		const created = await writes.upload(assetRecordId, file, {
			unitCorrection: {
				sourceAssetVersionId: selectedSource.id,
				unitType,
				unitKey: normalizedUnitKey,
			},
		});
		if (created) {
			setFile(null);
		}
	}

	return (
		<div className="space-y-3 rounded-md border p-3">
			<h5 className="font-medium">Birim Sürümünü seçici düzelt</h5>
			<p className="text-muted-foreground text-sm">
				Düzeltilmiş tek birim dosyasını yükleyin. Aynı birimde sonraki
				düzeltmeleri sürdürmek için aynı birim adını kullanın; kaynak ve diğer
				birimler korunur.
			</p>
			{assetVersions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Önce kaynak olarak kullanılacak bir Varlık Sürümü yükleyin.
				</p>
			) : null}
			<form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
				<label className="space-y-1 text-sm" htmlFor={`${formId}-type`}>
					<span className="block">Birim türü</span>
					<select
						className="min-h-11 w-full rounded-md border bg-background px-3"
						disabled={writes.writesDisabled}
						id={`${formId}-type`}
						onChange={(event) =>
							setUnitType(event.currentTarget.value as UnitVersionType)
						}
						value={unitType}
					>
						{unitTypes.map((type) => (
							<option key={type} value={type}>
								{unitTypeLabels[type]}
							</option>
						))}
					</select>
				</label>
				<label className="space-y-1 text-sm" htmlFor={`${formId}-key`}>
					<span className="block">Birim adı</span>
					<input
						className="min-h-11 w-full rounded-md border bg-background px-3"
						disabled={writes.writesDisabled}
						id={`${formId}-key`}
						maxLength={120}
						onChange={(event) => setUnitKey(event.currentTarget.value)}
						placeholder="Örn. saldırı/kare-3"
						required
						value={unitKey}
					/>
				</label>
				<label className="space-y-1 text-sm" htmlFor={`${formId}-source`}>
					<span className="block">Kaynak Varlık Sürümü</span>
					<select
						className="min-h-11 w-full rounded-md border bg-background px-3"
						disabled={writes.writesDisabled || sourceVersions.length === 0}
						id={`${formId}-source`}
						onChange={(event) =>
							setSourceAssetVersionId(event.currentTarget.value)
						}
						required
						value={selectedSource?.id ?? ""}
					>
						<option value="">Kaynak sürümü seçin</option>
						{sourceVersions.map((version) => (
							<option key={version.id} value={version.id}>
								Sürüm {version.versionNumber} ·{" "}
								{reviewDispositionLabels[version.reviewDisposition]}
							</option>
						))}
					</select>
				</label>
				<label className="space-y-1 text-sm" htmlFor={`${formId}-file`}>
					<span className="block">Düzeltilmiş PNG veya WebP</span>
					<input
						accept="image/png,image/webp"
						className="block min-h-11 w-full rounded-md border px-3 py-2 file:mr-3"
						disabled={writes.writesDisabled}
						id={`${formId}-file`}
						onChange={(event) =>
							setFile(event.currentTarget.files?.[0] ?? null)
						}
						type="file"
					/>
				</label>
				<div className="sm:col-span-2">
					<Button
						disabled={
							writes.writesDisabled ||
							!selectedSource ||
							!normalizedUnitKey ||
							!file
						}
						type="submit"
					>
						Birim düzeltmesini kaydet
					</Button>
				</div>
			</form>
		</div>
	);
}

export function UnitVersionHistory({
	assetVersions,
	unitVersions,
}: {
	assetVersions: AssetVersion[];
	unitVersions: UnitVersion[];
}) {
	const versionsById = new Map(
		assetVersions.map((version) => [version.id, version])
	);

	return (
		<div className="space-y-2">
			<h5 className="font-medium">Birim Sürümleri</h5>
			{unitVersions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Henüz Birim Sürümü kaydedilmedi.
				</p>
			) : (
				<ol className="list-inside list-disc space-y-1 text-sm">
					{unitVersions.map((unitVersion) => {
						const version = versionsById.get(unitVersion.assetVersionId);
						const source = versionsById.get(unitVersion.sourceAssetVersionId);
						return (
							<li key={unitVersion.id}>
								<span>
									{unitTypeLabels[unitVersion.unitType]} · {unitVersion.unitKey}{" "}
									· Birim Sürümü {unitVersion.versionNumber}
								</span>
								{version && source ? (
									<span className="text-muted-foreground">
										{" "}
										— Aday Sürüm {version.versionNumber}; kaynak Varlık Sürümü{" "}
										{source.versionNumber}
									</span>
								) : null}
							</li>
						);
					})}
				</ol>
			)}
		</div>
	);
}
