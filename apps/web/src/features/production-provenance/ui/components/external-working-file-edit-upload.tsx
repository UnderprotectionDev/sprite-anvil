import { Button } from "@sprite-anvil/ui/components/button";
import type {
	DragEvent,
	ClipboardEvent as ReactClipboardEvent,
	SyntheticEvent,
} from "react";
import { useId, useRef, useState } from "react";

const maxSnapshotBytes = 100 * 1024 * 1024;

interface ExternalWorkingFileEditUploadProps {
	disabled?: boolean;
	onImport: (candidateFile: File, sourceFile: File) => Promise<boolean>;
}

function isSupportedExport(file: File) {
	const name = file.name.toLowerCase();
	return (
		file.type === "image/png" ||
		file.type === "image/webp" ||
		name.endsWith(".png") ||
		name.endsWith(".webp")
	);
}

export function ExternalWorkingFileEditUpload({
	disabled = false,
	onImport,
}: ExternalWorkingFileEditUploadProps) {
	const [candidateFile, setCandidateFile] = useState<File | null>(null);
	const [sourceFile, setSourceFile] = useState<File | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const candidateInputRef = useRef<HTMLInputElement>(null);
	const sourceInputRef = useRef<HTMLInputElement>(null);
	const hintId = useId();

	function selectCandidate(file: File) {
		setError(null);
		setCandidateFile(null);
		if (file.size === 0 || !isSupportedExport(file)) {
			setError("Aday Sürüm dosyası PNG veya WebP olmalı ve boş olamaz.");
			return;
		}
		setCandidateFile(file);
	}

	function selectSource(file: File) {
		setError(null);
		setSourceFile(null);
		if (file.size === 0 || file.size > maxSnapshotBytes) {
			setError("Çalışma dosyası boş olamaz ve 100 MB sınırını aşamaz.");
			return;
		}
		setSourceFile(file);
	}

	function candidateFromDrop(event: DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		const file = event.dataTransfer.files.item(0);
		if (file) {
			selectCandidate(file);
		}
	}

	function candidateFromPaste(event: ReactClipboardEvent<HTMLButtonElement>) {
		const file = event.clipboardData.files.item(0);
		if (file) {
			event.preventDefault();
			selectCandidate(file);
		}
	}

	function sourceFromDrop(event: DragEvent<HTMLButtonElement>) {
		event.preventDefault();
		const file = event.dataTransfer.files.item(0);
		if (file) {
			selectSource(file);
		}
	}

	function sourceFromPaste(event: ReactClipboardEvent<HTMLButtonElement>) {
		const file = event.clipboardData.files.item(0);
		if (file) {
			event.preventDefault();
			selectSource(file);
		}
	}

	async function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (disabled || busy || !candidateFile || !sourceFile) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			if (await onImport(candidateFile, sourceFile)) {
				setCandidateFile(null);
				setSourceFile(null);
				if (candidateInputRef.current) {
					candidateInputRef.current.value = "";
				}
				if (sourceInputRef.current) {
					sourceInputRef.current.value = "";
				}
			} else {
				setError("Yükleme tamamlanmadı. Aynı dosyalarla yeniden deneyin.");
			}
		} catch {
			setError("Dosyalar içe aktarılamadı. Yeniden deneyin.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<form className="w-full space-y-3 rounded-md border p-3" onSubmit={submit}>
			<div>
				<p className="font-medium text-sm">
					Harici çalışma dosyası düzenlemesi
				</p>
				<p className="text-muted-foreground text-xs">
					PNG/WebP dışa aktarımını Aday Sürüm, düzenlenebilir kaynak dosyayı
					Yönetilen Kopya olarak birlikte kaydedin.
				</p>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1">
					<p className="font-medium text-sm">PNG/WebP dışa aktarımı</p>
					<button
						aria-describedby={`${hintId}-candidate`}
						aria-label="PNG/WebP dışa aktarımı seç, sürükle veya yapıştır"
						className="flex min-h-11 w-full items-center rounded-md border border-dashed px-3 py-2 text-left text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
						disabled={disabled || busy}
						onClick={() => candidateInputRef.current?.click()}
						onDragOver={(event) => event.preventDefault()}
						onDrop={candidateFromDrop}
						onPaste={candidateFromPaste}
						type="button"
					>
						{candidateFile?.name ?? "Dosyayı seç, sürükle veya yapıştır"}
					</button>
					<p className="sr-only" id={`${hintId}-candidate`}>
						PNG veya WebP dosyası seçin, sürükleyip bırakın ya da panodan
						yapıştırın.
					</p>
					<input
						accept="image/png,image/webp"
						aria-label="PNG/WebP dışa aktarımı"
						className="sr-only"
						disabled={disabled || busy}
						onChange={(event) => {
							const file = event.currentTarget.files?.[0];
							event.currentTarget.value = "";
							if (file) {
								selectCandidate(file);
							}
						}}
						ref={candidateInputRef}
						type="file"
					/>
				</div>
				<div className="space-y-1">
					<p className="font-medium text-sm">Düzenlenebilir çalışma dosyası</p>
					<button
						aria-describedby={`${hintId}-source`}
						aria-label="Düzenlenebilir çalışma dosyası seç, sürükle veya yapıştır"
						className="flex min-h-11 w-full items-center rounded-md border border-dashed px-3 py-2 text-left text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
						disabled={disabled || busy}
						onClick={() => sourceInputRef.current?.click()}
						onDragOver={(event) => event.preventDefault()}
						onDrop={sourceFromDrop}
						onPaste={sourceFromPaste}
						type="button"
					>
						{sourceFile?.name ?? "Dosyayı seç, sürükle veya yapıştır"}
					</button>
					<p className="sr-only" id={`${hintId}-source`}>
						Düzenlenebilir çalışma dosyasını seçin, sürükleyip bırakın ya da
						panodan yapıştırın.
					</p>
					<input
						accept="*/*"
						aria-label="Düzenlenebilir çalışma dosyası"
						className="sr-only"
						disabled={disabled || busy}
						onChange={(event) => {
							const file = event.currentTarget.files?.[0];
							event.currentTarget.value = "";
							if (file) {
								selectSource(file);
							}
						}}
						ref={sourceInputRef}
						type="file"
					/>
				</div>
			</div>
			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
			<Button
				disabled={disabled || busy || !candidateFile || !sourceFile}
				type="submit"
			>
				{busy
					? "Aday Sürüm ve Yönetilen Kopya kaydediliyor…"
					: "Aday Sürüm ve Yönetilen Kopyayı kaydet"}
			</Button>
		</form>
	);
}
