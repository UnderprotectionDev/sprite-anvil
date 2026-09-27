import type {
	AssetRecordTrackingDetail,
	ReferenceFeature,
	ReferenceSummary,
} from "@sprite-anvil/api/asset-record-tracking";
import type { ReferenceBoardImage } from "@sprite-anvil/api/reference-production";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import type { ClipboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ENV } from "@/env";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import {
	emptyReferenceConstraintDraft,
	type ReferenceConstraintDraft,
	ReferenceConstraintEditor,
} from "../components/reference-constraint-editor";
import {
	encodeMetadataHeader,
	localizedFeatureList,
	referenceFeatureLabels,
	referenceRoleLabels,
} from "../reference-board-contract";

type Tracking = AssetRecordTrackingDetail["tracking"];
type HistoryEntry = ReferenceBoardImage["history"][number];

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";
const maxUploadBytes = 5 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/png", "image/webp"]);

function toDraft(reference: {
	contextOverrideRationale?: string | null;
	customPurpose?: string | null;
	forbiddenFeatures: ReferenceFeature[];
	notes: string | null;
	role: ReferenceConstraintDraft["role"];
	transferredFeatures: ReferenceFeature[];
}): ReferenceConstraintDraft {
	return {
		contextOverrideRationale: reference.contextOverrideRationale ?? "",
		customPurpose: reference.customPurpose ?? "",
		forbiddenFeatures: [...reference.forbiddenFeatures],
		notes: reference.notes ?? "",
		role: reference.role,
		transferredFeatures: [...reference.transferredFeatures],
	};
}

function normalizedRules(draft: ReferenceConstraintDraft) {
	const transfersIdentity =
		draft.transferredFeatures.includes("identity") &&
		!draft.forbiddenFeatures.includes("identity");
	return {
		contextOverrideRationale: transfersIdentity
			? draft.contextOverrideRationale.trim() || null
			: null,
		customPurpose:
			draft.role === "custom" ? draft.customPurpose.trim() || null : null,
		forbiddenFeatures: draft.forbiddenFeatures,
		notes: draft.notes.trim() || null,
		role: draft.role,
		transferredFeatures: draft.transferredFeatures,
	};
}

function validateDraft(
	draft: ReferenceConstraintDraft,
	hasCanonicalDesign: boolean
) {
	if (
		draft.transferredFeatures.length === 0 &&
		draft.forbiddenFeatures.length === 0
	) {
		return "En az bir özelliği aktarılabilir veya kaçınılacak olarak seçin.";
	}
	if (draft.role === "custom" && !draft.customPurpose.trim()) {
		return "Özel kullanım amacını yazın.";
	}
	if (
		hasCanonicalDesign &&
		draft.transferredFeatures.includes("identity") &&
		!draft.forbiddenFeatures.includes("identity") &&
		!draft.contextOverrideRationale.trim()
	) {
		return "Ana Tasarım kimlik sınırını aşmak için Bağlam Kuralı İstisnası gerekçesi yazın.";
	}
	return null;
}

function imageUrl(
	projectId: string,
	assetRecordId: string,
	referenceId: string
) {
	return `${serverUrl}/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetRecordId)}/references/${encodeURIComponent(referenceId)}/image`;
}

function versionPreviewUrl(projectId: string, versionId: string) {
	return `${serverUrl}/api/projects/${encodeURIComponent(projectId)}/asset-versions/${encodeURIComponent(versionId)}/preview`;
}

function messageFromUploadError(value: unknown) {
	if (value && typeof value === "object" && "error" in value) {
		const message = String(value.error);
		if (message.includes("Context Override")) {
			return "Ana Tasarım kimliğini aşmak için Bağlam Kuralı İstisnası gerekçesi ekleyin.";
		}
		if (message.includes("idempotency conflict")) {
			return "Bu yükleme kimliği farklı bir görsel için kullanılmış. Görseli yeniden seçin.";
		}
	}
	return "Görsel yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.";
}

function purposeLabel(reference: {
	customPurpose?: string | null;
	role: ReferenceConstraintDraft["role"];
}) {
	return reference.role === "custom" && reference.customPurpose
		? reference.customPurpose
		: referenceRoleLabels[reference.role];
}

