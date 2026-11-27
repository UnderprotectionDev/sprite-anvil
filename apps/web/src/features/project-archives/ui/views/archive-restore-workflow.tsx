import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import {
	canRequestCancel,
	isBackgroundOperationActive,
} from "@sprite-anvil/api/background-operations";
import type {
	ProjectArchiveRestore,
	RestoreOperationReadInput,
} from "@sprite-anvil/api/project-archive-restore";
import type { ProjectArchive } from "@sprite-anvil/api/project-archives";
import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Check,
	CircleAlert,
	CircleDashed,
	Copy,
	LoaderCircle,
	TriangleAlert,
	Upload,
} from "lucide-react";
import { useState } from "react";
import type { ProjectCoverRecord } from "@/components/project-cover";
import { ProjectCover } from "@/components/project-cover";
import { orpc } from "@/utils/orpc";
import {
	archiveDate,
	archiveStats,
	includedArchiveSize,
} from "../../lib/archive-summary";
import type { RestoreStageStatus } from "../components/restore-stage-layout";
import { RestoreStageLayout } from "../components/restore-stage-layout";
import { RestoreArchiveSelection } from "../forms/restore-archive-selection";

type RestoreTask = "upload" | "restore";

export function ArchiveRestoreWorkflow({
	projectId,
	archiveId,
	task,
	initialOperationId,
	onOperationAccepted,
}: {
	projectId: string;
	archiveId?: string;
	initialOperationId?: string;
	onOperationAccepted?: (id: string, task?: RestoreTask) => void;
	task: RestoreTask;
}) {
	const [operationId, setLocalOperationId] = useState(initialOperationId);
	const projects = useQuery(orpc.projects.list.queryOptions());
	const cover = projects.data?.find((item) => item.id === projectId) ?? {
		id: projectId,
		name: "Project Archive",
	};
	const input: RestoreOperationReadInput =
		task === "restore"
			? {
					task,
					projectId,
					operationId: operationId ?? "",
					archiveId: archiveId ?? "",
				}
			: { task, projectId, operationId: operationId ?? "" };
	const options = orpc.projectArchives.getRestoreOperation.queryOptions({
		input,
	});
	const operations = useQuery({
		...options,
		enabled: Boolean(operationId && (task === "upload" || archiveId)),
		meta: { errorPresentation: "inline" },
		refetchInterval: (query) => {
			const current = query.state.data?.operation;
			return current && !isBackgroundOperationActive(current.status)
				? false
				: 2000;
		},
	});
	const operation = operations.data?.operation;
	const verifiedRestore = operations.data?.restore;

	return (
		<main className="bg-workbench-sidebar flex h-full min-h-0 flex-col gap-5 overflow-y-auto px-4 pt-7 pb-8 sm:px-8">
			<header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
				<h1 className="font-heading text-[30px] leading-9 font-bold">
					Restore
				</h1>
				<p className="text-workbench-muted-text text-[14px] leading-5">
					{restoreHeaderHint(
						operationId,
						verifiedRestore ? operation : undefined
					)}
				</p>
			</header>
			{operationId ? (
				<RestoreProgress
					archiveId={archiveId}
					cover={cover}
					listError={operations.isError || (task === "restore" && !archiveId)}
					listReady={operations.isSuccess}
					onRestart={() => setLocalOperationId(undefined)}
					operation={operation}
					operationId={operationId}
					projectId={projectId}
					task={task}
					verifiedRestore={verifiedRestore ?? undefined}
				/>
			) : (
				<RestoreStageLayout
					active={0}
					cover={cover}
					statuses={["Current", "Waiting", "Waiting"]}
				>
					<RestoreArchiveSelection
						archiveId={archiveId}
						cover={cover}
						onAccepted={(accepted, acceptedTask) => {
							setLocalOperationId(accepted.id);
							onOperationAccepted?.(accepted.id, acceptedTask);
						}}
						projectId={projectId}
					/>
				</RestoreStageLayout>
			)}
		</main>
	);
}

function restoreHeaderHint(
	operationId: string | undefined,
	operation: BackgroundOperation | undefined
) {
	if (operation?.status === "completed") {
		return "The new project is independent of the archive.";
	}
	if (operationId) {
		return "Progress is also listed in Operations.";
	}
	return "Nothing is created until every check passes.";
}

