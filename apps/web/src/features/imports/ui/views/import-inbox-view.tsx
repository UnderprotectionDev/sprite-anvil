import type { ImportInboxEntry } from "@sprite-anvil/api/import-inbox";
import {
	importInboxEntriesSchema,
	importInboxEntrySchema,
} from "@sprite-anvil/api/import-inbox";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ChangeEvent, useRef, useState } from "react";
import {
	importInboxFileUrl,
	importInboxUrl,
	readSupportReference,
} from "./import-inbox-api";
import { SourceMetadataMappingPanel } from "./source-metadata-mapping-panel";

interface UploadFailure {
	file: File;
	message: string;
	supportReference?: string;
}
type UploadResult =
	| { file: File; ok: true }
	| {
			file: File;
			message: string;
			ok: false;
			outcome: "rejected" | "unknown";
			retryable: boolean;
			supportReference?: string;
	  };

class ImportInboxUploadError extends Error {
	readonly outcome: "rejected" | "unknown";
	readonly retryable: boolean;
	readonly supportReference?: string;

	constructor(
		message: string,
		outcome: "rejected" | "unknown",
		retryable: boolean,
		supportReference?: string
	) {
		super(message);
		this.outcome = outcome;
		this.retryable = retryable;
		this.supportReference = supportReference;
	}
}

class ImportInboxReadError extends Error {
	readonly supportReference?: string;

	constructor(message: string, supportReference?: string) {
		super(message);
		this.supportReference = supportReference;
	}
}

const uncertainUploadMessage =
	"Yükleme sonucu doğrulanamadı. Gelen Kutusunu yenileyip güncel durumu kontrol edin.";

async function readEntries(projectId: string) {
	const response = await fetch(importInboxUrl(projectId), {
		credentials: "include",
	});
	if (!response.ok) {
		const errorBody: unknown = await response.json().catch(() => null);
		throw new ImportInboxReadError(
			"İçe Aktarma Gelen Kutusu açılamadı.",
			readSupportReference(errorBody)
		);
	}
	return importInboxEntriesSchema.parse(await response.json());
}

function formatContentLength(contentLength: number) {
	if (contentLength === 0) {
		return "0 B";
	}
	const units = ["B", "KB", "MB", "GB"];
	const unitIndex = Math.min(
		Math.floor(Math.log(contentLength) / Math.log(1024)),
		units.length - 1
	);
	const amount = contentLength / 1024 ** unitIndex;
	return (
		new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(
			amount
		) +
		" " +
		units[unitIndex]
	);
}

