import type {
	AssetVersion,
	CompositeVersion,
	UnitVersion,
	UnitVersionType,
} from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { type SyntheticEvent, useState } from "react";
import { ENV } from "@/env";
import type { useAssetVersionWrites } from "../hooks/use-asset-version-writes";
import { AssetVersionPreview } from "./asset-version-preview";
import { unitTypeLabels } from "./unit-version-correction-form";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

const reviewLabels = {
	candidate: "Aday",
	approved: "Onaylandı",
	rejected: "Reddedildi",
} as const;

function getSlotKey(unitType: UnitVersionType, unitKey: string) {
	return `${unitType}\u0000${unitKey}`;
}

function groupUnitVersions(unitVersions: UnitVersion[]) {
	const slots = new Map<
		string,
		{ unitKey: string; unitType: UnitVersionType; unitVersions: UnitVersion[] }
	>();
	for (const unitVersion of unitVersions) {
		const key = getSlotKey(unitVersion.unitType, unitVersion.unitKey);
		const slot = slots.get(key) ?? {
			unitKey: unitVersion.unitKey,
			unitType: unitVersion.unitType,
			unitVersions: [],
		};
		slot.unitVersions.push(unitVersion);
		slots.set(key, slot);
	}
	return [...slots.values()]
		.map((slot) => ({
			...slot,
			unitVersions: [...slot.unitVersions].sort(
				(left, right) => right.versionNumber - left.versionNumber
			),
		}))
		.sort(
			(left, right) =>
				left.unitType.localeCompare(right.unitType) ||
				left.unitKey.localeCompare(right.unitKey)
		);
}

