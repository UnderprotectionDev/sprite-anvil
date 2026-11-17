import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type {
	AssetVersionCatalog,
	AssetVersionReviewInput,
} from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { AssetVersionPreview } from "@/components/asset-version-preview";
import { ExternalWorkingFileEditUpload } from "@/components/external-working-file-edit-upload";
import { ProviderGenerationRecordForm } from "@/components/provider-generation-record-form";
import { VersionProductionEvidencePanel } from "@/components/version-production-evidence-panel";
import { ENV } from "@/env";
import { reviewDispositionLabels } from "@/features/asset-versions/lib/review-disposition-labels";
import { reviewRationaleFormSchema } from "@/features/asset-versions/schemas";
import { BatchReviewControls } from "@/features/asset-versions/ui/components/batch-review-controls";
import { CompositeVersionControls } from "@/features/asset-versions/ui/components/composite-version-controls";
import { ProviderGenerationRecordDetails } from "@/features/asset-versions/ui/components/provider-generation-record-details";
import {
	UnitVersionCorrectionForm,
	UnitVersionHistory,
} from "@/features/asset-versions/ui/components/unit-version-correction-form";
import type { useAssetVersionWrites } from "@/utils/use-asset-version-writes";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

const reviewEventLabels = {
	candidate: "Saved as candidate",
	approved: "Approved through review",
	rejected: "Rejected through review",
} as const;

function activeActionMessage(activeAction: string) {
	if (activeAction.startsWith("upload:")) {
		return "Loading Asset Versions…";
	}
	if (activeAction.startsWith("provider-record:")) {
		return "Saving Provider Generation Record…";
	}
	if (activeAction.startsWith("composite")) {
		return "Saving Composite Version operation…";
	}
	return "Saving Asset Version operation…";
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
					Asset Versions and review
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Upload PNG or WebP files, review Candidate Versions, and select the
					approved version as the Canonical Design.
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					After uploading the result created in a provider interface, you can
					enter visible fields manually in the Provider Generation Record form.
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
						? "Checking status…"
						: "Check version operation status"}
				</Button>
			) : null}
			{assetVersionCatalog.assetVersions[0] ? (
				<BatchReviewControls
					onReview={writes.reviewBatch}
					projectId={assetVersionCatalog.assetVersions[0].projectId}
					versions={assetVersionCatalog.assetVersions.map((version) => ({
						id: version.id,
						name: `${catalog.assetRecords.find((record) => record.id === version.assetRecordId)?.name ?? version.assetRecordId} · Version ${version.versionNumber}`,
					}))}
					writesDisabled={writes.writesDisabled}
				/>
			) : null}
			{catalog.assetFamilies.map((family) => {
				const familyRecords = recordsByFamily.get(family.id) ?? [];
				const canonicalDesign = canonicalByFamily.get(family.id);
				return (
					<article className="space-y-3 rounded-lg border p-4" key={family.id}>
						<h3 className="font-medium">{family.name}</h3>
						{familyRecords.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								Add an Asset Record to this Asset Family first.
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
													Upload Asset Version
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
													No versions saved yet.
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
				assetVersionId={version.id}
				projectId={version.projectId}
				recordName={recordName}
				url={`${serverUrl}${version.previewUrl}`}
				versionNumber={version.versionNumber}
			/>
			<div className="space-y-2">
				<p className="font-medium">
					Version {version.versionNumber} ·{" "}
					{reviewDispositionLabels[version.reviewDisposition]}
				</p>
				<AssetVersionReviewHistory reviewEvents={version.reviewEvents} />
				<Link
					className="text-sm underline underline-offset-4"
					params={{
						assetVersionId: version.id,
						projectId: version.projectId,
					}}
					to="/projects/$projectId/pixel-editor/$assetVersionId"
				>
					Open in Last-Mile Pixel Editor
				</Link>
				<p className="text-muted-foreground text-sm">
					File integrity:{" "}
					{version.integrityVerified ? "Verified" : "Not verified"}
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
						{isCanonical
							? "Selected Canonical Design"
							: "Select as Canonical Design"}
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
						<span> — Rationale: {reviewEvent.rationale}</span>
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
	const form = useForm({
		defaultValues: { rationale: "" },
		validators: { onChange: reviewRationaleFormSchema },
	});
	const rationale = useStore(form.store, (state) => state.values.rationale);
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
			<Label
				className="block space-y-1 text-sm"
				htmlFor={`review-rationale-${version.id}`}
			>
				<span>Review rationale</span>
				<form.Field name="rationale">
					{(field) => (
						<Textarea
							className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm md:text-sm"
							id={`review-rationale-${version.id}`}
							maxLength={2000}
							onBlur={field.handleBlur}
							onChange={(event) =>
								field.handleChange(event.currentTarget.value)
							}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
			</Label>
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
						Approve
					</Button>
				)}
				{manualEvidenceIncomplete ? (
					<p className="text-muted-foreground text-xs" role="status">
						Save the Generation Package, source surface, and actual production
						instruction before approval.
					</p>
				) : null}
				{managedSnapshotIncomplete ? (
					<p className="text-muted-foreground text-xs" role="status">
						Save a Managed Snapshot of the working file before approval.
					</p>
				) : null}
				{version.reviewDisposition === "rejected" ? null : (
					<Button
						disabled={writes.writesDisabled || rationale.trim().length === 0}
						onClick={() => review("rejected")}
						type="button"
						variant="outline"
					>
						Reject
					</Button>
				)}
				{version.reviewDisposition === "candidate" ? null : (
					<Button
						disabled={writes.writesDisabled || rationale.trim().length === 0}
						onClick={() => review("candidate")}
						type="button"
						variant="outline"
					>
						Make candidate
					</Button>
				)}
			</div>
		</div>
	);
}