function formatCreatedAt(value: string) {
	return new Intl.DateTimeFormat("tr-TR", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function uploadErrorMessage(status: number) {
	if (status === 400) {
		return "Dosya bilgileri okunamadı. Dosyayı yeniden seçip tekrar deneyin.";
	}
	if (status === 401) {
		return "Oturumunuz sona ermiş. Yeniden giriş yapın.";
	}
	if (status === 404) {
		return "Bu oyun projesi açılamadı.";
	}
	if (status === 409) {
		return "Bu yükleme başka bir dosya için kullanılmış. Dosyayı yeniden seçin.";
	}
	if (status === 415) {
		return "Bu dosya yüklenemedi. Dosyayı yeniden seçin.";
	}
	return null;
}

export function ImportInboxView({ projectId }: { projectId: string }) {
	const queryClient = useQueryClient();
	const pendingEntryIds = useRef(new Map<File, string>());
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [uploadErrors, setUploadErrors] = useState<UploadFailure[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadingFileName, setUploadingFileName] = useState<string | null>(
		null
	);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const queryKey = ["import-inbox", projectId] as const;
	const entriesQuery = useQuery({
		queryKey,
		queryFn: () => readEntries(projectId),
	});

	function selectFiles(event: ChangeEvent<HTMLInputElement>) {
		const files = Array.from(event.currentTarget.files ?? []);
		for (const failure of uploadErrors) {
			pendingEntryIds.current.delete(failure.file);
		}
		for (const file of files) {
			pendingEntryIds.current.set(file, crypto.randomUUID());
		}
		setSelectedFiles(files);
		setUploadErrors([]);
		setStatusMessage(null);
		event.currentTarget.value = "";
	}

	async function uploadFile(file: File, entryId: string) {
		const response = await fetch(importInboxUrl(projectId), {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/octet-stream",
				"Idempotency-Key": entryId,
				"X-Import-Inbox-File-Name": encodeURIComponent(file.name),
				"X-Import-Inbox-Size": String(file.size),
				"X-Import-Inbox-Source-Type": file.type || "application/octet-stream",
			},
			body: file,
		});
		if (!response.ok) {
			const message = uploadErrorMessage(response.status);
			if (message !== null) {
				throw new ImportInboxUploadError(
					message,
					"rejected",
					response.status !== 409
				);
			}
			const errorBody: unknown = await response.json().catch(() => null);
			throw new ImportInboxUploadError(
				uncertainUploadMessage,
				"unknown",
				false,
				readSupportReference(errorBody)
			);
		}
		return importInboxEntrySchema.parse(await response.json());
	}

	async function uploadSelectedFile(file: File): Promise<UploadResult> {
		setUploadingFileName(file.name);
		const entryId = pendingEntryIds.current.get(file) ?? crypto.randomUUID();
		pendingEntryIds.current.set(file, entryId);
		try {
			await uploadFile(file, entryId);
			pendingEntryIds.current.delete(file);
			return { file, ok: true };
		} catch (error) {
			if (error instanceof ImportInboxUploadError) {
				return {
					file,
					message: error.message,
					ok: false,
					outcome: error.outcome,
					retryable: error.retryable,
					...(error.supportReference
						? { supportReference: error.supportReference }
						: {}),
				};
			}
			return {
				file,
				message: uncertainUploadMessage,
				ok: false,
				outcome: "unknown",
				retryable: false,
			};
		}
	}

	async function uploadSelectedFiles(files: File[]) {
		const results: UploadResult[] = [];
		for (const file of files) {
			// biome-ignore lint/performance/noAwaitInLoops: Sequential uploads keep large source files from competing for memory and preserve per-file progress.
			results.push(await uploadSelectedFile(file));
		}
		return results;
	}

	async function handleUpload() {
		if (isUploading || selectedFiles.length === 0) {
			return;
		}
		setIsUploading(true);
		setUploadErrors([]);
		setStatusMessage(null);
		try {
			const results = await uploadSelectedFiles(selectedFiles);
			const uploadFailures = results.flatMap((result) =>
				result.ok ? [] : [result]
			);
			const failures = uploadFailures.map(
				({ file, message, supportReference }) => ({
					file,
					message,
					...(supportReference ? { supportReference } : {}),
				})
			);
			const retryableFiles = uploadFailures
				.filter((failure) => failure.retryable)
				.map((failure) => failure.file);
			const hasUnknownOutcome = uploadFailures.some(
				(failure) => failure.outcome === "unknown"
			);
			const savedCount = results.filter((result) => result.ok).length;
			setSelectedFiles(retryableFiles);
			setUploadErrors(failures);
			if (savedCount > 0 || hasUnknownOutcome) {
				await queryClient.invalidateQueries({ queryKey });
			}
			if (savedCount > 0) {
				setStatusMessage(
					savedCount === 1
						? "Dosya İçe Aktarma Gelen Kutusuna alındı."
						: `${savedCount} dosya İçe Aktarma Gelen Kutusuna alındı.`
				);
			}
		} finally {
			setUploadingFileName(null);
			setIsUploading(false);
		}
	}

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 overflow-y-auto px-4 py-8">
			<header className="space-y-4">
				<Link
					className="text-muted-foreground text-sm underline underline-offset-4"
					params={{ projectId }}
					to="/projects/$projectId/assets"
				>
					Varlık kayıtlarına dön
				</Link>
				<div className="space-y-2">
					<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
						İçe aktarma
					</p>
					<h1 className="font-medium font-serif text-4xl tracking-tight">
						İçe Aktarma Gelen Kutusu
					</h1>
					<p className="max-w-2xl text-muted-foreground">
						Hedefi henüz belli olmayan dosyaları Yönetilen Kopya olarak
						saklayın. Bu dosyalar Varlık Kaydı veya Aday Sürüm değildir;
						ilişkilendirilene kadar onaylanamaz ve dışa aktarılamaz.
					</p>
				</div>
			</header>

			<section
				aria-labelledby="import-inbox-upload-heading"
				className="space-y-4 rounded-lg border p-5"
			>
				<div>
					<h2
						className="font-semibold text-xl"
						id="import-inbox-upload-heading"
					>
						Dosya ekle
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Özgün dosya ve adı korunur. Dosya içeriğinden üretim geçmişi
						çıkarılmaz.
					</p>
				</div>
				<div className="space-y-2">
					<label className="font-medium text-sm" htmlFor="import-inbox-files">
						Dosyalar
					</label>
					<input
						aria-describedby="import-inbox-file-help"
						className="block min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:font-medium"
						disabled={isUploading}
						id="import-inbox-files"
						multiple
						onChange={selectFiles}
						type="file"
					/>
					<p
						className="text-muted-foreground text-sm"
						id="import-inbox-file-help"
					>
						Bir veya daha fazla dosya seçebilirsiniz. Dosyalar ayrı ayrı
						yüklenir; güvenle yeniden denenebilenler seçili kalır.
					</p>
				</div>
				{selectedFiles.length > 0 ? (
					<ul aria-label="Seçilen dosyalar" className="space-y-1 text-sm">
						{selectedFiles.map((file) => (
							<li key={pendingEntryIds.current.get(file)}>
								{file.name} · {formatContentLength(file.size)}
							</li>
						))}
					</ul>
				) : null}
				{isUploading && uploadingFileName ? (
					<p aria-live="polite" role="status">
						Yükleniyor: {uploadingFileName}
					</p>
				) : null}
				{uploadErrors.length > 0 ? (
					<ul aria-label="Yükleme hataları" className="space-y-1" role="alert">
						{uploadErrors.map((failure) => (
							<li key={pendingEntryIds.current.get(failure.file)}>
								{failure.file.name}: {failure.message}
								{failure.supportReference ? (
									<span className="block">
										Destek Referansı: {failure.supportReference}
									</span>
								) : null}
							</li>
						))}
					</ul>
				) : null}
				{statusMessage ? (
					<p aria-live="polite" role="status">
						{statusMessage}
					</p>
				) : null}
				<Button
					className="min-h-11"
					disabled={isUploading || selectedFiles.length === 0}
					onClick={() => void handleUpload()}
					type="button"
				>
					{isUploading ? "Dosyalar alınıyor…" : "Dosyaları Gelen Kutusuna Al"}
				</Button>
			</section>

			<section
				aria-labelledby="import-inbox-entries-heading"
				className="space-y-4"
			>
				<div>
					<h2
						className="font-semibold text-xl"
						id="import-inbox-entries-heading"
					>
						İlişkilendirme bekleyen dosyalar
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Bu listede yalnızca hedefi kesinleşmemiş İçe Aktarma Gelen Kutusu
						Girdileri bulunur.
					</p>
				</div>
				{entriesQuery.isPending ? (
					<p aria-live="polite" role="status">
						Gelen kutusu yükleniyor…
					</p>
				) : null}
				{entriesQuery.isError ? (
					<div className="space-y-2" role="alert">
						<p>Gelen kutusu yüklenemedi.</p>
						{entriesQuery.error instanceof ImportInboxReadError &&
						entriesQuery.error.supportReference ? (
							<p>Destek Referansı: {entriesQuery.error.supportReference}</p>
						) : null}
						<Button
							className="min-h-11"
							onClick={() => void entriesQuery.refetch()}
							type="button"
							variant="outline"
						>
							Yeniden dene
						</Button>
					</div>
				) : null}
				{entriesQuery.isSuccess && entriesQuery.data.length === 0 ? (
					<p className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
						Henüz ilişkilendirme bekleyen dosya yok.
					</p>
				) : null}
				{entriesQuery.isSuccess && entriesQuery.data.length > 0 ? (
					<ul
						aria-label="İçe Aktarma Gelen Kutusu Girdileri"
						className="space-y-3"
					>
						{entriesQuery.data.map((entry) => (
							<ImportInboxEntryCard
								entries={entriesQuery.data}
								entry={entry}
								key={entry.id}
								projectId={projectId}
							/>
						))}
					</ul>
				) : null}
			</section>
		</main>
	);
}