export function CompositeVersionControls({
	assetRecordId,
	assetRecordName,
	assetVersions,
	compositeVersions,
	unitVersions,
	writes,
}: {
	assetRecordId: string;
	assetRecordName: string;
	assetVersions: AssetVersion[];
	compositeVersions: CompositeVersion[];
	unitVersions: UnitVersion[];
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	const [sourceCompositeVersionId, setSourceCompositeVersionId] = useState("");
	const [selectedUnitVersionIds, setSelectedUnitVersionIds] = useState<
		Record<string, string>
	>({});
	const slots = groupUnitVersions(unitVersions);
	const formId = `composite-version-${assetRecordId}`;
	const unitVersionsById = new Map(
		unitVersions.map((unitVersion) => [unitVersion.id, unitVersion])
	);
	const assetVersionsById = new Map(
		assetVersions.map((assetVersion) => [assetVersion.id, assetVersion])
	);
	const selectedSource = compositeVersions.find(
		(compositeVersion) => compositeVersion.id === sourceCompositeVersionId
	);
	const selectedUnitVersionIdsForSave = Object.values(
		selectedUnitVersionIds
	).filter((id) => unitVersionsById.has(id));

	function chooseSourceCompositeVersion(id: string) {
		setSourceCompositeVersionId(id);
		const source = compositeVersions.find(
			(compositeVersion) => compositeVersion.id === id
		);
		setSelectedUnitVersionIds(
			Object.fromEntries(
				(source?.compositionMemberships ?? []).map((membership) => [
					getSlotKey(membership.unitType, membership.unitKey),
					membership.unitVersionId,
				])
			)
		);
	}

	async function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (selectedUnitVersionIdsForSave.length === 0) {
			return;
		}
		const created = await writes.createCompositeVersion(
			assetRecordId,
			selectedUnitVersionIdsForSave
		);
		if (created) {
			setSourceCompositeVersionId("");
			setSelectedUnitVersionIds({});
		}
	}

	return (
		<section
			aria-labelledby={`${formId}-heading`}
			className="space-y-3 border-t pt-3"
		>
			<div>
				<h5 className="font-medium" id={`${formId}-heading`}>
					Birleşik Sürümleri
				</h5>
				<p className="text-muted-foreground text-sm">
					Yeni sürümde kullanılacak kesin Birim Sürümlerini seçin. Önceki
					Birleşik Sürümler ve kullanılmayan birimler korunur.
				</p>
			</div>

			{unitVersions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Önce Birim Sürümleri oluşturun. Seçici düzeltme formu bu kayda ait
					birimleri burada listeler.
				</p>
			) : (
				<form className="space-y-3" onSubmit={submit}>
					<label
						className="block space-y-1 text-sm"
						htmlFor={`${formId}-source`}
					>
						<span className="block">Başlangıç Birleşik Sürümü</span>
						<select
							className="min-h-11 w-full rounded-md border bg-background px-3"
							disabled={writes.writesDisabled || compositeVersions.length === 0}
							id={`${formId}-source`}
							onChange={(event) =>
								chooseSourceCompositeVersion(event.currentTarget.value)
							}
							value={sourceCompositeVersionId}
						>
							<option value="">Boş seçimle başla</option>
							{compositeVersions.map((compositeVersion) => (
								<option key={compositeVersion.id} value={compositeVersion.id}>
									Birleşik Sürüm {compositeVersion.versionNumber} ·{" "}
									{reviewLabels[compositeVersion.reviewDisposition]}
								</option>
							))}
						</select>
					</label>

					<fieldset className="space-y-3">
						<legend className="font-medium text-sm">
							Yeni Birleşik Sürümün Birim Sürümleri
						</legend>
						<p className="text-muted-foreground text-sm">
							Aynı birim için bir sürüm seçin veya bu birimi bileşime almayın.
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							{slots.map((slot, index) => {
								const key = getSlotKey(slot.unitType, slot.unitKey);
								const fieldId = `${formId}-unit-${index}`;
								return (
									<label
										className="space-y-1 text-sm"
										htmlFor={fieldId}
										key={key}
									>
										<span className="block">
											{unitTypeLabels[slot.unitType]} · {slot.unitKey}
										</span>
										<select
											className="min-h-11 w-full rounded-md border bg-background px-3"
											disabled={writes.writesDisabled}
											id={fieldId}
											onChange={(event) => {
												const selectedUnitVersionId = event.currentTarget.value;
												setSelectedUnitVersionIds((current) => ({
													...current,
													[key]: selectedUnitVersionId,
												}));
											}}
											value={selectedUnitVersionIds[key] ?? ""}
										>
											<option value="">Bileşime ekleme</option>
											{slot.unitVersions.map((unitVersion) => {
												const assetVersion = assetVersionsById.get(
													unitVersion.assetVersionId
												);
												return (
													<option key={unitVersion.id} value={unitVersion.id}>
														Birim Sürümü {unitVersion.versionNumber}
														{assetVersion
															? ` · Varlık Sürümü ${assetVersion.versionNumber} · ${reviewLabels[assetVersion.reviewDisposition]}`
															: ""}
													</option>
												);
											})}
										</select>
									</label>
								);
							})}
						</div>
					</fieldset>
					<Button
						disabled={
							writes.writesDisabled ||
							selectedUnitVersionIdsForSave.length === 0
						}
						type="submit"
					>
						Yeni Birleşik Sürüm kaydet
					</Button>
				</form>
			)}

			{compositeVersions.length > 0 ? (
				<ol className="space-y-4">
					{compositeVersions.map((compositeVersion) => (
						<li key={compositeVersion.id}>
							<CompositeVersionHistoryItem
								assetRecordName={assetRecordName}
								assetVersionsById={assetVersionsById}
								compositeVersion={compositeVersion}
								unitVersionsById={unitVersionsById}
								writes={writes}
							/>
						</li>
					))}
				</ol>
			) : null}
			{selectedSource ? (
				<p aria-live="polite" className="sr-only">
					Birleşik Sürüm {selectedSource.versionNumber} üyelikleri seçildi.
				</p>
			) : null}
		</section>
	);
}

