import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type {
	AssetFamilyComparisonInput,
	AssetFamilyComparisonRecord,
} from "@sprite-anvil/api/asset-family-comparisons";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ENV } from "@/env";
import { AssetVersionPreview } from "@/features/asset-versions/ui/components/asset-version-preview";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

const profileId = "object_weapon_equipment_states";
const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

const emptyObservations = {
	scale: "",
	perspective: "",
	materialLanguage: "",
	stateDirectionDistinction: "",
};

const observationLabels = {
	scale: "Ölçek gözlemi",
	perspective: "Perspektif gözlemi",
	materialLanguage: "Malzeme dili gözlemi",
	stateDirectionDistinction: "Durum ve yön ayrışması gözlemi",
} as const;

type FamilyRecord = AssetFamilyCatalog["assetRecords"][number] &
	Pick<AssetRecord, "assetCategory" | "availability">;

export function AssetFamilyComparisonManager({
	activation,
	assetFamilyId,
	assetRecords,
	catalog,
	familyName,
	projectId,
}: {
	activation: ProjectProfileContractActivation;
	assetFamilyId: string;
	assetRecords: FamilyRecord[];
	catalog: AssetVersionCatalog;
	familyName: string;
	projectId: string;
}) {
	const query = useQuery(
		orpc.assetFamilyComparisons.list.queryOptions({
			input: { projectId, assetFamilyId },
		})
	);
	const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
	const [observations, setObservations] = useState(emptyObservations);
	const [selected, setSelected] = useState<AssetFamilyComparisonRecord | null>(
		null
	);
	const [saving, setSaving] = useState(false);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [uncertain, setUncertain] = useState(false);
	const [message, setMessage] = useState("");

	const currentVersionByRecord = new Map<
		string,
		AssetVersionCatalog["assetVersions"][number]
	>();
	for (const version of catalog.assetVersions) {
		if (version.assetFamilyId !== assetFamilyId) {
			continue;
		}
		const current = currentVersionByRecord.get(version.assetRecordId);
		if (!current || version.versionNumber > current.versionNumber) {
			currentVersionByRecord.set(version.assetRecordId, version);
		}
	}
	const eligibleRecords = assetRecords.filter(
		(record) =>
			record.assetCategory === profileId && record.availability !== "erased"
	);
	const selectedVersions = selectedRecordIds.flatMap((assetRecordId) => {
		const record = eligibleRecords.find(
			(candidate) => candidate.id === assetRecordId
		);
		const version = currentVersionByRecord.get(assetRecordId);
		return record && version ? [{ record, version }] : [];
	});
	const unitVersionsByAssetVersion = new Map<
		string,
		AssetVersionCatalog["unitVersions"]
	>();
	for (const unitVersion of catalog.unitVersions) {
		const versions =
			unitVersionsByAssetVersion.get(unitVersion.assetVersionId) ?? [];
		versions.push(unitVersion);
		unitVersionsByAssetVersion.set(unitVersion.assetVersionId, versions);
	}
	const canSave =
		selectedVersions.length >= 2 &&
		Object.values(observations).every((value) => value.trim().length > 0) &&
		!saving &&
		!uncertain &&
		!query.isPending &&
		!query.isError;

	async function save() {
		const input: AssetFamilyComparisonInput = {
			id: crypto.randomUUID(),
			projectId,
			assetFamilyId,
			contractRevisionId: activation.contractRevisionId,
			assetVersions: selectedVersions.map(({ record, version }) => ({
				assetRecordId: record.id,
				assetVersionId: version.id,
				unitVersionIds: (unitVersionsByAssetVersion.get(version.id) ?? []).map(
					(unitVersion) => unitVersion.id
				),
			})),
			observations,
		};
		setSaving(true);
		setMessage("");
		setPendingId(input.id);
		try {
			const record = await client.assetFamilyComparisons.save(input);
			setSelected(record);
			setPendingId(null);
			setMessage("Karşılaştırma kalıcı kayıttan doğrulandı.");
			await query.refetch();
		} catch (error) {
			if (!isWriteOutcomeUncertain(error)) {
				setPendingId(null);
				setMessage(getErrorMessage(error, "Karşılaştırma kaydedilemedi."));
				return;
			}
			setUncertain(true);
			setMessage(
				"Kaydetme sonucu doğrulanamadı. Güncel kayıtları kontrol edin; aynı karşılaştırmayı yeniden göndermeyin."
			);
		} finally {
			setSaving(false);
		}
	}

	async function checkCurrentRecords() {
		const result = await query.refetch();
		if (result.isError) {
			return;
		}
		const saved = result.data?.find((record) => record.id === pendingId);
		if (saved) {
			setSelected(saved);
			setPendingId(null);
			setUncertain(false);
			setMessage("Karşılaştırma kalıcı kayıttan doğrulandı.");
			return;
		}
		setPendingId(null);
		setUncertain(false);
		setMessage(
			"Karşılaştırma kayıtlar arasında bulunamadı. Bilgileri yeniden seçip kaydedin."
		);
	}

	return (
		<section
			aria-label={`${familyName} durum ve yön ailesi karşılaştırması`}
			className="space-y-4 rounded border p-4"
		>
			<header className="space-y-1">
				<h3 className="font-semibold text-xl">
					{familyName} · Durum ve Yön Ailesini Karşılaştırma
				</h3>
				<p className="text-muted-foreground text-sm">
					En az iki ayrı Varlık Kaydının güncel Varlık Sürümlerini yan yana
					inceleyin. Bu kayıt yalnız kullanıcı gözlemlerini saklar; otomatik
					uyumluluk kararı üretmez.
				</p>
			</header>
			{query.isError ? (
				<div role="alert">
					Karşılaştırmalar okunamadı.{" "}
					<Button onClick={() => void query.refetch()} type="button">
						Kayıtları yeniden oku
					</Button>
				</div>
			) : null}
			{message ? <p role="status">{message}</p> : null}
			{uncertain ? (
				<Button
					disabled={query.isFetching}
					onClick={() => void checkCurrentRecords()}
					type="button"
				>
					Güncel karşılaştırmaları kontrol et
				</Button>
			) : null}
			<ul className="space-y-1">
				{query.data?.map((record) => (
					<li key={record.id}>
						<Button
							onClick={() => {
								setSelected(record);
								setUncertain(false);
							}}
							type="button"
							variant="outline"
						>
							{new Date(record.createdAt).toLocaleString("tr-TR")} ·{" "}
							{record.versionPins.length} Varlık Sürümü
						</Button>
					</li>
				))}
			</ul>
			{selected ? (
				<>
					<div className="grid gap-4 sm:grid-cols-2">
						{selected.versionPins.map((pin) => {
							const version = catalog.assetVersions.find(
								(candidate) => candidate.id === pin.assetVersionId
							);
							return (
								<VersionCard
									key={pin.assetVersionId}
									name={pin.assetRecordName}
									unitVersions={pin.unitVersions}
									version={version}
									versionNumber={pin.versionNumber}
								/>
							);
						})}
					</div>
					<ObservationSummary observations={selected.observations} />
					<Button
						onClick={() => {
							setSelected(null);
							setMessage("");
						}}
						type="button"
					>
						Yeni karşılaştırma
					</Button>
				</>
			) : (
				<div className="space-y-4">
					<fieldset className="space-y-3" disabled={saving || uncertain}>
						<legend className="font-medium">
							Karşılaştırılacak güncel sürümler
						</legend>
						{eligibleRecords.map((record) => {
							const version = currentVersionByRecord.get(record.id);
							const checked = selectedRecordIds.includes(record.id);
							return (
								<label
									className="flex items-start gap-3 rounded border p-3"
									key={record.id}
								>
									<input
										checked={checked}
										disabled={
											!version || (!checked && selectedRecordIds.length >= 100)
										}
										onChange={() =>
											setSelectedRecordIds((current) =>
												checked
													? current.filter((id) => id !== record.id)
													: [...current, record.id]
											)
										}
										type="checkbox"
									/>
									<span>
										<span className="block font-medium">{record.name}</span>
										<span className="text-muted-foreground text-sm">
											{version
												? `Güncel Varlık Sürümü ${version.versionNumber}`
												: "Karşılaştırılabilir güncel sürüm yok"}
										</span>
									</span>
								</label>
							);
						})}
					</fieldset>
					{selectedVersions.length ? (
						<div className="grid gap-4 sm:grid-cols-2">
							{selectedVersions.map(({ record, version }) => (
								<VersionCard
									key={version.id}
									name={record.name}
									unitVersions={
										unitVersionsByAssetVersion.get(version.id) ?? []
									}
									version={version}
									versionNumber={version.versionNumber}
								/>
							))}
						</div>
					) : null}
					<div className="grid gap-4 sm:grid-cols-2">
						{(
							Object.keys(observationLabels) as Array<
								keyof typeof observationLabels
							>
						).map((key) => (
							<label className="space-y-1" key={key}>
								<span className="font-medium text-sm">
									{observationLabels[key]}
								</span>
								<textarea
									aria-label={observationLabels[key]}
									className="min-h-24 w-full rounded border bg-background p-2"
									disabled={saving || uncertain}
									maxLength={1000}
									onChange={(event) =>
										setObservations((current) => ({
											...current,
											[key]: event.target.value,
										}))
									}
									value={observations[key]}
								/>
							</label>
						))}
					</div>
					<p className="text-muted-foreground text-sm">
						Gerekli durumları Gerekli Öğeler Listesi’nde izlemeye devam edin.
					</p>
					<Button disabled={!canSave} onClick={() => void save()} type="button">
						{saving ? "Kaydediliyor…" : "Karşılaştırmayı kaydet"}
					</Button>
				</div>
			)}
		</section>
	);
}