function ImportInboxEntryCard({
	entry,
	entries,
	projectId,
}: {
	entry: ImportInboxEntry;
	entries: ImportInboxEntry[];
	projectId: string;
}) {
	return (
		<li className="space-y-3 rounded-lg border p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<h3 className="break-words font-medium">{entry.fileName}</h3>
					<p className="text-muted-foreground text-sm">
						İlişkilendirme bekliyor · {formatContentLength(entry.contentLength)}
					</p>
				</div>
				<a
					className="inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm underline-offset-4 hover:bg-accent hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
					download={entry.fileName}
					href={importInboxFileUrl(projectId, entry.id)}
				>
					Dosyayı indir
				</a>
			</div>
			<details className="text-sm">
				<summary className="min-h-11 cursor-pointer py-3 font-medium">
					Kaynak bilgileri
				</summary>
				<dl className="grid gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr]">
					<dt className="text-muted-foreground">Kaynak türü</dt>
					<dd className="break-all">{entry.sourceContentType}</dd>
					<dt className="text-muted-foreground">Dosya boyutu</dt>
					<dd>{formatContentLength(entry.contentLength)}</dd>
					<dt className="text-muted-foreground">Eklenme zamanı</dt>
					<dd>{formatCreatedAt(entry.createdAt)}</dd>
					<dt className="text-muted-foreground">SHA-256</dt>
					<dd className="break-all font-mono text-xs">{entry.sha256}</dd>
				</dl>
			</details>
			{entry.sourceContentType.startsWith("image/") ? (
				<SourceMetadataMappingPanel
					entries={entries}
					entry={entry}
					projectId={projectId}
				/>
			) : null}
		</li>
	);
}
