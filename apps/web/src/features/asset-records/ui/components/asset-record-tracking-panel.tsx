import type {
	AssetRecordTrackingDetail,
	AssetVersionCreateInput,
	AssetVersionSummary,
} from "@sprite-anvil/api/asset-record-tracking";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LiveFileLinkPanel } from "@/components/live-file-link-panel";
import { VersionProductionEvidencePanel } from "@/components/version-production-evidence-panel";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { useAssetVersionWrites } from "@/utils/use-asset-version-writes";
import { trackingReviewRationaleFormSchema } from "../../schemas";
import {
	AssetFamilyForm,
	type AssetFamilyValues,
	useAssetFamilyForm,
} from "../forms/asset-family-form";
import {
	CandidateVersionForm,
	type CandidateVersionValues,
	useCandidateVersionForm,
} from "../forms/candidate-version-form";
import {
	DerivativeLinkForm,
	type DerivativeLinkValues,
	useDerivativeLinkForm,
} from "../forms/derivative-link-form";

const userRelationshipLabels = {
	created_by_user: "Created by user",
	received_from_team: "Received from team",
	licensed_third_party: "Licensed third party",
	unknown: "Unknown",
} as const;

function displayFileName(fileName: string | null) {
	return fileName ?? "Filename unknown";
}

function getVersionLabel(version: {
	fileName: string | null;
	versionNumber: number;
}) {
	return `${displayFileName(version.fileName)} · Version ${version.versionNumber}`;
}

interface PendingWrite {
	check: (detail: AssetRecordTrackingDetail) => boolean;
	message: string;
}

interface FamilyAndDerivativeSectionProps {
	busy: boolean;
	derivativeForm: ReturnType<typeof useDerivativeLinkForm>;
	detail: AssetRecordTrackingDetail;
	familyForm: ReturnType<typeof useAssetFamilyForm>;
}

function bytesToBase64(bytes: Uint8Array) {
	const chunkSize = 0x80_00;
	const chunks: string[] = [];
	for (let index = 0; index < bytes.length; index += chunkSize) {
		chunks.push(
			String.fromCharCode(...bytes.subarray(index, index + chunkSize))
		);
	}
	return btoa(chunks.join(""));
}

function FamilyAndDerivativeSection({
	busy,
	derivativeForm,
	detail,
	familyForm,
}: FamilyAndDerivativeSectionProps) {
	const { record, tracking } = detail;
	let familyControls: ReactNode = null;
	if (tracking.family?.canonicalVersionId) {
		familyControls = (
			<DerivativeLinkForm
				busy={busy}
				familyLabel={`Asset Family: ${tracking.family.name} · ${tracking.family.visualWorldName}`}
				form={derivativeForm}
				options={tracking.availableRecords.filter(
					(option) =>
						option.id !== record.id &&
						(!option.assetFamilyId ||
							option.assetFamilyId === tracking.family?.id)
				)}
			/>
		);
	} else if (tracking.family) {
		familyControls = (
			<div className="mt-4 space-y-2 border-t pt-3 text-sm">
				<p>
					Asset Family: {tracking.family.name} ·{" "}
					{tracking.family.visualWorldName}
				</p>
				<p className="text-muted-foreground text-xs" role="status">
					This older Asset Family has no recorded Canonical Design Version. The
					user must select it for a Derived Asset link.
				</p>
			</div>
		);
	} else if (tracking.approvedVersion && tracking.visualWorlds.length > 0) {
		familyControls = (
			<AssetFamilyForm
				approvedFileName={displayFileName(tracking.approvedVersion.fileName)}
				busy={busy}
				form={familyForm}
				visualWorlds={tracking.visualWorlds}
			/>
		);
	} else if (tracking.approvedVersion) {
		familyControls = (
			<p className="mt-3 text-muted-foreground text-xs">
				Create a Visual World first; the user sets the Canonical Design and
				usage context.
			</p>
		);
	}

	return (
		<section
			aria-labelledby="derivatives-heading"
			className="rounded-lg border p-4"
		>
			<h3 className="font-medium" id="derivatives-heading">
				Derived Assets
			</h3>
			{tracking.derivatives.length > 0 ? (
				<ul className="mt-2 space-y-2 text-sm">
					{tracking.derivatives.map((derivative) => (
						<li key={derivative.id}>
							{derivative.assetRecordName} · Canonical Design Version{" "}
							{tracking.availableVersions.find(
								(version) => version.id === derivative.canonicalVersionId
							)?.versionNumber ?? "?"}
							{derivative.familyStatus === "unassigned"
								? " · Family link must be revalidated"
								: ""}
						</li>
					))}
				</ul>
			) : (
				<p className="mt-2 text-muted-foreground text-sm">
					No Derived Assets are linked to this record.
				</p>
			)}
			{familyControls}
		</section>
	);
}

