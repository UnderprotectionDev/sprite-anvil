import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type {
	AssetVersionCatalog,
	AssetVersionReviewInput,
} from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { useState } from "react";
import { ENV } from "@/env";
import type { useAssetVersionWrites } from "../hooks/use-asset-version-writes";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

const reviewLabels = {
	candidate: "Aday",
	approved: "Onaylandı",
	rejected: "Reddedildi",
} as const;

const reviewEventLabels = {
	candidate: "Aday olarak kaydedildi",
	approved: "İnceleme ile onaylandı",
	rejected: "İnceleme ile reddedildi",
} as const;

export function AssetVersionControls({
	assetVersionCatalog,
	catalog,
	writes,
}: {
	assetVersionCatalog: AssetVersionCatalog;
	catalog: AssetFamilyCatalog;
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	const recordsByFamily = new Map<string, typeof catalog.assetRecords>();
	for (const record of catalog.assetRecords) {
		const records = recordsByFamily.get(record.assetFamilyId) ?? [];
		records.push(record);
		recordsByFamily.set(record.assetFamilyId, records);
	}
	const versionsByRecord = new Map<
		string,
		typeof assetVersionCatalog.assetVersions
	>();
	for (const version of assetVersionCatalog.assetVersions) {
		const versions = versionsByRecord.get(version.assetRecordId) ?? [];
		versions.push(version);
		versionsByRecord.set(version.assetRecordId, versions);
	}
	const canonicalByFamily = new Map<
		string,
		(typeof assetVersionCatalog.canonicalDesigns)[number]
	>();
	for (const design of assetVersionCatalog.canonicalDesigns) {
		canonicalByFamily.set(design.assetFamilyId, design);
	}

	return (
		<section
			aria-labelledby="asset-version-controls-heading"
			className="space-y-4"
		>
			<div>
				<h2
					className="font-semibold text-2xl"
					id="asset-version-controls-heading"
				>
					Varlık Sürümleri ve inceleme
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					PNG veya WebP dosyalarını yükleyin, Aday Sürümleri inceleyin ve
					onaylanan sürümü Ana Tasarım olarak seçin.
				</p>
			</div>
			{writes.errorMessage ? <p role="alert">{writes.errorMessage}</p> : null}
			{writes.statusMessage ? (
				<p aria-live="polite" role="status">
					{writes.statusMessage}
				</p>
			) : null}
			{writes.activeAction ? (
				<p aria-live="polite" role="status">
					{writes.activeAction.startsWith("upload:")
						? "Varlık Sürümü yükleniyor…"
						: "Varlık Sürümü işlemi kaydediliyor…"}
				</p>
			) : null}
			{writes.writeOutcomeUncertain ? (
				<Button
					disabled={writes.isCheckingOutcome}
					onClick={() => void writes.checkWriteOutcome()}
					type="button"
					variant="outline"
				>
					{writes.isCheckingOutcome
						? "Durum kontrol ediliyor…"
						: "Sürüm işleminin durumunu kontrol et"}
				</Button>
			) : null}
			{catalog.assetFamilies.map((family) => {
				const familyRecords = recordsByFamily.get(family.id) ?? [];
				const canonicalDesign = canonicalByFamily.get(family.id);
				return (
					<article className="space-y-3 rounded-lg border p-4" key={family.id}>
						<h3 className="font-medium">{family.name}</h3>
						{familyRecords.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								Önce bu Varlık Ailesine bir Varlık Kaydı ekleyin.
							</p>
						) : (
							<ul className="space-y-4">
								{familyRecords.map((record) => {
									const versions = versionsByRecord.get(record.id) ?? [];
									return (
										<li className="space-y-3 border-t pt-3" key={record.id}>
											<div className="flex flex-wrap items-center justify-between gap-3">
												<h4 className="font-medium">{record.name}</h4>
												<label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3 py-2 text-sm focus-within:outline-hidden focus-within:ring-2 focus-within:ring-ring">
													<span>Varlık Sürümü yükle</span>
													<input
														accept="image/png,image/webp"
														aria-label={`${record.name} için Varlık Sürümü dosyası`}
														className="sr-only"
														disabled={writes.writesDisabled}
														onChange={(event) => {
															const file = event.currentTarget.files?.[0];
															event.currentTarget.value = "";
															if (file) {
																void writes.upload(record.id, file);
															}
														}}
														type="file"
													/>
												</label>
											</div>
											{versions.length === 0 ? (
												<p className="text-muted-foreground text-sm">
													Henüz sürüm kaydedilmedi.
												</p>
											) : (
												<ol className="space-y-3">
													{versions.map((version) => (
														<li
															className="grid gap-3 rounded-md border p-3 sm:grid-cols-[8rem_1fr]"
															key={version.id}
														>
															<AssetVersionPreview
																recordName={record.name}
																url={`${serverUrl}${version.previewUrl}`}
																versionNumber={version.versionNumber}
															/>
															<div className="space-y-2">
																<p className="font-medium">
																	Sürüm {version.versionNumber} ·{" "}
																	{reviewLabels[version.reviewDisposition]}
																</p>
																<ol className="list-inside list-disc text-muted-foreground text-sm">
																	{version.reviewEvents.map((reviewEvent) => (
																		<li key={reviewEvent.id}>
																			<span>
																				{reviewEventLabels[reviewEvent.type]}
																			</span>{" "}
																			<time dateTime={reviewEvent.createdAt}>
																				{new Date(
																					reviewEvent.createdAt
																				).toLocaleString("tr-TR")}
																			</time>
																			{reviewEvent.rationale ? (
																				<span>
																					{" "}
																					— Gerekçe: {reviewEvent.rationale}
																				</span>
																			) : null}
																		</li>
																	))}
																</ol>
																<p className="text-muted-foreground text-sm">
																	Dosya bütünlüğü:{" "}
																	{version.integrityVerified
																		? "Doğrulandı"
																		: "Doğrulanmadı"}
																</p>
																<AssetVersionReviewControls
																	version={version}
																	writes={writes}
																/>
																{version.reviewDisposition === "approved" ? (
																	<Button
																		disabled={
																			writes.writesDisabled ||
																			canonicalDesign?.assetVersionId ===
																				version.id
																		}
																		onClick={() =>
																			void writes.selectCanonicalDesign(
																				family.id,
																				version.id
																			)
																		}
																		type="button"
																		variant="outline"
																	>
																		{canonicalDesign?.assetVersionId ===
																		version.id
																			? "Seçili Ana Tasarım"
																			: "Ana Tasarım olarak seç"}
																	</Button>
																) : null}
															</div>
														</li>
													))}
												</ol>
											)}
										</li>
									);
								})}
							</ul>
						)}
					</article>
				);
			})}
		</section>
	);
}

