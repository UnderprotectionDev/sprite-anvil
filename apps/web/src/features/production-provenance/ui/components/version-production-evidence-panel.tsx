import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type { VersionProductionEvidence } from "@sprite-anvil/api/production-provenance";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import {
	type DragEvent,
	type ClipboardEvent as ReactClipboardEvent,
	type SyntheticEvent,
	useId,
	useRef,
	useState,
} from "react";
import { ENV } from "@/env";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";
const maxSnapshotBytes = 100 * 1024 * 1024;

const sourceKindLabels: Record<
	VersionProductionEvidence["sourceKind"],
	string
> = {
	manual_import: "Elle içe aktarım",
	external_working_file_edit: "Harici çalışma dosyası düzenlemesi",
	legacy_asset: "Geçmiş varlık",
	unknown: "Bilinmiyor",
};

const evidenceLevelLabels: Record<
	VersionProductionEvidence["evidenceLevel"],
	string
> = {
	complete: "Tamam",
	incomplete: "Eksik",
	unknown: "Bilinmiyor",
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
		return "Kanıt kaydediliyor…";
	}
	return hasEvidence ? "Kanıtı güncelle" : "Elle içe aktarma kanıtını kaydet";
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
	const [generationPackageId, setGenerationPackageId] = useState(
		evidence.manualImportEvidence?.generationPackageId ?? ""
	);
	const [sourceSurface, setSourceSurface] = useState(
		evidence.manualImportEvidence?.sourceSurface ?? ""
	);
	const [actualInstruction, setActualInstruction] = useState(
		evidence.manualImportEvidence?.actualInstruction ?? ""
	);
	const noGenerationPackages =
		!(packagesLoading || packagesLoadError) && generationPackages.length === 0;

	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		onSave({ actualInstruction, generationPackageId, sourceSurface });
	}

	return (
		<div className="space-y-3">
			{evidence.manualImportEvidence ? (
				<div className="space-y-1 text-sm">
					<p>
						Üretim Paketi: {evidence.manualImportEvidence.generationPackageId}
					</p>
					<p>Kaynak yüzeyi: {evidence.manualImportEvidence.sourceSurface}</p>
					<p className="whitespace-pre-wrap">
						Gerçek talimat: {evidence.manualImportEvidence.actualInstruction}
					</p>
					<p className="text-muted-foreground text-xs">
						Kanıt revizyonu {evidence.manualImportEvidence.revision} ·{" "}
						{new Date(evidence.manualImportEvidence.recordedAt).toLocaleString(
							"tr-TR"
						)}
					</p>
				</div>
			) : null}
			{reviewDisposition === "candidate" ? (
				<form className="space-y-3 border-t pt-3" onSubmit={submit}>
					<label className="block space-y-1 text-sm">
						<span>Üretim Paketi</span>
						<select
							className="w-full rounded-md border bg-background px-3 py-2"
							onChange={(event) =>
								setGenerationPackageId(event.currentTarget.value)
							}
							required
							value={generationPackageId}
						>
							<option value="">Üretim Paketi seçin</option>
							{generationPackages.map((generationPackage) => (
								<option key={generationPackage.id} value={generationPackage.id}>
									{new Date(generationPackage.createdAt).toLocaleString(
										"tr-TR"
									)}{" "}
									· {generationPackage.id}
								</option>
							))}
						</select>
						{packagesLoadError ? (
							<span role="alert">Üretim Paketleri yüklenemedi.</span>
						) : null}
						{noGenerationPackages ? (
							<span className="text-muted-foreground">
								Önce bu Varlık Kaydı için Üretim Paketi oluşturun.
							</span>
						) : null}
					</label>
					<label className="block space-y-1 text-sm">
						<span>Kaynak yüzeyi</span>
						<input
							className="w-full rounded-md border bg-background px-3 py-2"
							maxLength={120}
							onChange={(event) => setSourceSurface(event.currentTarget.value)}
							required
							value={sourceSurface}
						/>
					</label>
					<label className="block space-y-1 text-sm">
						<span>Gerçek üretim talimatı</span>
						<textarea
							className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
							maxLength={20_000}
							onChange={(event) =>
								setActualInstruction(event.currentTarget.value)
							}
							required
							value={actualInstruction}
						/>
					</label>
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
					Eksik Elle İçe Aktarma Kanıtı, Sürüm Aday durumuna alınana kadar
					tamamlanamaz.
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
	function fileFromDrop(event: DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		const file = event.dataTransfer.files.item(0);
		if (file) {
			onUpload(file);
		}
	}

	function fileFromPaste(event: ReactClipboardEvent<HTMLButtonElement>) {
		const file = event.clipboardData.files.item(0);
		if (file) {
			event.preventDefault();
			onUpload(file);
		}
	}

	return (
		<div className="space-y-2 border-t pt-3">
			<p className="font-medium text-sm">Yönetilen çalışma dosyası</p>
			<p className="text-muted-foreground text-xs">
				Dosyayı seçin, buraya sürükleyin veya bu alana odaklanıp dosya olarak
				yapıştırın. Yönetilen kopya taşınabilir kaynak kanıtıdır; tek başına
				onay oluşturmaz.
			</p>
			<button
				aria-describedby={dropHintId}
				aria-label="Çalışma dosyası seç, sürükle veya yapıştır"
				className="flex min-h-14 w-full flex-col items-start justify-center gap-2 rounded-md border border-dashed p-3 text-left text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
				disabled={active}
				onClick={() => fileInputRef.current?.click()}
				onDragOver={(event) => event.preventDefault()}
				onDrop={fileFromDrop}
				onPaste={fileFromPaste}
				type="button"
			>
				<span>{active ? "Dosya yükleniyor…" : "Çalışma dosyası seç"}</span>
			</button>
			<p className="sr-only" id={dropHintId}>
				Dosyayı da sürükleyip bırakabilir veya panodan yapıştırabilirsiniz.
			</p>
			<input
				accept="*/*"
				aria-label="Yönetilen çalışma dosyası"
				className="sr-only"
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
							<p>Dosya boyutu: {formatBytes(snapshot.byteSize)}</p>
							<p className="break-all text-muted-foreground text-xs">
								SHA-256: {snapshot.sha256}
							</p>
							<Button
								disabled={active}
								onClick={() => onDownload(snapshot)}
								size="sm"
								type="button"
								variant="outline"
							>
								Çalışma dosyasını indir
							</Button>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground text-sm">
					Henüz yönetilen çalışma dosyası yok.
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
			setErrorMessage("Kayıt alındı ancak sürüm listesi yenilenemedi.");
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
			await client.assetVersions.saveManualImportEvidence({
				...input,
				assetRecordId,
				projectId,
				versionId,
			});
			await refreshAfterSave("Elle İçe Aktarma Kanıtı kaydedildi.");
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Elle İçe Aktarma Kanıtı kaydedilemedi.")
			);
		} finally {
			setActiveAction(null);
		}
	}

	async function uploadSnapshot(file: File) {
		if (activeAction) {
			return;
		}
		if (file.size === 0 || file.size > maxSnapshotBytes) {
			setErrorMessage("Çalışma dosyası boş olamaz ve 100 MB sınırını aşamaz.");
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
						: "Çalışma dosyası saklanamadı.";
				throw new Error(message);
			}
			pendingSnapshotRef.current = null;
			await refreshAfterSave(
				"Çalışma dosyasının yönetilen kopyası kaydedildi."
			);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(
					error,
					"Çalışma dosyası yüklenemedi. Aynı dosyayı yeniden deneyebilirsiniz."
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
				throw new Error("Yönetilen çalışma dosyası indirilemedi.");
			}
			const objectUrl = URL.createObjectURL(await response.blob());
			const link = document.createElement("a");
			link.href = objectUrl;
			link.download = snapshot.fileName;
			link.click();
			setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Yönetilen çalışma dosyası indirilemedi.")
			);
		} finally {
			setActiveAction(null);
		}
	}

	return (
		<section
			aria-label="Üretim kaynağı ve kanıt"
			className="space-y-3 rounded-md bg-muted/40 p-3"
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
				<h4 className="font-medium">Üretim kaynağı ve kanıt</h4>
				<span>Kaynak: {sourceKindLabels[evidence.sourceKind]}</span>
				<span aria-live="polite">
					Üretim kanıtı düzeyi: {evidenceLevelLabels[evidence.evidenceLevel]}
				</span>
			</div>
			{evidence.sourceKind === "legacy_asset" ? (
				<p className="text-muted-foreground text-sm">
					Özgün üretim geçmişi bilinmiyor; sonradan tahmin edilmeyecek.
				</p>
			) : null}
			{evidence.sourceKind === "external_working_file_edit" &&
			evidence.evidenceLevel === "incomplete" ? (
				<p className="text-sm" role="status">
					Onaydan önce düzenlenebilir çalışma dosyasının Yönetilen Kopyasını
					kaydedin.
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
				<p aria-live="assertive" role="alert">
					{errorMessage}
				</p>
			) : null}
		</section>
	);
}
