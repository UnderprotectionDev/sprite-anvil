import { Button } from "@sprite-anvil/ui/components/button";
import { isTauri } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile, stat, type UnwatchFn, watch } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import {
	type LiveFileChangeDependencies,
	type LiveFileInfo,
	prepareLiveFileCandidate,
} from "../services/live-file-change";

const pathSeparatorPattern = /[\\/]/;

interface StoredLiveFileLink {
	modifiedAt: number | null;
	path: string;
	size: number;
}

export interface LiveFileLinkAdapter extends LiveFileChangeDependencies {
	chooseWorkingFile: () => Promise<string | null>;
	isAvailable: boolean;
	openPath: (path: string) => Promise<void>;
	watch: (path: string, callback: () => void) => Promise<UnwatchFn>;
}

interface LiveFileLinkPanelProps {
	adapter?: LiveFileLinkAdapter;
	assetRecordId: string;
	disabled?: boolean;
	hasAssetFamily: boolean;
	onCheckWriteOutcome?: () => void;
	onImport: (candidateFile: File, sourceFile: File) => Promise<boolean>;
	projectId: string;
	writeOutcomeUncertain?: boolean;
}

const nativeFileAdapter: LiveFileLinkAdapter = {
	isAvailable: isTauri(),
	chooseWorkingFile: async () => {
		const result = await openDialog({
			directory: false,
			fileAccessMode: "scoped",
			multiple: false,
			title: "Düzenlenebilir çalışma dosyasını seçin",
		});
		return typeof result === "string" ? result : null;
	},
	chooseExport: async () => {
		const result = await openDialog({
			directory: false,
			filters: [{ name: "PNG veya WebP", extensions: ["png", "webp"] }],
			multiple: false,
			title: "PNG veya WebP dışa aktarımını seçin",
		});
		return typeof result === "string" ? result : null;
	},
	readFile,
	stat: async (path): Promise<LiveFileInfo> => {
		const fileInfo = await stat(path);
		return {
			isFile: fileInfo.isFile,
			size: fileInfo.size,
			mtime: fileInfo.mtime,
		};
	},
	watch: async (path, callback) =>
		watch(path, () => callback(), { delayMs: 500 }),
	openPath,
};

function linkStorageKey(projectId: string, assetRecordId: string) {
	return `sprite-anvil.live-file-link:${projectId}:${assetRecordId}`;
}

function readStoredLink(key: string): StoredLiveFileLink | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		const value: unknown = JSON.parse(
			window.localStorage.getItem(key) ?? "null"
		);
		if (
			value &&
			typeof value === "object" &&
			"path" in value &&
			typeof value.path === "string" &&
			"size" in value &&
			typeof value.size === "number" &&
			Number.isSafeInteger(value.size) &&
			value.size > 0 &&
			"modifiedAt" in value &&
			(value.modifiedAt === null ||
				(typeof value.modifiedAt === "number" &&
					Number.isSafeInteger(value.modifiedAt) &&
					value.modifiedAt >= 0))
		) {
			return {
				path: value.path,
				size: value.size,
				modifiedAt: value.modifiedAt,
			};
		}
	} catch {
		return null;
	}
	return null;
}

function sameVersion(link: StoredLiveFileLink, info: LiveFileInfo) {
	return (
		info.isFile &&
		link.size === info.size &&
		link.modifiedAt === (info.mtime?.getTime() ?? null)
	);
}

function displayName(path: string) {
	return path.split(pathSeparatorPattern).filter(Boolean).at(-1) ?? path;
}

function errorForPreparedCandidate(
	kind: Exclude<
		Awaited<ReturnType<typeof prepareLiveFileCandidate>>["kind"],
		"ready" | "cancelled"
	>
) {
	switch (kind) {
		case "source-changed":
			return "Dışa aktarım seçilirken çalışma dosyası yeniden değişti. Yeniden deneyin.";
		case "source-too-large":
			return "Çalışma dosyası 100 MB sınırını aşıyor.";
		case "source-unavailable":
			return "Çalışma dosyasına erişilemiyor. Bağlantıyı yeniden seçin.";
		case "unsupported-export":
			return "Seçilen dışa aktarım PNG veya WebP dosyası olmalı.";
		default:
			return "Çalışma dosyası içe aktarılamadı.";
	}
}

