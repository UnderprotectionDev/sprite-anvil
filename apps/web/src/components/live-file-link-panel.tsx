import { Button } from "@sprite-anvil/ui/components/button";
import { isTauri } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { UnwatchFn } from "@tauri-apps/plugin-fs";
import { readFile, stat, watch } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import type {
	LiveFileChangeDependencies,
	LiveFileInfo,
} from "@/features/production-provenance/lib/live-file-change";
import { prepareLiveFileCandidate } from "@/features/production-provenance/lib/live-file-change";
import type {
	LiveFileLinkStore,
	StoredLiveFileLink,
} from "@/features/production-provenance/lib/live-file-link-store";
import { getDefaultLiveFileLinkStore } from "@/features/production-provenance/lib/live-file-link-store";

const pathSeparatorPattern = /[\\/]/u;

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
	linkStore?: LiveFileLinkStore;
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
			title: "Select the editable working file",
		});
		return typeof result === "string" ? result : null;
	},
	chooseExport: async () => {
		const result = await openDialog({
			directory: false,
			filters: [{ name: "PNG or WebP", extensions: ["png", "webp"] }],
			multiple: false,
			title: "Select a PNG or WebP export",
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
			return "The working file changed again while selecting the export. Try again.";
		case "source-too-large":
			return "The working file exceeds the 100 MB limit.";
		case "source-unavailable":
			return "Cannot access the working file. Select the link again.";
		case "unsupported-export":
			return "The selected export must be a PNG or WebP file.";
		default:
			return "Could not import the working file.";
	}
}

export function LiveFileLinkPanel({
	assetRecordId,
	disabled = false,
	hasAssetFamily,
	linkStore: injectedLinkStore,
	onCheckWriteOutcome,
	onImport,
	projectId,
	writeOutcomeUncertain = false,
	adapter = nativeFileAdapter,
}: LiveFileLinkPanelProps) {
	const linkStore = injectedLinkStore ?? getDefaultLiveFileLinkStore();
	const [linkedFile, setLinkedFile] = useState<StoredLiveFileLink | null>(null);
	const [linkLoaded, setLinkLoaded] = useState(false);
	const [changed, setChanged] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		let disposed = false;
		setLinkLoaded(false);
		setLinkedFile(null);
		setChanged(false);
		setError(null);
		linkStore
			.read(projectId, assetRecordId)
			.catch(() => null)
			.then((stored) => {
				if (!disposed) {
					setLinkedFile(stored);
					setLinkLoaded(true);
				}
			});
		return () => {
			disposed = true;
		};
	}, [assetRecordId, linkStore, projectId]);

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
					setError("Cannot access the working file. Select the link again.");
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
					setError("Cannot monitor the working file. Select the link again.");
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
				setError("Select an editable working file.");
				return;
			}
			const link = {
				path,
				size: info.size,
				modifiedAt: info.mtime?.getTime() ?? null,
			};
			await linkStore.write(projectId, assetRecordId, link);
			setLinkedFile(link);
			setChanged(false);
			setStatus("Working file linked to this desktop app.");
		} catch {
			setError("Could not select or read the working file.");
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
			setError("Could not open the working file in the default editor.");
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
				await linkStore.write(projectId, assetRecordId, baseline);
				setLinkedFile(baseline);
				const current = await adapter.stat(linkedFile.path).catch(() => null);
				const stillChanged = current ? !sameVersion(baseline, current) : true;
				setChanged(stillChanged);
				setStatus(
					stillChanged
						? "New Candidate Version saved. Later working file changes are also pending."
						: "New Candidate Version and Managed Snapshot saved."
				);
			}
		} catch {
			setError("Could not import the working file change. Try again.");
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
					Live working file
				</h3>
				<p className="text-muted-foreground mt-1 text-sm">
					The editable source file is monitored in this desktop app. The file
					path stays on your device.
				</p>
			</div>
			{adapter.isAvailable ? (
				<>
					{linkedFile ? (
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<p>
								Linked file:{" "}
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
								Open in editor
							</Button>
						</div>
					) : null}
					<div className="flex flex-wrap gap-2">
						<Button
							disabled={busy || !linkLoaded}
							onClick={() => void connectWorkingFile()}
							type="button"
							variant="outline"
						>
							{linkedFile ? "Refresh working file link" : "Link working file"}
						</Button>
						{changed ? (
							<Button
								disabled={busy || disabled || !hasAssetFamily}
								onClick={() => void importChange()}
								type="button"
							>
								Import change as PNG/WebP
							</Button>
						) : null}
						{writeOutcomeUncertain && onCheckWriteOutcome ? (
							<Button
								disabled={busy}
								onClick={onCheckWriteOutcome}
								type="button"
								variant="outline"
							>
								Check Candidate Version status
							</Button>
						) : null}
					</div>
					{changed ? (
						<p className="text-sm" role="status">
							The working file changed. Select a PNG or WebP export for the new
							Candidate Version.
						</p>
					) : null}
					{changed && !hasAssetFamily ? (
						<p className="text-muted-foreground text-sm" role="status">
							Link an Asset Family to this Asset Record before creating a
							Candidate Version.
						</p>
					) : null}
				</>
			) : (
				<p className="text-sm">
					Live local file links are available only in the desktop app.
				</p>
			)}
			{error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
			{status ? (
				<p className="text-sm" role="status">
					{status}
				</p>
			) : null}
		</section>
	);
}