function RestoreProgress({
	archiveId,
	cover,
	projectId,
	operation,
	verifiedRestore,
	operationId,
	onRestart,
	task,
	listReady,
	listError,
}: {
	archiveId?: string;
	cover: ProjectCoverRecord;
	projectId: string;
	operation?: BackgroundOperation;
	verifiedRestore?: ProjectArchiveRestore;
	operationId: string;
	onRestart: () => void;
	task: RestoreTask;
	listReady: boolean;
	listError: boolean;
}) {
	const queryClient = useQueryClient();
	const archive = useQuery({
		...orpc.projectArchives.get.queryOptions({
			input: { projectId, archiveId: archiveId ?? "" },
		}),
		enabled: Boolean(archiveId && task === "restore"),
		meta: { errorPresentation: "inline" },
	});
	const cancel = useMutation(
		orpc.backgroundOperations.cancel.mutationOptions({
			meta: { errorPresentation: "inline" },
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: orpc.projectArchives.getRestoreOperation.key(),
				}),
		})
	);
	const sourceCover =
		task === "upload"
			? { id: projectId, name: "Portable Project Archive" }
			: cover;
	const completed =
		operation?.status === "completed" && Boolean(verifiedRestore);
	const missingResult = operation?.status === "completed" && !verifiedRestore;
	const failed = operation?.status === "failed";
	const cancelled = operation?.status === "cancelled";
	const stopped = failed || cancelled;
	let status: RestoreStageStatus = "Current";
	if (failed || missingResult || listError) {
		status = "Failed";
	}
	if (cancelled) {
		status = "Cancelled";
	}
	if (completed && verifiedRestore) {
		return (
			<RestoreStageLayout
				active={2}
				cover={sourceCover}
				statuses={["Done", "Done", "Current"]}
			>
				<RestoreResult
					archive={archive.data}
					cover={sourceCover}
					restore={verifiedRestore}
				/>
			</RestoreStageLayout>
		);
	}
	return (
		<RestoreStageLayout
			active={1}
			cover={sourceCover}
			statuses={[
				"Done",
				status,
				stopped || listError || missingResult ? "Not run" : "Waiting",
			]}
		>
			{stopped || missingResult || listError ? (
				<RestoreFailure
					cancelled={cancelled}
					onRestart={onRestart}
					operation={operation}
					operationId={operationId}
					projectId={projectId}
					verificationUnavailable={missingResult || listError}
				/>
			) : (
				<ActiveRestoreProgress
					archive={archive.data}
					cancelPending={cancel.isPending}
					cover={sourceCover}
					listReady={listReady}
					onCancel={(id) => cancel.mutate({ projectId, id })}
					operation={operation}
				/>
			)}
			{listError ? (
				<p className="text-workbench-danger text-sm" role="alert">
					Could not read restore progress. Retrying…
				</p>
			) : null}
			{cancel.isError ? (
				<p className="text-workbench-danger text-sm" role="alert">
					{cancel.error.message}
				</p>
			) : null}
		</RestoreStageLayout>
	);
}

