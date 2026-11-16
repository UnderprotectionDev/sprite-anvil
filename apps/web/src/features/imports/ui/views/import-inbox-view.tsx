import type { ImportInboxEntry } from "@sprite-anvil/api/import-inbox";
import { importInboxEntrySchema } from "@sprite-anvil/api/import-inbox";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ChangeEvent, useRef, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { TaskWorkspace } from "@/components/task-workspace";
import { buildErrorNotification } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import {
	importInboxFileUrl,
	importInboxUrl,
	readSupportReference,
} from "../../lib/import-inbox-api";
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

const uncertainUploadMessage =
	"Could not verify the upload result. Refresh the Import Inbox and check the current state.";

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
		return "Could not read file information. Select the file again and retry.";
	}
	if (status === 401) {
		return "Your session has expired. Sign in again.";
	}
	if (status === 404) {
		return "Could not open this game project.";
	}
	if (status === 409) {
		return "This upload was used for another file. Select the file again.";
	}
	if (status === 415) {
		return "Could not upload this file. Select it again.";
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
	const entriesQueryOptions = orpc.imports.listEntries.queryOptions({
		input: { projectId },
	});
	const entriesQuery = useQuery(entriesQueryOptions);

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
		// conventions-exception: raw-fetch Import Inbox files stream the raw file body with size, name and idempotency headers to the verifying Hono upload route; the RPC link sends buffered JSON or multipart.
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
				({
					file: failedFile,
					message: failureMessage,
					supportReference: failureReference,
				}) => ({
					file: failedFile,
					message: failureMessage,
					...(failureReference ? { supportReference: failureReference } : {}),
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
				await queryClient.invalidateQueries({
					queryKey: entriesQueryOptions.queryKey,
				});
			}
			if (savedCount > 0) {
				setStatusMessage(
					savedCount === 1
						? "File added to the Import Inbox."
						: `${savedCount} files added to the Import Inbox.`
				);
			}
		} finally {
			setUploadingFileName(null);
			setIsUploading(false);
		}
	}

	const supportReference = entriesQuery.isError
		? buildErrorNotification(entriesQuery.error, "query").supportReference
		: undefined;

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
			<header className="space-y-4">
				<Link
					className="text-muted-foreground text-sm underline underline-offset-4"
					params={{ projectId }}
					to="/projects/$projectId/assets"
				>
					Back to Asset Records
				</Link>
				<div className="space-y-2">
					<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
						Import
					</p>
					<h1 className="font-medium font-serif text-4xl tracking-tight">
						Import Inbox
					</h1>
					<p className="max-w-2xl text-muted-foreground">
						Store files without a known target as Managed Snapshots. They are
						not Asset Records or Candidate Versions and cannot be approved or
						exported until linked.
					</p>
				</div>
			</header>

			<TaskWorkspace
				label="Import workspaces"
				sections={[
					{
						id: "upload",
						label: "Add files",
						description:
							"Select files without a known target and add them to the Import Inbox.",
						content: (
							<>
								<section
									aria-labelledby="import-inbox-upload-heading"
									className="space-y-4 rounded-lg border p-5"
								>
									<div>
										<h2
											className="font-semibold text-xl"
											id="import-inbox-upload-heading"
										>
											Add files
										</h2>
										<p className="mt-1 text-muted-foreground text-sm">
											The original file and name are preserved. Production
											history is not inferred from file contents.
										</p>
									</div>
									<div className="space-y-2">
										<Label
											className="font-medium text-sm"
											htmlFor="import-inbox-files"
										>
											Dosyalar
										</Label>
										<Input
											aria-describedby="import-inbox-file-help"
											className="block h-auto min-h-11 rounded-md bg-background px-3 py-2 text-sm file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:font-medium"
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
											You can select one or more files. Files upload separately;
											those safe to retry remain selected.
										</p>
									</div>
									{selectedFiles.length > 0 ? (
										<ul
											aria-label="Selected files"
											className="space-y-1 text-sm"
										>
											{selectedFiles.map((file) => (
												<li key={pendingEntryIds.current.get(file)}>
													{file.name} · {formatContentLength(file.size)}
												</li>
											))}
										</ul>
									) : null}
									{isUploading && uploadingFileName ? (
										<p aria-live="polite" role="status">
											Uploading: {uploadingFileName}
										</p>
									) : null}
									{uploadErrors.length > 0 ? (
										<ul
											aria-label="Upload errors"
											className="space-y-1"
											role="alert"
										>
											{uploadErrors.map((failure) => (
												<li key={pendingEntryIds.current.get(failure.file)}>
													{failure.file.name}: {failure.message}
													{failure.supportReference ? (
														<span className="block">
															Support reference: {failure.supportReference}
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
										{isUploading
											? "Receiving files…"
											: "Add files to Import Inbox"}
									</Button>
								</section>
							</>
						),
					},
					{
						id: "entries",
						label: "Bekleyen dosyalar",
						description:
							"Find files, review source information, and prepare Source Metadata Mapping when available.",
						content: (
							<>
								<section
									aria-labelledby="import-inbox-entries-heading"
									className="space-y-4"
								>
									<div>
										<h2
											className="font-semibold text-xl"
											id="import-inbox-entries-heading"
										>
											Files awaiting linking
										</h2>
										<p className="mt-1 text-muted-foreground text-sm">
											This list contains only Import Inbox Entries without a
											confirmed target.
										</p>
									</div>
									{entriesQuery.isPending ? (
										<p aria-live="polite" role="status">
											Loading Import Inbox…
										</p>
									) : null}
									{entriesQuery.isError ? (
										<div className="space-y-2">
											<StatusMessage tone="error">
												Could not load Import Inbox.
											</StatusMessage>
											{supportReference ? (
												<p>Support reference: {supportReference}</p>
											) : null}
											<Button
												className="min-h-11"
												onClick={() => void entriesQuery.refetch()}
												type="button"
												variant="outline"
											>
												Try again
											</Button>
										</div>
									) : null}
									{entriesQuery.isSuccess && entriesQuery.data.length === 0 ? (
										<p className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
											No files await linking yet.
										</p>
									) : null}
									{entriesQuery.isSuccess && entriesQuery.data.length > 0 ? (
										<ul aria-label="Import Inbox Entries" className="space-y-3">
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
							</>
						),
					},
				]}
			/>
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
						Awaiting linking · {formatContentLength(entry.contentLength)}
					</p>
				</div>
				<a
					className="inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm underline-offset-4 hover:bg-accent hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
					download={entry.fileName}
					href={importInboxFileUrl(projectId, entry.id)}
				>
					Download file
				</a>
			</div>
			<details className="text-sm">
				<summary className="min-h-11 cursor-pointer py-3 font-medium">
					Source information
				</summary>
				<dl className="grid gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr]">
					<dt className="text-muted-foreground">Source type</dt>
					<dd className="break-all">{entry.sourceContentType}</dd>
					<dt className="text-muted-foreground">File size</dt>
					<dd>{formatContentLength(entry.contentLength)}</dd>
					<dt className="text-muted-foreground">Added at</dt>
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