function ConflictSummary({
	board,
	references,
}: {
	board: {
		conflicts: {
			allowingReferenceIds: string[];
			feature: ReferenceFeature;
			forbiddingReferenceIds: string[];
		}[];
		imageReferences: ReferenceBoardImage[];
	};
	references: ReferenceSummary[];
}) {
	if (board.conflicts.length === 0) {
		return null;
	}
	const names = new Map<string, string>();
	for (const reference of references) {
		names.set(
			reference.id,
			`${reference.assetRecordName} · Sürüm ${reference.versionNumber}`
		);
	}
	for (const reference of board.imageReferences) {
		names.set(reference.id, reference.fileName);
	}
	return (
		<div
			aria-labelledby="reference-conflict-heading"
			className="rounded-md border border-destructive/60 p-3"
			role="alert"
		>
			<h4 className="font-medium" id="reference-conflict-heading">
				Çözülmemiş aktarım çelişkileri
			</h4>
			<ul className="mt-2 list-inside list-disc space-y-2 text-sm">
				{board.conflicts.map((conflict) => (
					<li key={conflict.feature}>
						<strong>{referenceFeatureLabels[conflict.feature]}:</strong>{" "}
						aktarılmasına izin veren{" "}
						{conflict.allowingReferenceIds
							.map((id) => names.get(id) ?? id)
							.join(", ")}
						; yasaklayan{" "}
						{conflict.forbiddingReferenceIds
							.map((id) => names.get(id) ?? id)
							.join(", ")}
						. Ekleme sırası öncelik belirlemez.
					</li>
				))}
			</ul>
		</div>
	);
}

function EffectiveTransferSummary({
	forbiddenFeatures,
	transferredFeatures,
}: {
	forbiddenFeatures: ReferenceFeature[];
	transferredFeatures: ReferenceFeature[];
}) {
	if (forbiddenFeatures.length === 0 && transferredFeatures.length === 0) {
		return null;
	}
	return (
		<div className="rounded-md bg-muted p-3 text-sm">
			<p>
				<strong>Etkin aktarım:</strong>{" "}
				{localizedFeatureList(transferredFeatures) || "yok"}
			</p>
			<p className="mt-1">
				<strong>Etkin yasak:</strong>{" "}
				{localizedFeatureList(forbiddenFeatures) || "yok"}
			</p>
		</div>
	);
}