export function AssetRecordTrackingPanel({
	detail,
	focusVersionId,
	onRefresh,
}: {
	detail: AssetRecordTrackingDetail;
	focusVersionId?: string;
	onRefresh: () => Promise<unknown>;
}) {
	const { record, tracking } = detail;
	const versionWrites = useAssetVersionWrites(record.projectId, async () => {
		const result: unknown = await onRefresh();
		const isError =
			result && typeof result === "object" && "isError" in result
				? Boolean(result.isError)
				: false;
		return { isError };
	});
	const matchingVersionRef = useRef<HTMLDivElement>(null);
	const matchingVersion = focusVersionId
		? [tracking.approvedVersion, ...tracking.alternatives].find(
				(version) => version?.id === focusVersionId
			)
		: null;
	useEffect(() => {
		if (!matchingVersion) {
			return;
		}
		matchingVersionRef.current?.focus({ preventScroll: true });
		matchingVersionRef.current?.scrollIntoView?.({
			behavior: "smooth",
			block: "center",
		});
	}, [matchingVersion]);
	const pendingWrite = useRef<PendingWrite | null>(null);
	const versionRequest = useRef<{ id: string; signature: string } | null>(null);
	const reviewRequest = useRef<{ id: string; signature: string } | null>(null);
	const familyRequest = useRef<{ id: string; signature: string } | null>(null);
	const derivativeRequest = useRef<{ id: string; signature: string } | null>(
		null
	);
	const createVersionMutation = useMutation(
		orpc.assetRecords.createVersion.mutationOptions(mutationMeta)
	);
	const recordReviewMutation = useMutation(
		orpc.assetRecords.recordReview.mutationOptions(mutationMeta)
	);
	const createFamilyMutation = useMutation(
		orpc.assetRecords.createFamily.mutationOptions(mutationMeta)
	);
	const createDerivativeMutation = useMutation(
		orpc.assetRecords.createDerivative.mutationOptions(mutationMeta)
	);
	const [activeWrite, setActiveWrite] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const reviewForm = useForm({
		defaultValues: { rationale: "" },
		validators: { onChange: trackingReviewRationaleFormSchema },
	});
	const candidateVersionForm = useCandidateVersionForm(createVersion);
	const familyForm = useAssetFamilyForm(createFamily);
	const derivativeForm = useDerivativeLinkForm(createDerivative);

	async function runWrite(
		label: string,
		check: PendingWrite["check"],
		write: () => Promise<unknown>
	) {
		setActiveWrite(label);
		setStatusMessage(null);
		try {
			await write();
			await onRefresh();
			pendingWrite.current = null;
			setWriteOutcomeUncertain(false);
			setStatusMessage(label);
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				pendingWrite.current = { check, message: label };
				setWriteOutcomeUncertain(true);
				toast.error(
					"Could not verify whether the operation was saved. Check the current state."
				);
			} else {
				toast.error(getErrorMessage(error, "Could not save the change."));
			}
		} finally {
			setActiveWrite(null);
		}
	}

	async function checkWriteOutcome() {
		setActiveWrite("Checking status…");
		try {
			const result = await onRefresh();
			if (
				result &&
				typeof result === "object" &&
				"isError" in result &&
				result.isError
			) {
				return;
			}
			const refreshedDetail =
				result && typeof result === "object" && "data" in result
					? result.data
					: undefined;
			if (
				refreshedDetail &&
				pendingWrite.current?.check(
					refreshedDetail as AssetRecordTrackingDetail
				)
			) {
				setStatusMessage(pendingWrite.current.message);
				pendingWrite.current = null;
				setWriteOutcomeUncertain(false);
				return;
			}
			toast.error(
				"The record is not visible yet. You can retry with the same information."
			);
			setWriteOutcomeUncertain(false);
		} catch (error) {
			toast.error(
				getErrorMessage(error, "Could not read the current state.", "query")
			);
		} finally {
			setActiveWrite(null);
		}
	}

	async function createVersion({
		file,
		knownSource,
		supportingEvidence,
		unknownHistoryDetails,
		userRelationship,
	}: CandidateVersionValues) {
		if (!(file && record)) {
			return;
		}
		const missingHistoryDetails = unknownHistoryDetails.trim();
		if (!missingHistoryDetails) {
			return;
		}
		const contentBase64 = bytesToBase64(
			new Uint8Array(await file.arrayBuffer())
		);
		const signature = JSON.stringify({
			contentBase64,
			contentType: file.type,
			fileName: file.name,
			knownSource,
			supportingEvidence,
			unknownHistoryDetails,
			userRelationship,
		});
		if (versionRequest.current?.signature !== signature) {
			versionRequest.current = { id: crypto.randomUUID(), signature };
		}
		const input: AssetVersionCreateInput = {
			assetRecordId: record.id,
			contentBase64,
			contentType: file.type as AssetVersionCreateInput["contentType"],
			fileName: file.name,
			historyUnknown: true,
			id: versionRequest.current.id,
			knownSource: knownSource.trim() || null,
			projectId: record.projectId,
			supportingEvidence: supportingEvidence.trim() || null,
			unknownHistoryDetails: missingHistoryDetails,
			userRelationship,
		};
		await runWrite(
			"Candidate Version saved.",
			(refreshed) => {
				const version = refreshed.tracking.availableVersions.find(
					(availableVersion) => availableVersion.id === input.id
				);
				return Boolean(
					version &&
						refreshed.tracking.productionHistory.some(
							(attestation) =>
								attestation.versionNumber === version.versionNumber &&
								attestation.knownSource === input.knownSource &&
								attestation.supportingEvidence === input.supportingEvidence &&
								attestation.unknownHistoryDetails ===
									input.unknownHistoryDetails &&
								attestation.userRelationship === input.userRelationship
						)
				);
			},
			() => createVersionMutation.mutateAsync(input)
		);
	}

	async function recordReview(
		versionId: string,
		decision: "approved" | "rejected" | "candidate"
	) {
		if (!record) {
			return;
		}
		const rationale = reviewForm.state.values.rationale.trim() || null;
		const signature = JSON.stringify({ versionId, decision, rationale });
		if (reviewRequest.current?.signature !== signature) {
			reviewRequest.current = { id: crypto.randomUUID(), signature };
		}
		const request = reviewRequest.current;
		await runWrite(
			decision === "approved"
				? "Approved Version saved."
				: "Review Record added.",
			(refreshed) =>
				refreshed.tracking.reviewEvents.some(
					(event) => event.id === request.id
				),
			() =>
				recordReviewMutation.mutateAsync({
					assetRecordId: record.id,
					decision,
					id: request.id,
					projectId: record.projectId,
					rationale,
					versionId,
				})
		);
	}

	async function createFamily({
		familyName,
		familyUseContext,
		visualWorldId,
	}: AssetFamilyValues) {
		if (!(record && tracking.approvedVersion && visualWorldId)) {
			return;
		}
		const signature = JSON.stringify({
			assetRecordId: record.id,
			canonicalVersionId: tracking.approvedVersion.id,
			name: familyName.trim(),
			useContext: familyUseContext.trim(),
			visualWorldId,
		});
		if (familyRequest.current?.signature !== signature) {
			familyRequest.current = { id: crypto.randomUUID(), signature };
		}
		const request = familyRequest.current;
		await runWrite(
			"Asset Family saved.",
			(refreshed) => refreshed.tracking.family?.id === request.id,
			() =>
				createFamilyMutation.mutateAsync({
					assetRecordId: record.id,
					canonicalVersionId: tracking.approvedVersion?.id as string,
					id: request.id,
					name: familyName.trim(),
					projectId: record.projectId,
					useContext: familyUseContext.trim(),
					visualWorldId,
				})
		);
	}

	async function createDerivative({
		dependencyFacets: selectedDependencyFacets,
		derivativeAssetRecordId,
	}: DerivativeLinkValues) {
		const { family } = tracking;
		const canonicalVersionId = family?.canonicalVersionId;
		if (
			!(record && family && canonicalVersionId) ||
			selectedDependencyFacets.length === 0
		) {
			return;
		}
		const signature = JSON.stringify({
			canonicalVersionId,
			dependencyFacets: selectedDependencyFacets,
			derivedAssetRecordId: derivativeAssetRecordId,
			sourceAssetRecordId: record.id,
		});
		if (derivativeRequest.current?.signature !== signature) {
			derivativeRequest.current = { id: crypto.randomUUID(), signature };
		}
		const request = derivativeRequest.current;
		await runWrite(
			"Derived Asset link saved.",
			(refreshed) =>
				refreshed.tracking.derivatives.some((entry) => entry.id === request.id),
			() =>
				createDerivativeMutation.mutateAsync({
					canonicalVersionId,
					dependencyFacets: selectedDependencyFacets,
					derivedAssetRecordId: derivativeAssetRecordId,
					id: request.id,
					projectId: record.projectId,
					sourceAssetRecordId: record.id,
				})
		);
	}

	const reviewDispositionLabel = {
		candidate: "Candidate",
		approved: "Approved",
		rejected: "Reddedildi",
	} as const;

	function reviewActions(version: AssetVersionSummary) {
		const manualEvidenceIncomplete =
			version.productionEvidence.sourceKind === "manual_import" &&
			version.productionEvidence.evidenceLevel === "incomplete";
		const hasManualImportEvidence = tracking.manualImportEvidence?.some(
			(evidence) => evidence.assetVersionId === version.id
		);
		const manualImportEvidenceMissing =
			tracking.manualImportEvidenceRequiredVersionIds.includes(version.id) &&
			!hasManualImportEvidence;
		const managedSnapshotIncomplete =
			version.productionEvidence.sourceKind === "external_working_file_edit" &&
			version.productionEvidence.evidenceLevel === "incomplete";
		const approvalEvidenceMissing =
			manualEvidenceIncomplete ||
			manualImportEvidenceMissing ||
			managedSnapshotIncomplete;
		const decisions = [
			{ decision: "approved", label: "Approve" },
			{ decision: "rejected", label: "Reddet" },
			{ decision: "candidate", label: "Make candidate" },
		] as const;
		return (
			<div className="space-y-2">
				<div className="flex flex-wrap gap-2">
					{decisions.map(({ decision, label }) => (
						<Button
							disabled={
								activeWrite !== null ||
								writeOutcomeUncertain ||
								version.reviewDisposition === decision ||
								(decision === "approved" && approvalEvidenceMissing)
							}
							key={decision}
							onClick={() => void recordReview(version.id, decision)}
							size="sm"
							type="button"
							variant={decision === "approved" ? "default" : "outline"}
						>
							{label}
						</Button>
					))}
				</div>
				{manualEvidenceIncomplete || manualImportEvidenceMissing ? (
					<p className="text-muted-foreground text-xs" role="status">
						Manual Import Evidence is required for approval.
					</p>
				) : null}
				{managedSnapshotIncomplete ? (
					<p className="text-muted-foreground text-xs" role="status">
						Save a Managed Snapshot of the working file before approval.
					</p>
				) : null}
			</div>
		);
	}

	return (
		<section aria-labelledby="record-tracking-heading" className="space-y-4">
			<div>
				<h2 className="font-semibold text-xl" id="record-tracking-heading">
					Record tracking
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Approval, quality, and production evidence are separate records.
					Approval alone does not establish Export Ready status.
				</p>
			</div>
			{statusMessage ? (
				<p aria-live="polite" role="status">
					{statusMessage}
				</p>
			) : null}
			{matchingVersion ? (
				<div
					aria-label={`Requested version: ${getVersionLabel(matchingVersion)}.`}
					className="space-y-1 rounded-lg border border-primary p-4"
					ref={matchingVersionRef}
					role="status"
					tabIndex={-1}
				>
					<p className="font-medium">Requested version</p>
					<p className="text-sm">{getVersionLabel(matchingVersion)}</p>
					<a
						className="text-sm underline underline-offset-4"
						href="#production-history-heading"
					>
						Go to production history
					</a>
				</div>
			) : null}
			{writeOutcomeUncertain ? (
				<Button
					disabled={activeWrite !== null}
					onClick={() => void checkWriteOutcome()}
					type="button"
					variant="outline"
				>
					{activeWrite ?? "Check status"}
				</Button>
			) : null}

			<div className="grid gap-3 sm:grid-cols-2">
				<section
					aria-labelledby="approved-version-heading"
					className="rounded-lg border p-4"
				>
					<h3 className="font-medium" id="approved-version-heading">
						Approved version
					</h3>
					{tracking.approvedVersion ? (
						<div className="mt-2 space-y-2 text-sm">
							<p>
								{displayFileName(tracking.approvedVersion.fileName)} · Version{" "}
								{tracking.approvedVersion.versionNumber}
							</p>
							<VersionProductionEvidencePanel
								assetRecordId={record.id}
								evidence={tracking.approvedVersion.productionEvidence}
								onRefresh={onRefresh}
								projectId={record.projectId}
								reviewDisposition={tracking.approvedVersion.reviewDisposition}
								versionId={tracking.approvedVersion.id}
							/>
							{reviewActions(tracking.approvedVersion)}
						</div>
					) : (
						<p className="mt-2 text-muted-foreground text-sm">
							No approved version yet.
						</p>
					)}
				</section>

				<section
					aria-labelledby="alternatives-heading"
					className="rounded-lg border p-4"
				>
					<h3 className="font-medium" id="alternatives-heading">
						Alternatifler
					</h3>
					{tracking.alternatives.length > 0 ? (
						<ul className="mt-2 space-y-3 text-sm">
							{tracking.alternatives.map((version) => (
								<li className="space-y-1" key={version.id}>
									<p>
										{displayFileName(version.fileName)} · Version{" "}
										{version.versionNumber} ·{" "}
										{reviewDispositionLabel[version.reviewDisposition]}
									</p>
									<VersionProductionEvidencePanel
										assetRecordId={record.id}
										evidence={version.productionEvidence}
										onRefresh={onRefresh}
										projectId={record.projectId}
										reviewDisposition={version.reviewDisposition}
										versionId={version.id}
									/>
									{reviewActions(version)}
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-muted-foreground text-sm">
							No alternative versions yet.
						</p>
					)}
					<Label
						className="mt-3 block space-y-1 text-sm leading-normal"
						htmlFor="review-rationale"
					>
						<span>Review rationale (optional)</span>
						<reviewForm.Field name="rationale">
							{(field) => (
								<Textarea
									className="w-full"
									id="review-rationale"
									maxLength={1000}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
							)}
						</reviewForm.Field>
					</Label>
					{tracking.reviewEvents.length > 0 ? (
						<div className="mt-4 border-t pt-3">
							<h4 className="font-medium text-sm">Review history</h4>
							<ul className="mt-2 space-y-2 text-xs">
								{tracking.reviewEvents.map((event) => {
									const version = [
										tracking.approvedVersion,
										...tracking.alternatives,
									].find((entry) => entry?.id === event.versionId);
									return (
										<li key={event.id}>
											<p>
												{version?.fileName ?? "Version"} ·{" "}
												{reviewDispositionLabel[event.decision]} ·{" "}
												{new Date(event.createdAt).toLocaleString()}
											</p>
											{event.rationale ? (
												<p className="text-muted-foreground">
													{event.rationale}
												</p>
											) : null}
										</li>
									);
								})}
							</ul>
						</div>
					) : null}
				</section>

				<FamilyAndDerivativeSection
					busy={activeWrite !== null || writeOutcomeUncertain}
					derivativeForm={derivativeForm}
					detail={detail}
					familyForm={familyForm}
				/>

				<section
					aria-labelledby="quality-heading"
					className="rounded-lg border p-4"
				>
					<h3 className="font-medium" id="quality-heading">
						Kalite
					</h3>
					<p className="mt-2 text-sm">
						{tracking.quality.integrityStatus === "format_signature_matched"
							? `File format signature matched (${tracking.quality.verifiedVersionCount} version).`
							: "No file integrity evidence."}
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						General Asset Support · No specialized profile quality evidence.
						This format check does not establish Export Ready status.
					</p>
				</section>

				<section
					aria-labelledby="production-history-heading"
					className="rounded-lg border p-4"
				>
					<h3 className="font-medium" id="production-history-heading">
						Production history
					</h3>
					{tracking.productionHistory.length > 0 ? (
						<ul className="mt-2 space-y-2 text-sm">
							{tracking.productionHistory.map((entry) => (
								<li key={entry.id}>
									<p>
										Version {entry.versionNumber} ·{" "}
										{entry.knownSource ?? "Source unknown"}
									</p>
									<p className="text-muted-foreground">
										History unknown ·{" "}
										{userRelationshipLabels[entry.userRelationship]}
									</p>
									{entry.unknownHistoryDetails ? (
										<p>
											Unknown production history: {entry.unknownHistoryDetails}
										</p>
									) : (
										<p className="text-muted-foreground">
											This record does not specify which production information
											is unknown.
										</p>
									)}
									<p className="text-muted-foreground">
										Beyan tarihi:{" "}
										<time dateTime={entry.createdAt}>
											{new Intl.DateTimeFormat("tr-TR", {
												dateStyle: "medium",
												timeStyle: "short",
											}).format(new Date(entry.createdAt))}
										</time>
									</p>
									{entry.supportingEvidence ? (
										<p>Supporting evidence: {entry.supportingEvidence}</p>
									) : null}
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-muted-foreground text-sm">
							No production history yet.
						</p>
					)}
					<div className="mt-4 border-t pt-3">
						<h4 className="font-medium text-sm">Manual Import Evidence</h4>
						{tracking.manualImportEvidence?.length ? (
							<ul className="mt-2 space-y-3 text-sm">
								{tracking.manualImportEvidence.map((entry) => (
									<li className="space-y-1" key={entry.id}>
										<p>
											{entry.fileName} · Version {entry.versionNumber} ·{" "}
											{entry.sourceSurface}
										</p>
										<p className="text-muted-foreground text-xs">
											Generation Package {entry.generationPackageId} · SHA-256{" "}
											{entry.sha256}
										</p>
										<details>
											<summary className="cursor-pointer text-xs underline underline-offset-4">
												View actual production instruction
											</summary>
											<p className="mt-2 whitespace-pre-wrap text-sm">
												{entry.generationInstruction}
											</p>
										</details>
									</li>
								))}
							</ul>
						) : (
							<p className="mt-2 text-muted-foreground text-sm">
								No Manual Import Evidence yet.
							</p>
						)}
					</div>
				</section>
			</div>

			<LiveFileLinkPanel
				assetRecordId={record.id}
				disabled={versionWrites.writesDisabled}
				hasAssetFamily={tracking.family !== null}
				onCheckWriteOutcome={() => void versionWrites.checkWriteOutcome()}
				onImport={(candidateFile, sourceFile) =>
					versionWrites.upload(record.id, candidateFile, {
						managedSnapshot: sourceFile,
						sourceKind: "external_working_file_edit",
					})
				}
				projectId={record.projectId}
				writeOutcomeUncertain={versionWrites.writeOutcomeUncertain}
			/>

			<section
				aria-labelledby="asset-version-create-heading"
				className="rounded-lg border p-4"
			>
				<h3 className="font-medium" id="asset-version-create-heading">
					Create Candidate Version
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					The file is stored in R2 as an immutable Asset Version. This flow
					records legacy asset declarations; it does not infer unknown
					production history.
				</p>
				<CandidateVersionForm
					busy={activeWrite !== null || writeOutcomeUncertain}
					form={candidateVersionForm}
					saving={activeWrite === "Candidate Version saved."}
				/>
			</section>
		</section>
	);
}