function VersionCard({
	name,
	unitVersions,
	version,
	versionNumber,
}: {
	name: string;
	unitVersions: Array<{
		id?: string;
		unitKey: string;
		unitType: string;
		versionNumber: number;
	}>;
	version?: AssetVersionCatalog["assetVersions"][number];
	versionNumber: number;
}) {
	return (
		<article className="space-y-2 rounded border p-3">
			<h4 className="font-medium">
				{name} · Varlık Sürümü {versionNumber}
			</h4>
			{version ? (
				<AssetVersionPreview
					recordName={name}
					url={`${serverUrl}${version.previewUrl}`}
					versionNumber={versionNumber}
				/>
			) : (
				<p className="text-muted-foreground text-sm">
					Bu sürüm artık görüntülenemiyor.
				</p>
			)}
			{unitVersions.length ? (
				<ul className="text-muted-foreground text-sm">
					{unitVersions.map((unitVersion) => (
						<li
							key={
								unitVersion.id ??
								`${unitVersion.unitType}:${unitVersion.unitKey}`
							}
						>
							{unitVersion.unitType} · {unitVersion.unitKey} · Birim Sürümü{" "}
							{unitVersion.versionNumber}
						</li>
					))}
				</ul>
			) : null}
		</article>
	);
}

function ObservationSummary({
	observations,
}: {
	observations: AssetFamilyComparisonRecord["observations"];
}) {
	return (
		<dl className="grid gap-3 sm:grid-cols-2">
			{(
				Object.keys(observationLabels) as Array<keyof typeof observationLabels>
			).map((key) => (
				<div key={key}>
					<dt className="font-medium text-sm">{observationLabels[key]}</dt>
					<dd className="text-muted-foreground text-sm">{observations[key]}</dd>
				</div>
			))}
		</dl>
	);
}