function ReferenceUploadDropArea({
	file,
	isDragging,
	onChooseFile,
	onDragStateChange,
	onPaste,
	previewUrl,
	setFile,
}: {
	file: File | null;
	isDragging: boolean;
	onChooseFile: (file: File | undefined) => void;
	onDragStateChange: (isDragging: boolean) => void;
	onPaste: (event: ClipboardEvent<HTMLElement>) => void;
	previewUrl: string | null;
	setFile: (file: File | null) => void;
}) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	return (
		<div>
			<button
				aria-label="Referans görseli ekleme alanı"
				className={`w-full rounded-md border border-dashed p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${isDragging ? "border-primary bg-muted" : ""}`}
				onClick={() => fileInputRef.current?.click()}
				onDragEnter={() => onDragStateChange(true)}
				onDragLeave={(event) => {
					if (event.currentTarget === event.target) {
						onDragStateChange(false);
					}
				}}
				onDragOver={(event) => event.preventDefault()}
				onDrop={(event) => {
					event.preventDefault();
					onDragStateChange(false);
					onChooseFile(event.dataTransfer.files[0]);
				}}
				onPaste={onPaste}
				type="button"
			>
				<span className="block font-medium text-sm">Görsel ekle</span>
				<span className="mt-1 block text-muted-foreground text-sm">
					PNG veya WebP dosyasını buraya bırakın ya da bu alan klavyeyle
					odaktayken panodaki görseli yapıştırın. En fazla 5 MB.
				</span>
				<span className="mt-3 inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm">
					Dosya seçin
				</span>
			</button>
			<input
				accept="image/png,image/webp"
				aria-hidden="true"
				className="sr-only"
				id="reference-upload-file"
				onChange={(event) => {
					onChooseFile(event.target.files?.[0]);
					event.target.value = "";
				}}
				ref={fileInputRef}
				tabIndex={-1}
				type="file"
			/>
			{file ? (
				<div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
					{previewUrl ? (
						<img
							alt={`${file.name} yükleme önizlemesi`}
							className="aspect-[4/3] max-h-48 w-full rounded-md border bg-muted object-contain"
							height={192}
							src={previewUrl}
							width={256}
						/>
					) : null}
					<div className="min-w-0">
						<p className="break-words font-medium">{file.name}</p>
						<p className="text-muted-foreground text-sm">
							{Math.ceil(file.size / 1024)} KB · {file.type}
						</p>
						<Button
							className="mt-2"
							onClick={() => setFile(null)}
							type="button"
							variant="outline"
						>
							Seçimi kaldır
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}

function ReferenceCard({
	assetRecordId,
	boardRefresh,
	hasCanonicalDesign,
	image,
	projectId,
}: {
	assetRecordId: string;
	boardRefresh: () => Promise<unknown>;
	hasCanonicalDesign: boolean;
	image: ReferenceBoardImage;
	projectId: string;
}) {
	const [draft, setDraft] = useState(() => toDraft(image));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState<string | null>(null);
	const validationError = validateDraft(draft, hasCanonicalDesign);
	const preview = imageUrl(projectId, assetRecordId, image.id);

	useEffect(() => {
		setDraft(toDraft(image));
	}, [image]);

	async function save() {
		if (validationError) {
			setError(validationError);
			return;
		}
		setSaving(true);
		setError(null);
		setSaved(null);
		try {
			await client.referenceProduction.updateImage({
				assetRecordId,
				expectedRevision: image.revision,
				id: image.id,
				projectId,
				...normalizedRules(draft),
			});
			await boardRefresh();
			setSaved("Referans kuralları ve notu kaydedildi.");
		} catch (caught) {
			setError(getErrorMessage(caught, "Referans değişikliği kaydedilemedi."));
		} finally {
			setSaving(false);
		}
	}

	return (
		<article className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4">
			<img
				alt={`${image.fileName} adlı referans görseli`}
				className="aspect-[4/3] w-full rounded-md border bg-muted object-contain"
				crossOrigin="use-credentials"
				height={300}
				loading="lazy"
				src={preview}
				width={400}
			/>
			<div className="min-w-0">
				<h4 className="break-words font-medium">{image.fileName}</h4>
				<p className="mt-1 break-words text-muted-foreground text-sm">
					{purposeLabel(image)} · Revizyon {image.revision}
				</p>
				<p className="mt-1 text-sm">
					Aktar: {localizedFeatureList(image.transferredFeatures) || "yok"} ·
					Kaçın: {localizedFeatureList(image.forbiddenFeatures) || "yok"}
				</p>
				{image.notes ? (
					<p className="mt-1 whitespace-pre-wrap text-sm">{image.notes}</p>
				) : null}
				{image.conflictFeatures.length > 0 ? (
					<p className="mt-2 text-destructive text-sm">
						Çözülmemiş çelişki: {localizedFeatureList(image.conflictFeatures)}
					</p>
				) : null}
			</div>
			<details className="border-t pt-3">
				<summary className="cursor-pointer font-medium text-sm">
					Kuralları düzenle
				</summary>
				<div className="mt-3 space-y-3">
					<ReferenceConstraintEditor
						draft={draft}
						hasCanonicalDesign={hasCanonicalDesign}
						idPrefix={`edit-reference-${image.id}`}
						onChange={setDraft}
					/>
					{validationError ? (
						<p className="text-destructive text-sm" role="alert">
							{validationError}
						</p>
					) : null}
					{error ? (
						<p className="text-destructive text-sm" role="alert">
							{error}
						</p>
					) : null}
					{saved ? (
						<p className="text-sm" role="status">
							{saved}
						</p>
					) : null}
					<Button disabled={saving} onClick={() => void save()} type="button">
						{saving ? "Kaydediliyor…" : "Kuralları kaydet"}
					</Button>
				</div>
			</details>
			<details className="border-t pt-3">
				<summary className="cursor-pointer font-medium text-sm">
					Kural geçmişi
				</summary>
				<HistoryList history={image.history} />
			</details>
		</article>
	);
}

function AssetVersionReferenceCard({
	assetRecordId,
	boardRefresh,
	hasCanonicalDesign,
	projectId,
	reference,
}: {
	assetRecordId: string;
	boardRefresh: () => Promise<unknown>;
	hasCanonicalDesign: boolean;
	projectId: string;
	reference: ReferenceSummary;
}) {
	const [draft, setDraft] = useState(() => toDraft(reference));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState<string | null>(null);
	const validationError = validateDraft(draft, hasCanonicalDesign);
	const preview = versionPreviewUrl(projectId, reference.versionId);

	useEffect(() => {
		setDraft(toDraft(reference));
	}, [reference]);

	async function save() {
		if (validationError) {
			setError(validationError);
			return;
		}
		setSaving(true);
		setError(null);
		setSaved(null);
		try {
			await client.assetRecords.updateReference({
				assetRecordId,
				expectedRevision: reference.revision ?? 1,
				id: reference.id,
				projectId,
				...normalizedRules(draft),
			});
			await boardRefresh();
			setSaved("Referans kuralları ve notu kaydedildi.");
		} catch (caught) {
			setError(getErrorMessage(caught, "Referans değişikliği kaydedilemedi."));
		} finally {
			setSaving(false);
		}
	}

	return (
		<article
			className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4"
			role="listitem"
		>
			<img
				alt={`${reference.assetRecordName} referans görseli`}
				className="aspect-[4/3] w-full rounded-md border bg-muted object-contain"
				crossOrigin="use-credentials"
				height={300}
				loading="lazy"
				src={preview}
				width={400}
			/>
			<div className="min-w-0">
				<h4 className="break-words font-medium">
					{reference.assetRecordName} · Sürüm {reference.versionNumber}
				</h4>
				<p className="mt-1 break-words text-muted-foreground text-sm">
					{purposeLabel(reference)} · Revizyon {reference.revision ?? 1}
				</p>
				<p className="mt-1 text-sm">
					Aktar: {localizedFeatureList(reference.transferredFeatures) || "yok"}{" "}
					· Kaçın: {localizedFeatureList(reference.forbiddenFeatures) || "yok"}
				</p>
				{reference.notes ? (
					<p className="mt-1 whitespace-pre-wrap text-sm">{reference.notes}</p>
				) : null}
				{reference.contextOverrideRationale ? (
					<p className="mt-1 text-sm">
						Bağlam Kuralı İstisnası: {reference.contextOverrideRationale}
					</p>
				) : null}
				{reference.conflictFeatures.length > 0 ? (
					<p className="mt-2 text-destructive text-sm">
						Çözülmemiş çelişki:{" "}
						{localizedFeatureList(reference.conflictFeatures)}
					</p>
				) : null}
			</div>
			<details className="border-t pt-3">
				<summary className="cursor-pointer font-medium text-sm">
					Kuralları düzenle
				</summary>
				<div className="mt-3 space-y-3">
					<ReferenceConstraintEditor
						draft={draft}
						hasCanonicalDesign={hasCanonicalDesign}
						idPrefix={`edit-version-reference-${reference.id}`}
						onChange={setDraft}
					/>
					{validationError ? (
						<p className="text-destructive text-sm" role="alert">
							{validationError}
						</p>
					) : null}
					{error ? (
						<p className="text-destructive text-sm" role="alert">
							{error}
						</p>
					) : null}
					{saved ? (
						<p className="text-sm" role="status">
							{saved}
						</p>
					) : null}
					<Button disabled={saving} onClick={() => void save()} type="button">
						{saving ? "Kaydediliyor…" : "Kuralları kaydet"}
					</Button>
				</div>
			</details>
			<details className="border-t pt-3">
				<summary className="cursor-pointer font-medium text-sm">
					Kural geçmişi
				</summary>
				<HistoryList history={reference.history ?? []} />
			</details>
		</article>
	);
}

function HistoryList({ history }: { history: readonly HistoryEntry[] }) {
	if (history.length === 0) {
		return (
			<p className="mt-2 text-muted-foreground text-sm">
				Henüz geçmiş kaydı yok.
			</p>
		);
	}
	return (
		<ol className="mt-2 space-y-3 text-sm">
			{[...history].reverse().map((entry) => (
				<li className="border-l-2 pl-3" key={entry.revision}>
					<p className="font-medium">
						Revizyon {entry.revision} ·{" "}
						{new Date(entry.recordedAt).toLocaleString("tr-TR")}
					</p>
					<p>{purposeLabel(entry)}</p>
					<p className="text-muted-foreground">
						Aktar: {localizedFeatureList(entry.transferredFeatures) || "yok"} ·
						Kaçın: {localizedFeatureList(entry.forbiddenFeatures) || "yok"}
					</p>
					{entry.contextOverrideRationale ? (
						<p>Bağlam Kuralı İstisnası: {entry.contextOverrideRationale}</p>
					) : null}
					{entry.notes ? <p>{entry.notes}</p> : null}
				</li>
			))}
		</ol>
	);
}

export function ReferenceBoardView({
	assetRecordId,
	assetRecordName,
	availableVersions,
	hasCanonicalDesign,
	onRefresh,
	projectId,
	references,
}: {
	assetRecordId: string;
	assetRecordName: string;
	availableVersions: Tracking["availableVersions"];
	hasCanonicalDesign: boolean;
	onRefresh: () => Promise<unknown>;
	projectId: string;
	references: Tracking["references"];
}) {
	const input = { assetRecordId, projectId };
	const boardQuery = useQuery({
		...orpc.referenceProduction.list.queryOptions({ input }),
	});
	const [draft, setDraft] = useState(emptyReferenceConstraintDraft);
	const [selectedVersionId, setSelectedVersionId] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const pendingRequest = useRef<{ id: string; signature: string } | null>(null);
	const validationError = validateDraft(draft, hasCanonicalDesign);
	const board = boardQuery.data;

	useEffect(() => {
		if (!file) {
			setPreviewUrl(null);
			return;
		}
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	function chooseFile(candidate: File | undefined) {
		if (!candidate) {
			return;
		}
		if (!acceptedImageTypes.has(candidate.type)) {
			setError("Yalnızca PNG veya WebP görseli ekleyebilirsiniz.");
			return;
		}
		if (candidate.size < 1 || candidate.size > maxUploadBytes) {
			setError("Görsel 5 MB veya daha küçük olmalıdır.");
			return;
		}
		setError(null);
		setSaved(null);
		setFile(candidate);
	}

	function handlePaste(event: ClipboardEvent<HTMLElement>) {
		const pastedFile = Array.from(event.clipboardData.items)
			.map((item) => (item.type.startsWith("image/") ? item.getAsFile() : null))
			.find((item): item is File => item !== null);
		if (pastedFile) {
			event.preventDefault();
			chooseFile(pastedFile);
		}
	}

	async function refreshAfterSave() {
		await Promise.all([onRefresh(), boardQuery.refetch()]);
	}

	async function saveVersionReference() {
		if (validationError) {
			setError(validationError);
			return;
		}
		if (!selectedVersionId) {
			setError("Bağlanacak Varlık Sürümünü seçin.");
			return;
		}
		const rules = normalizedRules(draft);
		const signature = JSON.stringify({
			assetRecordId,
			...rules,
			projectId,
			targetVersionId: selectedVersionId,
		});
		if (pendingRequest.current?.signature !== signature) {
			pendingRequest.current = { id: crypto.randomUUID(), signature };
		}
		setSaving(true);
		setError(null);
		setSaved(null);
		try {
			await client.assetRecords.createReference({
				assetRecordId,
				id: pendingRequest.current.id,
				projectId,
				targetVersionId: selectedVersionId,
				...rules,
			});
			pendingRequest.current = null;
			setSelectedVersionId("");
			setSaved("Varlık Sürümü referans panosuna eklendi.");
			await refreshAfterSave();
		} catch (caught) {
			setError(
				getErrorMessage(caught, "Varlık Sürümü referans olarak eklenemedi.")
			);
		} finally {
			setSaving(false);
		}
	}

	async function uploadImage() {
		if (validationError) {
			setError(validationError);
			return;
		}
		if (!file) {
			setError(
				"Önce bir PNG veya WebP görseli seçin, yapıştırın ya da bırakın."
			);
			return;
		}
		const rules = normalizedRules(draft);
		const signature = JSON.stringify({
			fileName: file.name,
			lastModified: file.lastModified,
			projectId,
			assetRecordId,
			fileSize: file.size,
			...rules,
		});
		if (pendingRequest.current?.signature !== signature) {
			pendingRequest.current = { id: crypto.randomUUID(), signature };
		}
		const body = {
			...rules,
		};
		setSaving(true);
		setError(null);
		setSaved(null);
		try {
			const response = await fetch(
				`${serverUrl}/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetRecordId)}/references`,
				{
					body: file,
					credentials: "include",
					headers: {
						"Content-Type": file.type,
						"Idempotency-Key": pendingRequest.current.id,
						"X-Reference-Board-File-Name": encodeURIComponent(file.name),
						"X-Reference-Board-Metadata": encodeMetadataHeader(body),
						"X-Reference-Board-Size": String(file.size),
					},
					method: "POST",
				}
			);
			const result: unknown = await response.json();
			if (!response.ok) {
				setError(messageFromUploadError(result));
				return;
			}
			pendingRequest.current = null;
			setFile(null);
			setSaved("Referans görseli panoya eklendi.");
			await refreshAfterSave();
		} catch {
			setError(
				"Yükleme sonucu doğrulanamadı. Aynı görselle yeniden deneyebilirsiniz."
			);
		} finally {
			setSaving(false);
		}
	}

	const imageReferences = board?.imageReferences ?? [];
	const availableToLink = availableVersions.filter(
		(version) => version.assetRecordId !== assetRecordId
	);

	return (
		<section
			aria-labelledby="references-heading"
			className="space-y-4 rounded-lg border p-4"
		>
			<div>
				<h3 className="font-medium" id="references-heading">
					Referans panosu
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					{assetRecordName} için görselleri karşılaştırın ve her referansın
					aktarım sınırını kaydedin.
				</p>
			</div>
			<ConflictSummary
				board={board ?? { conflicts: [], imageReferences: [] }}
				references={references}
			/>
			<EffectiveTransferSummary
				forbiddenFeatures={board?.effectiveForbiddenFeatures ?? []}
				transferredFeatures={board?.effectiveTransferredFeatures ?? []}
			/>
			{boardQuery.isError ? (
				<p className="text-destructive text-sm" role="alert">
					Referans panosu yüklenemedi. Sayfayı yenileyip tekrar deneyin.
				</p>
			) : null}
			<ReferenceUploadDropArea
				file={file}
				isDragging={isDragging}
				onChooseFile={chooseFile}
				onDragStateChange={setIsDragging}
				onPaste={handlePaste}
				previewUrl={previewUrl}
				setFile={setFile}
			/>
			<div className="rounded-md border p-3">
				<h4 className="font-medium text-sm">Yeni referans kuralları</h4>
				<div className="mt-3">
					<ReferenceConstraintEditor
						draft={draft}
						hasCanonicalDesign={hasCanonicalDesign}
						idPrefix={`new-reference-${assetRecordId}`}
						onChange={setDraft}
					/>
				</div>
				{validationError ? (
					<p className="mt-3 text-destructive text-sm" role="alert">
						{validationError}
					</p>
				) : null}
				{error ? (
					<p className="mt-3 text-destructive text-sm" role="alert">
						{error}
					</p>
				) : null}
				{saved ? (
					<p className="mt-3 text-sm" role="status">
						{saved}
					</p>
				) : null}
				<div className="mt-3 flex flex-wrap gap-2">
					<Button
						disabled={saving || Boolean(validationError) || !file}
						onClick={() => void uploadImage()}
						type="button"
					>
						{saving ? "Kaydediliyor…" : "Görseli yükle"}
					</Button>
				</div>
				<form
					className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
					onSubmit={(event) => {
						event.preventDefault();
						void saveVersionReference();
					}}
				>
					<label
						className="block space-y-1 text-sm"
						htmlFor="reference-version"
					>
						<span>Mevcut Varlık Sürümü</span>
						<select
							className="min-h-11 w-full rounded-md border bg-background px-3 py-2"
							id="reference-version"
							onChange={(event) => setSelectedVersionId(event.target.value)}
							value={selectedVersionId}
						>
							<option value="">Sürüm seçin</option>
							{availableToLink.map((version) => (
								<option key={version.id} value={version.id}>
									{version.assetRecordName} ·{" "}
									{version.fileName ?? "Dosya adı bilinmiyor"} · Sürüm{" "}
									{version.versionNumber}
								</option>
							))}
						</select>
					</label>
					<Button
						disabled={saving || Boolean(validationError) || !selectedVersionId}
						type="submit"
						variant="outline"
					>
						Varlık Sürümünü bağla
					</Button>
				</form>
			</div>
			{boardQuery.isPending ? (
				<p className="text-muted-foreground text-sm">Referanslar yükleniyor…</p>
			) : null}
			{references.length === 0 && imageReferences.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Panoda henüz referans yok.
				</p>
			) : (
				<div
					aria-label="Yan yana referanslar"
					className="grid min-w-0 gap-4 md:grid-cols-2"
					role="list"
				>
					{references.map((reference) => (
						<AssetVersionReferenceCard
							assetRecordId={assetRecordId}
							boardRefresh={refreshAfterSave}
							hasCanonicalDesign={hasCanonicalDesign}
							key={reference.id}
							projectId={projectId}
							reference={reference}
						/>
					))}
					{imageReferences.map((image) => (
						<ReferenceCard
							assetRecordId={assetRecordId}
							boardRefresh={refreshAfterSave}
							hasCanonicalDesign={hasCanonicalDesign}
							image={image}
							key={image.id}
							projectId={projectId}
						/>
					))}
				</div>
			)}
		</section>
	);
}