export function LiveFileLinkPanel({
	assetRecordId,
	disabled = false,
	hasAssetFamily,
	onCheckWriteOutcome,
	onImport,
	projectId,
	writeOutcomeUncertain = false,
	adapter = nativeFileAdapter,
}: LiveFileLinkPanelProps) {
	const storageKey = linkStorageKey(projectId, assetRecordId);
	const [linkedFile, setLinkedFile] = useState<StoredLiveFileLink | null>(() =>
		readStoredLink(storageKey)
	);
	const [changed, setChanged] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		setLinkedFile(readStoredLink(storageKey));
		setChanged(false);
		setError(null);
	}, [storageKey]);

	useEffect(() => {
		if (!(adapter.isAvailable && linkedFile)) {
			return;
		}
		let disposed = false;
		let unwatch: UnwatchFn | undefined;
		void adapter
			.stat(linkedFile.path)
			.then((info) => {
				if (!(disposed || (info.isFile && sameVersion(linkedFile, info)))) {
					setChanged(true);
				}
			})
			.catch(() => {
				if (!disposed) {
					setError("Çalışma dosyasına erişilemiyor. Bağlantıyı yeniden seçin.");
				}
			});
		void adapter
			.watch(linkedFile.path, () => {
				if (!disposed) {
					setChanged(true);
				}
			})
			.then((stop) => {
				if (disposed) {
					stop();
				} else {
					unwatch = stop;
				}
			})
			.catch(() => {
				if (!disposed) {
					setError("Çalışma dosyası izlenemiyor. Bağlantıyı yeniden seçin.");
				}
			});
		return () => {
			disposed = true;
			unwatch?.();
		};
	}, [adapter, linkedFile]);

	async function connectWorkingFile() {
		setBusy(true);
		setError(null);
		setStatus(null);
		try {
			const path = await adapter.chooseWorkingFile();
			if (!path) {
				return;
			}
			const info = await adapter.stat(path);
			if (!info.isFile || info.size <= 0) {
				setError("Düzenlenebilir bir çalışma dosyası seçin.");
				return;
			}
			const link = {
				path,
				size: info.size,
				modifiedAt: info.mtime?.getTime() ?? null,
			};
			window.localStorage.setItem(storageKey, JSON.stringify(link));
			setLinkedFile(link);
			setChanged(false);
			setStatus("Çalışma dosyası bu masaüstü uygulamasına bağlandı.");
		} catch {
			setError("Çalışma dosyası seçilemedi veya okunamadı.");
		} finally {
			setBusy(false);
		}
	}

	async function openWorkingFile() {
		if (!linkedFile) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await adapter.openPath(linkedFile.path);
		} catch {
			setError("Çalışma dosyası varsayılan düzenleyicide açılamadı.");
		} finally {
			setBusy(false);
		}
	}

	async function importChange() {
		if (!(linkedFile && changed && hasAssetFamily)) {
			return;
		}
		setBusy(true);
		setError(null);
		setStatus(null);
		try {
			const prepared = await prepareLiveFileCandidate(linkedFile.path, adapter);
			if (prepared.kind === "cancelled") {
				return;
			}
			if (prepared.kind !== "ready") {
				setError(errorForPreparedCandidate(prepared.kind));
				return;
			}
			if (await onImport(prepared.candidateFile, prepared.sourceFile)) {
				const baseline = {
					...linkedFile,
					size: prepared.sourceFile.size,
					modifiedAt: prepared.sourceModifiedAt,
				};
				window.localStorage.setItem(storageKey, JSON.stringify(baseline));
				setLinkedFile(baseline);
				const current = await adapter.stat(linkedFile.path).catch(() => null);
				const stillChanged = current ? !sameVersion(baseline, current) : true;
				setChanged(stillChanged);
				setStatus(
					stillChanged
						? "Yeni Aday Sürüm kaydedildi. Çalışma dosyasında sonraki değişiklikler de bekliyor."
						: "Yeni Aday Sürüm ve Yönetilen Kopya kaydedildi."
				);
			}
		} catch {
			setError(
				"Çalışma dosyası değişikliği içe aktarılamadı. Yeniden deneyin."
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<section
			aria-labelledby="live-file-link-heading"
			className="space-y-3 rounded-lg border p-4"
		>
			<div>
				<h3 className="font-medium" id="live-file-link-heading">
					Canlı çalışma dosyası
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Düzenlenebilir kaynak dosya bu masaüstü uygulamasında izlenir. Dosya
					yolu cihazınızda kalır.
				</p>
			</div>
			{adapter.isAvailable ? (
				<>
					{linkedFile ? (
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<p>
								Bağlı dosya:{" "}
								<span className="font-medium">
									{displayName(linkedFile.path)}
								</span>
							</p>
							<Button
								disabled={busy}
								onClick={() => void openWorkingFile()}
								type="button"
								variant="outline"
							>
								Düzenleyicide aç
							</Button>
						</div>
					) : null}
					<div className="flex flex-wrap gap-2">
						<Button
							disabled={busy}
							onClick={() => void connectWorkingFile()}
							type="button"
							variant="outline"
						>
							{linkedFile
								? "Çalışma dosyası bağlantısını yenile"
								: "Çalışma dosyasını bağla"}
						</Button>
						{changed ? (
							<Button
								disabled={busy || disabled || !hasAssetFamily}
								onClick={() => void importChange()}
								type="button"
							>
								Değişikliği PNG/WebP olarak içe aktar
							</Button>
						) : null}
						{writeOutcomeUncertain && onCheckWriteOutcome ? (
							<Button
								disabled={busy}
								onClick={onCheckWriteOutcome}
								type="button"
								variant="outline"
							>
								Aday Sürüm durumunu kontrol et
							</Button>
						) : null}
					</div>
					{changed ? (
						<p className="text-sm" role="status">
							Çalışma dosyası değişti. Yeni Aday Sürüm için PNG veya WebP dışa
							aktarımını seçin.
						</p>
					) : null}
					{changed && !hasAssetFamily ? (
						<p className="text-muted-foreground text-sm" role="status">
							Aday Sürüm oluşturmadan önce bu Varlık Kaydına bir Varlık Ailesi
							bağlayın.
						</p>
					) : null}
				</>
			) : (
				<p className="text-sm">
					Canlı yerel dosya bağlantısı yalnızca masaüstü uygulamasında
					kullanılabilir.
				</p>
			)}
			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
			{status ? (
				<p className="text-sm" role="status">
					{status}
				</p>
			) : null}
		</section>
	);
}