function AssetVersionReviewControls({
	version,
	writes,
}: {
	version: AssetVersionCatalog["assetVersions"][number];
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	const [rationale, setRationale] = useState("");
	const review = (decision: AssetVersionReviewInput["decision"]) =>
		void writes.review(version.id, decision, rationale);

	return (
		<div className="space-y-2">
			<label
				className="block space-y-1 text-sm"
				htmlFor={`review-rationale-${version.id}`}
			>
				<span>İnceleme gerekçesi</span>
				<textarea
					className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
					id={`review-rationale-${version.id}`}
					maxLength={2000}
					onChange={(event) => setRationale(event.currentTarget.value)}
					required
					value={rationale}
				/>
			</label>
			<div className="flex flex-wrap gap-2">
				{version.reviewDisposition === "approved" ? null : (
					<Button
						disabled={
							writes.writesDisabled ||
							rationale.trim().length === 0 ||
							!version.integrityVerified ||
							!version.contentDigest
						}
						onClick={() => review("approved")}
						type="button"
					>
						Onayla
					</Button>
				)}
				{version.reviewDisposition === "rejected" ? null : (
					<Button
						disabled={writes.writesDisabled || rationale.trim().length === 0}
						onClick={() => review("rejected")}
						type="button"
						variant="outline"
					>
						Reddet
					</Button>
				)}
				{version.reviewDisposition === "candidate" ? null : (
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

function AssetVersionPreview({
	recordName,
	url,
	versionNumber,
}: {
	recordName: string;
	url: string;
	versionNumber: number;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<p className="w-32 self-center text-destructive text-sm" role="alert">
				Sürüm {versionNumber} önizlemesi bütünlük doğrulamasından geçemedi.
			</p>
		);
	}
	return (
		<img
			alt={`${recordName}, Sürüm ${versionNumber} önizlemesi`}
			className="aspect-square w-32 rounded border bg-muted object-contain"
			crossOrigin="use-credentials"
			height={128}
			loading="lazy"
			onError={() => setFailed(true)}
			src={url}
			width={128}
		/>
	);
}