function ActiveRestoreProgress({
	archive,
	cover,
	operation,
	listReady,
	cancelPending,
	onCancel,
}: {
	archive?: ProjectArchive;
	cover: ProjectCoverRecord;
	operation?: BackgroundOperation;
	listReady: boolean;
	cancelPending: boolean;
	onCancel: (id: string) => void;
}) {
	const progress = operation?.progressPercent;
	const excluded = (archive?.manifest.files ?? []).filter(
		(file) =>
			file.presence === "excluded" &&
			(file.kind === "runtime_evidence_file" ||
				file.kind === "rights_evidence_file")
	);
	return (
		<div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
			<div className="flex min-w-0 flex-col gap-3">
				<p className="text-workbench-muted-text truncate font-mono text-[13px]">
					{archive
						? `${cover.name} · ${archiveDate(archive.createdAt)}`
						: "Portable Project Archive"}
				</p>
				<ProjectCover className="h-[140px]" project={cover} />
				<p className="text-workbench-faint-text flex items-center gap-2 font-mono text-[12px] tracking-widest uppercase">
					Source project cover{" "}
					<span className="bg-workbench-border-strong h-px flex-1" />
				</p>
				<div className="bg-workbench-preview border-pixel-edge rounded-[4px] border px-4 py-3 font-mono text-[42px] leading-[44px]">
					{typeof progress === "number" ? (
						<>
							{progress}
							<span className="text-xl">%</span>
						</>
					) : (
						<span className="text-lg">In progress</span>
					)}
				</div>
				<div
					aria-label="Integrity check progress"
					aria-valuemax={100}
					aria-valuemin={0}
					aria-valuenow={progress ?? undefined}
					className="bg-workbench-preview h-[14px] overflow-hidden rounded-[2px]"
					role="progressbar"
				>
					<div
						className={
							typeof progress === "number"
								? "bg-workbench-selection h-full transition-all"
								: "bg-workbench-selection h-full w-1/3 animate-pulse"
						}
						style={
							typeof progress === "number"
								? { width: `${progress}%` }
								: undefined
						}
					/>
				</div>
			</div>
			<div className="bg-workbench-preview flex min-w-0 flex-col gap-3 rounded-[4px] p-3">
				<div className="border-workbench-divider rounded-[4px] border">
					<div className="bg-workbench-panel flex items-center gap-3 px-3 py-3 text-sm">
						<LoaderCircle className="text-workbench-focus size-4 shrink-0 animate-spin" />
						<span className="flex-1 font-semibold">
							{operation?.progressStep ??
								(listReady && !operation
									? "Operation not found yet"
									: "Checking archive…")}
						</span>
						<span className="text-workbench-focus font-mono text-xs">
							Checking…
						</span>
					</div>
					<div className="text-workbench-muted-text border-workbench-divider flex items-center gap-3 border-t px-3 py-3 text-sm">
						<CircleDashed className="size-4" />
						Verified result
						<span className="ml-auto font-mono text-xs">Waiting</span>
					</div>
				</div>
				{excluded.length ? (
					<div className="border-workbench-divider rounded-[4px] border p-3">
						<p className="flex items-center gap-2 text-sm font-semibold">
							<TriangleAlert className="text-workbench-warning size-4" />
							Evidence left out
							<span className="text-workbench-warning ml-auto">
								{excluded.length}
							</span>
						</p>
						<ul className="mt-2 max-h-28 overflow-auto">
							{excluded.map((file) => (
								<li
									className="flex items-center gap-2 py-1 text-xs"
									key={file.sourceId}
								>
									<span className="min-w-0 flex-1 truncate font-mono">
										{file.fileName ?? file.sourceId}
										<span className="text-workbench-muted-text block text-[11px] break-all">
											{file.sourceId} · {file.byteSize} bytes
										</span>
									</span>
									<span className="bg-workbench-warning text-workbench-on-action shrink-0 rounded-[2px] px-1.5 py-0.5">
										Left out
									</span>
								</li>
							))}
						</ul>
						<p className="text-workbench-muted-text mt-2 text-xs">
							Their identity and summary are kept in the archive.
						</p>
					</div>
				) : null}
				<div className="mt-auto flex flex-wrap items-end justify-between gap-3">
					<p className="text-workbench-muted-text max-w-60 text-sm">
						{operation?.status === "cancel_requested"
							? "Cancellation requested. The operation may still complete."
							: "Nothing is created until every check passes."}
					</p>
					{operation && canRequestCancel(operation.status) ? (
						<Button
							className="h-10 rounded-[4px]"
							disabled={cancelPending}
							onClick={() => onCancel(operation.id)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					) : null}
				</div>
			</div>
		</div>
	);
}

function RestoreFailure({
	cancelled,
	verificationUnavailable,
	operation,
	operationId,
	projectId,
	onRestart,
}: {
	cancelled: boolean;
	verificationUnavailable?: boolean;
	operation?: BackgroundOperation;
	operationId: string;
	projectId: string;
	onRestart: () => void;
}) {
	return (
		<div className="space-y-4">
			<div className="border-workbench-danger bg-workbench-danger-wash flex items-start gap-3 rounded-[4px] border p-4">
				<CircleAlert className="text-workbench-danger mt-0.5 size-4 shrink-0" />
				<div>
					<h3 className="font-semibold">
						{cancelled ? "Restore cancelled" : "This archive can’t be restored"}
					</h3>
					<p className="text-workbench-muted-text text-sm">
						{verificationUnavailable
							? "The selected operation or its verified result could not be read."
							: (operation?.failureSummary ??
								(cancelled ? "Restore was cancelled." : "Restore failed."))}
					</p>
				</div>
			</div>
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
				<div className="space-y-3">
					<div className="border-workbench-divider overflow-hidden rounded-[4px] border text-sm">
						<p className="bg-workbench-danger-wash flex items-center justify-between gap-3 p-3">
							<span>Restore verification</span>
							<span className="text-workbench-danger font-mono">
								{cancelled ? "Cancelled" : "Failed"}
							</span>
						</p>
						<p className="text-workbench-muted-text flex items-center justify-between gap-3 p-3">
							<span>Open new project</span>
							<span className="font-mono">Not run</span>
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Link
							className={buttonVariants({ className: "h-10 rounded-[4px]" })}
							onClick={onRestart}
							params={{ projectId }}
							search={{ task: "upload" }}
							to="/projects/$projectId/project-archives"
						>
							<Upload className="size-4" />
							Try another file
						</Link>
						<Link
							className={buttonVariants({
								variant: "outline",
								className: "h-10 rounded-[4px]",
							})}
							to="/projects"
						>
							Back to Projects
						</Link>
					</div>
				</div>
				<OperationReference id={operationId} />
			</div>
		</div>
	);
}

function OperationReference({ id }: { id: string }) {
	const [state, setState] = useState<"copied" | "failed">();
	async function copy() {
		try {
			await navigator.clipboard.writeText(id);
			setState("copied");
		} catch {
			setState("failed");
		}
	}
	return (
		<div className="min-w-0 space-y-2">
			<p className="text-workbench-faint-text flex items-center gap-2 font-mono text-xs tracking-widest uppercase">
				Operation reference{" "}
				<span className="bg-workbench-border-strong h-px flex-1" />
			</p>
			<div className="bg-workbench-preview border-pixel-edge flex items-center gap-2 rounded-[4px] border p-2">
				<p className="min-w-0 flex-1 font-mono text-xs break-all">{id}</p>
				<Button
					className="h-8 rounded-[4px] px-2"
					onClick={() => void copy()}
					type="button"
					variant="outline"
				>
					<Copy className="size-3.5" />
					{state === "copied" ? "Copied" : "Copy"}
				</Button>
			</div>
			<p aria-live="polite" className="text-workbench-muted-text text-sm">
				{state === "failed"
					? "Could not copy. Select the reference to copy it manually."
					: "Quote this reference when you contact support."}
			</p>
		</div>
	);
}

function RestoreResult({
	restore,
	cover,
	archive,
}: {
	restore: ProjectArchiveRestore;
	cover: ProjectCoverRecord;
	archive?: ProjectArchive;
}) {
	const projects = useQuery({
		...orpc.projects.list.queryOptions(),
		refetchOnMount: "always",
	});
	const restored = projects.data?.find(
		(project) => project.id === restore.restoredProjectId
	);
	const sections = restore.sections ?? [];
	const totals = archiveStats(sections);
	return (
		<div className="grid gap-6 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)]">
			<div className="space-y-3">
				<ProjectCover className="h-40" project={restored ?? cover} />
				<p className="text-workbench-faint-text font-mono text-xs tracking-widest uppercase">
					Restored from
				</p>
				<p className="font-mono text-sm">
					{archive
						? `${cover.name} · ${archiveDate(archive.createdAt)}`
						: "Project Archive"}
				</p>
				{archive ? (
					<p className="text-workbench-muted-text font-mono text-xs">
						{includedArchiveSize(archive)} · archive unchanged
					</p>
				) : null}
			</div>
			<div className="flex min-w-0 flex-col gap-3">
				<h3 className="bg-workbench-success text-workbench-on-action flex w-fit items-center gap-2 rounded-[2px] px-2 py-1 text-[12px] font-bold">
					<Check className="size-4" />
					Your new project is ready
				</h3>
				{restored ? (
					<p className="font-heading text-[30px] leading-9 font-bold">
						{restored.name}
					</p>
				) : null}
				<p className="text-workbench-muted-text">
					Restored as a new project. The archive was not changed.
				</p>
				{sections.length ? (
					<ul className="grid grid-cols-2 gap-x-4">
						{totals
							.filter((item) => item.count > 0)
							.map((item) => (
								<li
									className="border-workbench-divider flex items-center gap-2 border-b py-1 text-sm"
									key={item.label}
								>
									<Check className="text-workbench-success size-4" />
									{item.label === "Project Context"
										? item.label
										: `${item.count} ${item.label.toLowerCase()}`}
								</li>
							))}
					</ul>
				) : null}{" "}
				{restore.files?.some((file) => file.presence === "excluded") ? (
					<details className="border-workbench-divider rounded border p-2 text-sm">
						<summary>Evidence and files left out</summary>
						<ul className="max-h-32 overflow-auto">
							{restore.files
								.filter((file) => file.presence === "excluded")
								.map((file) => (
									<li className="py-1 break-all" key={file.sourceId}>
										{file.sourceId} · {file.kind} · {file.byteSize} bytes ·{" "}
										{file.exclusionReason}
									</li>
								))}
						</ul>
					</details>
				) : null}
				<div className="mt-auto flex flex-wrap items-center gap-2">
					<Link
						className={buttonVariants({ className: "h-10 rounded-[4px]" })}
						params={{ projectId: restore.restoredProjectId }}
						to="/projects/$projectId/assets"
					>
						Open project <ArrowRight className="size-4" />
					</Link>
					<Link
						className={buttonVariants({
							variant: "outline",
							className: "h-10 rounded-[4px]",
						})}
						to="/project-archives"
					>
						Back to Project Archive
					</Link>
				</div>
			</div>
		</div>
	);
}