function CompositeVersionHistoryItem({
	assetRecordName,
	assetVersionsById,
	compositeVersion,
	unitVersionsById,
	writes,
}: {
	assetRecordName: string;
	assetVersionsById: Map<string, AssetVersion>;
	compositeVersion: CompositeVersion;
	unitVersionsById: Map<string, UnitVersion>;
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	return (
		<article className="space-y-3 border-t pt-3">
			<div>
				<h6 className="font-medium">
					Birleşik Sürüm {compositeVersion.versionNumber} ·{" "}
					{reviewLabels[compositeVersion.reviewDisposition]}
				</h6>
				<p className="text-muted-foreground text-sm">
					Bu sürüm kendi inceleme kararını taşır.
				</p>
			</div>
			{compositeVersion.compositionMemberships.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Bu Birleşik Sürümde Birim Sürümü yok.
				</p>
			) : (
				<ol className="grid gap-3 sm:grid-cols-2">
					{compositeVersion.compositionMemberships.map((membership) => {
						const unitVersion = unitVersionsById.get(membership.unitVersionId);
						const assetVersion = unitVersion
							? assetVersionsById.get(unitVersion.assetVersionId)
							: undefined;
						return (
							<li
								className="flex flex-wrap items-center gap-3"
								key={membership.id}
							>
								{assetVersion ? (
									<AssetVersionPreview
										recordName={assetRecordName}
										url={`${serverUrl}${assetVersion.previewUrl}`}
										versionNumber={assetVersion.versionNumber}
									/>
								) : null}
								<div className="text-sm">
									<p>
										{unitTypeLabels[membership.unitType]} · {membership.unitKey}{" "}
										· Birim Sürümü {unitVersion?.versionNumber ?? "—"}
									</p>
									{assetVersion ? (
										<p className="text-muted-foreground">
											Varlık Sürümü {assetVersion.versionNumber} ·{" "}
											{reviewLabels[assetVersion.reviewDisposition]}
										</p>
									) : null}
								</div>
							</li>
						);
					})}
				</ol>
			)}
			<ol className="list-inside list-disc text-muted-foreground text-sm">
				{compositeVersion.reviewEvents.map((reviewEvent) => (
					<li key={reviewEvent.id}>
						{reviewEvent.type === "candidate"
							? "Aday olarak kaydedildi"
							: `İnceleme ile ${reviewLabels[reviewEvent.type].toLowerCase()}`}{" "}
						<time dateTime={reviewEvent.createdAt}>
							{new Date(reviewEvent.createdAt).toLocaleString("tr-TR")}
						</time>
						{reviewEvent.rationale
							? ` — Gerekçe: ${reviewEvent.rationale}`
							: ""}
					</li>
				))}
			</ol>
			<CompositeVersionReviewControls
				compositeVersion={compositeVersion}
				writes={writes}
			/>
		</article>
	);
}

function CompositeVersionReviewControls({
	compositeVersion,
	writes,
}: {
	compositeVersion: CompositeVersion;
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	const [rationale, setRationale] = useState("");
	const review = (decision: "approved" | "candidate" | "rejected") =>
		void writes.reviewCompositeVersion(
			compositeVersion.id,
			decision,
			rationale
		);

	return (
		<div className="space-y-2">
			<label
				className="block space-y-1 text-sm"
				htmlFor={`composite-review-rationale-${compositeVersion.id}`}
			>
				<span>
					Birleşik Sürüm {compositeVersion.versionNumber} inceleme gerekçesi
				</span>
				<textarea
					className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
					disabled={writes.writesDisabled}
					id={`composite-review-rationale-${compositeVersion.id}`}
					maxLength={2000}
					onChange={(event) => setRationale(event.currentTarget.value)}
					required
					value={rationale}
				/>
			</label>
			<div className="flex flex-wrap gap-2">
				{compositeVersion.reviewDisposition === "approved" ? null : (
					<Button
						disabled={writes.writesDisabled || rationale.trim().length === 0}
						onClick={() => review("approved")}
						type="button"
					>
						Onayla
					</Button>
				)}
				{compositeVersion.reviewDisposition === "rejected" ? null : (
					<Button
						disabled={writes.writesDisabled || rationale.trim().length === 0}
						onClick={() => review("rejected")}
						type="button"
						variant="outline"
					>
						Reddet
					</Button>
				)}
				{compositeVersion.reviewDisposition === "candidate" ? null : (
					<Button
						disabled={writes.writesDisabled || rationale.trim().length === 0}
						onClick={() => review("candidate")}
						type="button"
						variant="outline"
					>
						Aday yap
					</Button>
				)}
			</div>
		</div>
	);
}
