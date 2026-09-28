import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type {
	AssetVersionCatalog,
	AssetVersionReviewInput,
} from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ENV } from "@/env";
import { ExternalWorkingFileEditUpload } from "@/features/production-provenance/ui/components/external-working-file-edit-upload";
import { VersionProductionEvidencePanel } from "@/features/production-provenance/ui/components/version-production-evidence-panel";
import type { useAssetVersionWrites } from "../hooks/use-asset-version-writes";
import { AssetVersionPreview } from "./asset-version-preview";
import { CompositeVersionControls } from "./composite-version-controls";
import { ProviderGenerationRecordDetails } from "./provider-generation-record-details";
import { ProviderGenerationRecordForm } from "./provider-generation-record-form";
import { reviewDispositionLabels } from "./review-disposition-labels";
import {
	UnitVersionCorrectionForm,
	UnitVersionHistory,
} from "./unit-version-correction-form";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

const reviewEventLabels = {
	candidate: "Aday olarak kaydedildi",
	approved: "İnceleme ile onaylandı",
	rejected: "İnceleme ile reddedildi",
} as const;

function activeActionMessage(activeAction: string) {
	if (activeAction.startsWith("upload:")) {
		return "Varlık Sürümü yükleniyor…";
	}
	if (activeAction.startsWith("provider-record:")) {
		return "Sağlayıcı Üretim Kaydı kaydediliyor…";
	}
	if (activeAction.startsWith("composite")) {
		return "Birleşik Sürüm işlemi kaydediliyor…";
	}
	return "Varlık Sürümü işlemi kaydediliyor…";
}

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
				<p className="mt-1 text-muted-foreground text-sm">
					Sağlayıcı ekranında oluşturduğunuz sonucu yükledikten sonra, görünen
					alanları Sağlayıcı Üretim Kaydı formuna elle girebilirsiniz.
				</p>
			</div>
			{writes.statusMessage ? (
				<p aria-live="polite" role="status">
					{writes.statusMessage}
				</p>
			) : null}
			{writes.activeAction ? (
				<p aria-live="polite" role="status">
					{activeActionMessage(writes.activeAction)}
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
									const unitVersions = assetVersionCatalog.unitVersions.filter(
										(unitVersion) => unitVersion.assetRecordId === record.id
									);
									return (
										<li className="space-y-3 border-t pt-3" key={record.id}>
											<div className="flex flex-wrap items-center justify-between gap-3">
												<h4 className="font-medium">{record.name}</h4>
												<Link
													className="inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
													params={{
														assetRecordId: record.id,
														projectId: family.projectId,
													}}
													to="/projects/$projectId/assets/$assetRecordId"
												>
													Varlık Sürümü yükle
												</Link>
											</div>
											<ExternalWorkingFileEditUpload
												disabled={writes.writesDisabled}
												onImport={(candidateFile, sourceFile) =>
													writes.upload(record.id, candidateFile, {
														managedSnapshot: sourceFile,
														sourceKind: "external_working_file_edit",
													})
												}
											/>
											{versions.length === 0 ? (
												<p className="text-muted-foreground text-sm">
													Henüz sürüm kaydedilmedi.
												</p>
											) : (
												<ol className="space-y-3">
													{versions.map((version) => (
														<AssetVersionEntry
															canonicalDesign={canonicalDesign}
															familyId={family.id}
															key={version.id}
															recordName={record.name}
															version={version}
															writes={writes}
														/>
													))}
												</ol>
											)}
											<UnitVersionHistory
												assetVersions={versions}
												unitVersions={unitVersions}
											/>
											<UnitVersionCorrectionForm
												assetRecordId={record.id}
												assetVersions={versions}
												unitVersions={unitVersions}
												writes={writes}
											/>
											<CompositeVersionControls
												assetRecordId={record.id}
												assetRecordName={record.name}
												assetVersions={versions}
												compositeVersions={assetVersionCatalog.compositeVersions.filter(
													(compositeVersion) =>
														compositeVersion.assetRecordId === record.id
												)}
												unitVersions={unitVersions}
												writes={writes}
											/>
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

function AssetVersionEntry({
	canonicalDesign,
	familyId,
	recordName,
	version,
	writes,
}: {
	canonicalDesign: AssetVersionCatalog["canonicalDesigns"][number] | undefined;
	familyId: string;
	recordName: string;
	version: AssetVersionCatalog["assetVersions"][number];
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	const isCanonical = canonicalDesign?.assetVersionId === version.id;

	return (
		<li className="grid gap-3 rounded-md border p-3 sm:grid-cols-[8rem_1fr]">
			<AssetVersionPreview
				recordName={recordName}
				url={`${serverUrl}${version.previewUrl}`}
				versionNumber={version.versionNumber}
			/>
			<div className="space-y-2">
				<p className="font-medium">
					Sürüm {version.versionNumber} ·{" "}
					{reviewDispositionLabels[version.reviewDisposition]}
				</p>
				<AssetVersionReviewHistory reviewEvents={version.reviewEvents} />
				<p className="text-muted-foreground text-sm">
					Dosya bütünlüğü:{" "}
					{version.integrityVerified ? "Doğrulandı" : "Doğrulanmadı"}
				</p>
				<VersionProductionEvidencePanel
					assetRecordId={version.assetRecordId}
					evidence={version.productionEvidence}
					onRefresh={writes.refreshCatalogs}
					projectId={version.projectId}
					reviewDisposition={version.reviewDisposition}
					versionId={version.id}
				/>
				<ProviderGenerationRecordDetails
					productionSource={version.productionSource ?? "unknown"}
					providerGenerationRecord={version.providerGenerationRecord ?? null}
				/>
				{version.productionSource === "user_reported_provider" &&
				!version.providerGenerationRecord ? (
					<ProviderGenerationRecordForm
						onSave={(input) =>
							writes.recordProviderGeneration(version.id, input)
						}
						writesDisabled={writes.writesDisabled}
					/>
				) : null}
				<AssetVersionReviewControls version={version} writes={writes} />
				{version.reviewDisposition === "approved" ? (
					<Button
						disabled={writes.writesDisabled || isCanonical}
						onClick={() =>
							void writes.selectCanonicalDesign(familyId, version.id)
						}
						type="button"
						variant="outline"
					>
						{isCanonical ? "Seçili Ana Tasarım" : "Ana Tasarım olarak seç"}
					</Button>
				) : null}
			</div>
		</li>
	);
}

function AssetVersionReviewHistory({
	reviewEvents,
}: {
	reviewEvents: AssetVersionCatalog["assetVersions"][number]["reviewEvents"];
}) {
	return (
		<ol className="list-inside list-disc text-muted-foreground text-sm">
			{reviewEvents.map((reviewEvent) => (
				<li key={reviewEvent.id}>
					<span>{reviewEventLabels[reviewEvent.type]}</span>{" "}
					<time dateTime={reviewEvent.createdAt}>
						{new Date(reviewEvent.createdAt).toLocaleString("tr-TR")}
					</time>
					{reviewEvent.rationale ? (
						<span> — Gerekçe: {reviewEvent.rationale}</span>
					) : null}
				</li>
			))}
		</ol>
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
	const providerGenerationRecordMissing =
		version.productionSource === "connected_provider" &&
		!version.providerGenerationRecord;
	const review = (decision: AssetVersionReviewInput["decision"]) =>
		void writes.review(version.id, decision, rationale);
	const productionEvidenceIncomplete =
		version.productionEvidence.evidenceLevel === "incomplete";
	const manualEvidenceIncomplete =
		version.productionEvidence.sourceKind === "manual_import" &&
		productionEvidenceIncomplete;
	const managedSnapshotIncomplete =
		version.productionEvidence.sourceKind === "external_working_file_edit" &&
		productionEvidenceIncomplete;

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
							productionEvidenceIncomplete ||
							providerGenerationRecordMissing ||
							!version.integrityVerified ||
							!version.contentDigest
						}
						onClick={() => review("approved")}
						type="button"
					>
						Onayla
					</Button>
				)}
				{manualEvidenceIncomplete ? (
					<p className="text-muted-foreground text-xs" role="status">
						Onaydan önce Üretim Paketi, kaynak yüzeyi ve gerçek üretim
						talimatını kaydedin.
					</p>
				) : null}
				{managedSnapshotIncomplete ? (
					<p className="text-muted-foreground text-xs" role="status">
						Onaydan önce çalışma dosyasının Yönetilen Kopyasını kaydedin.
					</p>
				) : null}
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
