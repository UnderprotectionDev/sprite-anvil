import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type { VersionProductionEvidence } from "@sprite-anvil/api/production-provenance";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
	DragEvent,
	ClipboardEvent as ReactClipboardEvent,
	SyntheticEvent,
} from "react";
import { useId, useRef, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { ENV } from "@/env";
import {
	managedSnapshotFileSchema,
	manualImportEvidenceFormSchema,
} from "@/features/production-provenance/schemas";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/u, "") ?? "";

const sourceKindLabels: Record<
	VersionProductionEvidence["sourceKind"],
	string
> = {
	manual_import: "Manual import",
	external_working_file_edit: "External working file edit",
	derived: "Derived version",
	legacy_asset: "Legacy asset",
	unknown: "Unknown",
};

const evidenceLevelLabels: Record<
	VersionProductionEvidence["evidenceLevel"],
	string
> = {
	complete: "Complete",
	incomplete: "Incomplete",
	unknown: "Unknown",
};

function formatBytes(byteSize: number) {
	if (byteSize < 1024) {
		return `${byteSize} B`;
	}
	if (byteSize < 1024 * 1024) {
		return `${(byteSize / 1024).toFixed(1)} KB`;
	}
	return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

function evidenceSaveLabel(saving: boolean, hasEvidence: boolean) {
	if (saving) {
		return "Saving evidence…";
	}
	return hasEvidence ? "Update evidence" : "Save Manual Import Evidence";
}

interface ManualImportEvidenceSectionProps {
	evidence: VersionProductionEvidence;
	generationPackages: GenerationPackage[];
	onSave: (input: {
		actualInstruction: string;
		generationPackageId: string;
		sourceSurface: string;
	}) => void;
	packagesLoadError: boolean;
	packagesLoading: boolean;
	reviewDisposition: "candidate" | "approved" | "rejected";
	saving: boolean;
}

function ManualImportEvidenceSection({
	evidence,
	generationPackages,
	packagesLoadError,
	packagesLoading,
	reviewDisposition,
	saving,
	onSave,
}: ManualImportEvidenceSectionProps) {
	const form = useForm({
		defaultValues: {
			actualInstruction: evidence.manualImportEvidence?.actualInstruction ?? "",
			generationPackageId:
				evidence.manualImportEvidence?.generationPackageId ?? "",
			sourceSurface: evidence.manualImportEvidence?.sourceSurface ?? "",
		},
		onSubmit: ({ value }) => {
			onSave(value);
		},
		validators: { onSubmit: manualImportEvidenceFormSchema },
	});
	const noGenerationPackages =
		!(packagesLoading || packagesLoadError) && generationPackages.length === 0;

	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		event.stopPropagation();
		void form.handleSubmit();
	}

	return (
		<div className="space-y-3">
			{evidence.manualImportEvidence ? (
				<div className="space-y-1 text-sm">
					<p>
						Generation Package:{" "}
						{evidence.manualImportEvidence.generationPackageId}
					</p>
					<p>Source surface: {evidence.manualImportEvidence.sourceSurface}</p>
					<p className="whitespace-pre-wrap">
						Actual instruction:{" "}
						{evidence.manualImportEvidence.actualInstruction}
					</p>
					<p className="text-muted-foreground text-xs">
						Evidence revision {evidence.manualImportEvidence.revision} ·{" "}
						{new Date(evidence.manualImportEvidence.recordedAt).toLocaleString(
							"tr-TR"
						)}
					</p>
				</div>
			) : null}
			{reviewDisposition === "candidate" ? (
				<form className="space-y-3 border-t pt-3" onSubmit={submit}>
					<form.Field name="generationPackageId">
						{(field) => (
							<Label className="block space-y-1 text-sm">
								<span>Generation Package</span>
								<NativeSelect
									className="w-full"
									onChange={(event) =>
										field.handleChange(event.currentTarget.value)
									}
									required
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Select a Generation Package
									</NativeSelectOption>
									{generationPackages.map((generationPackage) => (
										<NativeSelectOption
											key={generationPackage.id}
											value={generationPackage.id}
										>
											{new Date(generationPackage.createdAt).toLocaleString(
												"tr-TR"
											)}{" "}
											· {generationPackage.id}
										</NativeSelectOption>
									))}
								</NativeSelect>
								{packagesLoadError ? (
									<StatusMessage tone="error">
										Could not load Generation Packages.
									</StatusMessage>
								) : null}
								{noGenerationPackages ? (
									<span className="text-muted-foreground">
										Create a Generation Package for this Asset Record first.
									</span>
								) : null}
							</Label>
						)}
					</form.Field>
					<form.Field name="sourceSurface">
						{(field) => (
							<Label className="block space-y-1 text-sm">
								<span>Source surface</span>
								<Input
									className="w-full"
									maxLength={120}
									onChange={(event) =>
										field.handleChange(event.currentTarget.value)
									}
									required
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
					<form.Field name="actualInstruction">
						{(field) => (
							<Label className="block space-y-1 text-sm">
								<span>Actual production instruction</span>
								<Textarea
									className="min-h-20 w-full"
									maxLength={20_000}
									onChange={(event) =>
										field.handleChange(event.currentTarget.value)
									}
									required
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
					<Button
						disabled={
							saving ||
							packagesLoading ||
							packagesLoadError ||
							noGenerationPackages
						}
						type="submit"
					>
						{evidenceSaveLabel(saving, Boolean(evidence.manualImportEvidence))}
					</Button>
				</form>
			) : null}
			{reviewDisposition !== "candidate" &&
			evidence.evidenceLevel === "incomplete" ? (
				<p className="text-sm" role="status">
					Missing Manual Import Evidence cannot be completed until the Version
					returns to Candidate status.
				</p>
			) : null}
		</div>
	);
}

interface ManagedSnapshotAttachmentsProps {
	active: boolean;
	onDownload: (
		snapshot: VersionProductionEvidence["managedSnapshots"][number]
	) => void;
	onUpload: (file: File) => void;
	snapshots: VersionProductionEvidence["managedSnapshots"];
}

function ManagedSnapshotAttachments({
	active,
	snapshots,
	onDownload,
	onUpload,
}: ManagedSnapshotAttachmentsProps) {
	const dropHintId = useId();
	const fileInputRef = useRef<HTMLInputElement>(null);
	function fileFromDrop(event: DragEvent<HTMLElement>) {
		event.preventDefault();
		const file = event.dataTransfer.files.item(0);
		if (file) {
			onUpload(file);
		}
	}

	function fileFromPaste(event: ReactClipboardEvent<HTMLElement>) {
		const file = event.clipboardData.files.item(0);
		if (file) {
			event.preventDefault();
			onUpload(file);
		}
	}

	return (
		<div className="space-y-2 border-t pt-3">
			<p className="text-sm font-medium">Managed working file</p>
			<p className="text-muted-foreground text-xs">
				Select or drop a file here, or focus this area and paste a file. The
				Managed Snapshot is portable source evidence; it does not grant approval
				by itself.
			</p>
			<Button
				aria-describedby={dropHintId}
				aria-label="Select, drop, or paste working file"
				className="flex h-auto min-h-14 w-full flex-col items-start justify-center gap-2 border-dashed p-3 text-left text-sm font-normal"
				disabled={active}
				onClick={() => fileInputRef.current?.click()}
				onDragOver={(event) => event.preventDefault()}
				onDrop={fileFromDrop}
				onPaste={fileFromPaste}
				type="button"
				variant="outline"
			>
				<span>{active ? "Uploading file…" : "Select working file"}</span>
			</Button>
			<p className="sr-only" id={dropHintId}>
				You can also drop the file or paste it from the clipboard.
			</p>
			<Input
				accept="*/*"
				aria-label="Managed working file"
				className="sr-only h-px w-px border-0 p-0"
				disabled={active}
				onChange={(event) => {
					const file = event.currentTarget.files?.[0];
					event.currentTarget.value = "";
					if (file) {
						onUpload(file);
					}
				}}
				ref={fileInputRef}
				type="file"
			/>
			{snapshots.length > 0 ? (
				<ul className="space-y-2 text-sm">
					{snapshots.map((snapshot) => (
						<li className="rounded-md border p-2" key={snapshot.id}>
							<p className="font-medium">{snapshot.fileName}</p>
							<p>File size: {formatBytes(snapshot.byteSize)}</p>
							<p className="text-muted-foreground text-xs break-all">
								SHA-256: {snapshot.sha256}
							</p>
							<Button
								disabled={active}
								onClick={() => onDownload(snapshot)}
								size="sm"
								type="button"
								variant="outline"
							>
								Download working file
							</Button>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">
					No managed working file yet.
				</p>
			)}
		</div>
	);
}

interface VersionProductionEvidencePanelProps {
	assetRecordId: string;
	evidence: VersionProductionEvidence;
	onRefresh: () => Promise<unknown>;
	projectId: string;
	reviewDisposition: "candidate" | "approved" | "rejected";
	versionId: string;
}

export function VersionProductionEvidencePanel({
	assetRecordId,
	evidence,
	onRefresh,
	projectId,
	reviewDisposition,
	versionId,
}: VersionProductionEvidencePanelProps) {
	const pendingSnapshotRef = useRef<{
		fingerprint: string;
		idempotencyKey: string;
	} | null>(null);
	const saveEvidenceMutation = useMutation(
		orpc.assetVersions.saveManualImportEvidence.mutationOptions(mutationMeta)
	);
	const [activeAction, setActiveAction] = useState<
		"evidence" | "snapshot" | null
	>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const packagesQuery = useQuery({
		...orpc.generationPackages.list.queryOptions({
			input: { assetRecordId, projectId },
		}),
		enabled: evidence.sourceKind === "manual_import",
	});
	const generationPackages = packagesQuery.data ?? [];

	async function refreshAfterSave(message: string) {
		const result = await onRefresh();
		if (
			result &&
			typeof result === "object" &&
			"isError" in result &&
			result.isError
		) {
			setErrorMessage(
				"The record was saved, but the version list could not be refreshed."
			);
			return;
		}
		setStatusMessage(message);
	}

	async function saveManualImportEvidence(input: {
		actualInstruction: string;
		generationPackageId: string;
		sourceSurface: string;
	}) {
		if (activeAction || reviewDisposition !== "candidate") {
			return;
		}
		setActiveAction("evidence");
		setErrorMessage(null);
		setStatusMessage(null);
		try {
			await saveEvidenceMutation.mutateAsync({
				...input,
				assetRecordId,
				projectId,
				versionId,
			});
			await refreshAfterSave("Manual Import Evidence saved.");
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Could not save Manual Import Evidence.")
			);
		} finally {
			setActiveAction(null);
		}
	}

	async function uploadSnapshot(file: File) {
		if (activeAction) {
			return;
		}
		const selectionError = managedSnapshotFileSchema.safeParse(file).error;
		if (selectionError) {
			setErrorMessage(selectionError.issues[0]?.message ?? null);
			return;
		}
		const fingerprint = [
			file.name,
			file.size.toString(),
			file.lastModified.toString(),
		].join("\u0000");
		const pending = pendingSnapshotRef.current;
		const idempotencyKey =
			pending?.fingerprint === fingerprint
				? pending.idempotencyKey
				: crypto.randomUUID();
		pendingSnapshotRef.current = { fingerprint, idempotencyKey };
		setActiveAction("snapshot");
		setErrorMessage(null);
		setStatusMessage(null);
		try {
			// conventions-exception: raw-fetch Managed Snapshot files stream as raw bytes to and from the verifying Hono snapshot routes; the RPC link sends buffered JSON or multipart.
			const response = await fetch(
				`${serverUrl}/api/projects/${encodeURIComponent(projectId)}/asset-versions/${encodeURIComponent(versionId)}/managed-snapshots`,
				{
					method: "POST",
					credentials: "include",
					headers: {
						"Content-Type": "application/octet-stream",
						"X-Managed-Snapshot-Size": file.size.toString(),
						"X-Managed-Snapshot-File-Name": encodeURIComponent(file.name),
						"Idempotency-Key": idempotencyKey,
					},
					body: file,
				}
			);
			const responseBody: unknown = await response.json();
			if (!response.ok) {
				const message =
					responseBody &&
					typeof responseBody === "object" &&
					"error" in responseBody
						? String(responseBody.error)
						: "Could not store the working file.";
				throw new Error(message);
			}
			pendingSnapshotRef.current = null;
			await refreshAfterSave("Managed Snapshot of the working file saved.");
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Could not upload the working file. You can retry with the same file."
				)
			);
		} finally {
			setActiveAction(null);
		}
	}

	async function downloadSnapshot(
		snapshot: VersionProductionEvidence["managedSnapshots"][number]
	) {
		setActiveAction("snapshot");
		setErrorMessage(null);
		try {
			const response = await fetch(`${serverUrl}${snapshot.downloadUrl}`, {
				credentials: "include",
			});
			if (!response.ok) {
				throw new Error("Could not download the managed working file.");
			}
			const objectUrl = URL.createObjectURL(await response.blob());
			const link = document.createElement("a");
			link.href = objectUrl;
			link.download = snapshot.fileName;
			link.click();
			setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Could not download the managed working file.")
			);
		} finally {
			setActiveAction(null);
		}
	}

	return (
		<section
			aria-label="Production source and evidence"
			className="bg-muted/40 space-y-3 rounded-md p-3"
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
				<h4 className="font-medium">Production source and evidence</h4>
				<span>Source: {sourceKindLabels[evidence.sourceKind]}</span>
				<span aria-live="polite">
					Production evidence level:{" "}
					{evidenceLevelLabels[evidence.evidenceLevel]}
				</span>
			</div>
			{evidence.sourceKind === "legacy_asset" ? (
				<p className="text-muted-foreground text-sm">
					Original production history is unknown and will not be inferred later.
				</p>
			) : null}
			{evidence.sourceKind === "external_working_file_edit" &&
			evidence.evidenceLevel === "incomplete" ? (
				<p className="text-sm" role="status">
					Save a Managed Snapshot of the editable working file before approval.
				</p>
			) : null}
			{evidence.sourceKind === "manual_import" ? (
				<ManualImportEvidenceSection
					evidence={evidence}
					generationPackages={generationPackages}
					onSave={(input) => void saveManualImportEvidence(input)}
					packagesLoadError={packagesQuery.isError}
					packagesLoading={packagesQuery.isPending}
					reviewDisposition={reviewDisposition}
					saving={activeAction === "evidence"}
				/>
			) : null}
			<ManagedSnapshotAttachments
				active={activeAction === "snapshot"}
				onDownload={(snapshot) => void downloadSnapshot(snapshot)}
				onUpload={(file) => void uploadSnapshot(file)}
				snapshots={evidence.managedSnapshots}
			/>
			{statusMessage ? (
				<p aria-live="polite" role="status">
					{statusMessage}
				</p>
			) : null}
			{errorMessage ? (
				<StatusMessage tone="error">{errorMessage}</StatusMessage>
			) : null}
		</section>
	);
}
