import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import { isBackgroundOperationActive } from "@sprite-anvil/api/background-operations";
import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { ProjectCover } from "@/components/project-cover";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import { downloadProjectArchive } from "../../lib/download-project-archive";
import { ArchiveImportForm } from "../forms/archive-import-form";
import { ArchiveRestoreWorkflow } from "./archive-restore-workflow";

export function ProjectArchivesView({
	projectId,
	task,
	archiveId,
	operationId,
	onOperationAccepted,
}: {
	projectId: string;
	task?: "create" | "upload" | "restore";
	archiveId?: string;
	operationId?: string;
	onOperationAccepted?: (id: string, task?: "restore" | "upload") => void;
}) {
	if (task === "upload" || task === "restore") {
		return (
			<ArchiveRestoreWorkflow
				archiveId={archiveId}
				initialOperationId={operationId}
				onOperationAccepted={onOperationAccepted}
				projectId={projectId}
				task={task}
			/>
		);
	}
	return (
		<ProjectArchivesContent
			onOperationAccepted={task ? onOperationAccepted : undefined}
			operationId={operationId}
			projectId={projectId}
			task={task}
		/>
	);
}

function ProjectArchivesContent({
	projectId,
	task,
	operationId,
	onOperationAccepted,
}: {
	projectId: string;
	task?: "create";
	operationId?: string;
	onOperationAccepted?: (id: string) => void;
}) {
	const queryClient = useQueryClient();
	const [submitted, setSubmitted] = useState<{
		projectId: string;
		idempotencyKey: string;
		workingFileIds: string[];
	} | null>(null);
	const [uncertain, setUncertain] = useState(false);
	const [pageCursors, setPageCursors] = useState<(string | undefined)[]>([
		undefined,
	]);
	const cursor = pageCursors.at(-1);
	const workingFiles = useQuery(
		orpc.projectArchives.listWorkingFiles.queryOptions({
			input: { projectId, ...(cursor ? { cursor } : {}) },
		})
	);
	const operations = useQuery({
		...orpc.backgroundOperations.list.queryOptions({ input: { projectId } }),
		refetchInterval: 2000,
		refetchOnReconnect: "always",
	});
	const create = useMutation(
		orpc.projectArchives.requestArchive.mutationOptions({
			meta: { errorPresentation: "inline" },
			onSuccess: (operation) => {
				onOperationAccepted?.(operation.id);
				setUncertain(false);
				setSubmitted(null);
				void queryClient.invalidateQueries({
					queryKey: orpc.backgroundOperations.list.queryOptions({
						input: { projectId },
					}).queryKey,
				});
			},
			onError: (error) => setUncertain(isWriteOutcomeUncertain(error)),
		})
	);
	const trackingId = operationId ?? create.data?.id;
	const tracked =
		operations.data?.operations.find((item) => item.id === trackingId) ??
		create.data;
	const creating =
		create.isPending || isTrackedArchiveActive(trackingId, tracked);
	const locked = creating || uncertain;
	const createForm = useForm({
		defaultValues: { workingFileIds: [] as string[] },
		onSubmit: ({ value }) => {
			if (locked) {
				return;
			}
			const input = {
				projectId,
				idempotencyKey: crypto.randomUUID(),
				workingFileIds: value.workingFileIds,
			};
			setSubmitted(input);
			create.mutate(input);
		},
	});
	return (
		<main className="bg-workbench-sidebar h-full min-h-0 space-y-5 overflow-y-auto px-4 py-7 sm:px-8">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="font-heading text-[30px] leading-9 font-bold">
					{task === "create" ? "Create archive" : "Project Archives"}
				</h1>
				{task ? (
					<Link
						className={buttonVariants({ variant: "outline" })}
						to="/project-archives"
					>
						<ArrowLeft /> Back to Project Archive
					</Link>
				) : null}
			</header>
			{task ? null : (
				<p className="text-body text-workbench-muted-text">
					Working files are excluded unless selected.
				</p>
			)}
			{task ? null : (
				<ArchiveImportForm
					onAccepted={() => {
						void queryClient.invalidateQueries({
							queryKey: orpc.backgroundOperations.list.queryOptions({
								input: { projectId },
							}).queryKey,
						});
					}}
					projectId={projectId}
				/>
			)}
			<ArchiveOperationStatus
				accepted={create.data}
				error={operations.error}
				focused={Boolean(task)}
				operations={operations.data?.operations}
				trackingId={trackingId}
			/>
			<div
				className={
					task
						? "grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
						: undefined
				}
			>
				{task ? <ArchiveCreationIntro projectId={projectId} /> : null}
				<form
					className="border-workbench-divider bg-workbench-background flex flex-col gap-4 rounded-[4px] border p-7"
					onSubmit={(event) => {
						event.preventDefault();
						void createForm.handleSubmit();
					}}
				>
					{task ? (
						<>
							<div className="border-pixel-edge bg-workbench-preview rounded-[4px] border p-4">
								<p className="text-workbench-faint-text font-mono text-[12px] tracking-widest uppercase">
									Estimated size
								</p>
								<p className="font-heading mt-2 text-2xl font-semibold">
									Calculated when the archive is created.
								</p>
							</div>
							<h2 className="font-heading text-[24px] font-bold">
								Archive contents
							</h2>
							<p className="text-workbench-muted-text">
								Project, Project Context, assets and history are included.
								Working Files are included only when selected. Large runtime
								evidence remains excluded; its identity and summary are recorded
								in the archive.
							</p>
						</>
					) : null}
					<fieldset className="grid gap-3" disabled={locked}>
						<legend className="font-heading text-heading-compact mb-3 font-bold">
							Include working files
						</legend>
						<WorkingFileStatus
							empty={workingFiles.data?.files.length === 0}
							error={workingFiles.error}
							loading={workingFiles.isLoading}
						/>
						<createForm.Field name="workingFileIds">
							{(field) =>
								workingFiles.data?.files.map((file) => (
									<Label key={file.id}>
										<Checkbox
											checked={field.state.value.includes(file.id)}
											disabled={!file.available}
											onCheckedChange={(checked) =>
												field.handleChange(
													checked
														? [...field.state.value, file.id]
														: field.state.value.filter((id) => id !== file.id)
												)
											}
										/>
										{file.fileName} — {file.byteSize} bytes — Version{" "}
										{file.assetVersionId}
										{file.available ? "" : " (unavailable)"}
									</Label>
								))
							}
						</createForm.Field>
						{pageCursors.length > 1 ? (
							<Button
								onClick={() => setPageCursors((pages) => pages.slice(0, -1))}
								type="button"
							>
								Previous working files
							</Button>
						) : null}
						{workingFiles.data?.nextCursor ? (
							<Button
								onClick={() =>
									setPageCursors((pages) => [
										...pages,
										workingFiles.data?.nextCursor ?? undefined,
									])
								}
								type="button"
							>
								More working files
							</Button>
						) : null}
					</fieldset>
					<ArchiveCreateFooter
						creating={creating}
						disabled={
							locked || workingFiles.isLoading || Boolean(workingFiles.error)
						}
						focused={Boolean(task)}
					/>
				</form>
			</div>
			{uncertain && !!submitted && (
				<>
					<p role="alert">
						The creation outcome is unknown. Retry the same creation.
					</p>
					<Button
						disabled={create.isPending}
						onClick={() => create.mutate(submitted)}
					>
						Retry creation
					</Button>
				</>
			)}
			{!!create.error && !uncertain && (
				<p role="alert">{create.error.message}</p>
			)}
			{task ? null : <ArchiveCatalog projectId={projectId} />}
		</main>
	);
}

function WorkingFileStatus({
	loading,
	error,
	empty,
}: {
	loading: boolean;
	error: Error | null;
	empty: boolean;
}) {
	return (
		<>
			{loading ? <p>Loading working files…</p> : null}
			{error ? <p role="alert">{error.message}</p> : null}
			{empty ? <p>No working files are available.</p> : null}
		</>
	);
}

function isTrackedArchiveActive(
	id: string | undefined,
	operation: BackgroundOperation | undefined
) {
	return Boolean(
		id && (!operation || isBackgroundOperationActive(operation.status))
	);
}

function ArchiveCreateFooter({
	focused,
	creating,
	disabled,
}: {
	focused: boolean;
	creating: boolean;
	disabled: boolean;
}) {
	return (
		<>
			<div className="mt-auto flex flex-wrap items-center gap-2">
				<Button disabled={disabled} type="submit">
					{archiveCreateLabel(focused, creating)}
				</Button>
				{focused ? (
					<Link
						className={buttonVariants({ variant: "outline" })}
						to="/project-archives"
					>
						{creating ? "Back to Project Archive" : "Cancel"}
					</Link>
				) : null}
			</div>
			{focused ? (
				<p className="text-workbench-muted-text text-[14px]">
					Runs in the background. Follow progress in Operations.
				</p>
			) : null}
		</>
	);
}

function archiveCreateLabel(focused: boolean, creating: boolean) {
	if (creating) {
		return "Creating…";
	}
	return focused ? "Create archive" : "Create Project Archive";
}

function ArchiveOperationStatus({
	trackingId,
	accepted,
	operations = [],
	error,
	focused,
}: {
	accepted?: BackgroundOperation;
	trackingId?: string;
	operations?: BackgroundOperation[];
	error: Error | null;
	focused: boolean;
}) {
	return (
		<>
			{!!accepted?.id &&
				!operations.some((item) => item.id === accepted?.id) && (
					<p role="status">Background Operation: {accepted.status}.</p>
				)}
			{!!error && <p role="alert">{error.message}</p>}
			{operations
				.filter((item) =>
					focused
						? item.id === trackingId
						: item.kind === "archive" || item.kind === "restore"
				)
				.map((item) => (
					<div
						className={
							focused ? "bg-workbench-background rounded-[4px] p-4" : undefined
						}
						key={item.id}
					>
						<p role="status">
							{item.scopeSummary}: {item.status}. {item.progressStep}{" "}
							{item.progressPercent !== null && `${item.progressPercent}%`}{" "}
							{item.resultSummary} {item.failureSummary}
						</p>
						{focused && typeof item.progressPercent === "number" ? (
							<div
								aria-label="Archive progress"
								aria-valuemax={100}
								aria-valuemin={0}
								aria-valuenow={item.progressPercent}
								className="bg-workbench-preview mt-3 h-2 overflow-hidden rounded-full"
								role="progressbar"
							>
								<div
									className="bg-workbench-action h-full"
									style={{ width: `${item.progressPercent}%` }}
								/>
							</div>
						) : null}
					</div>
				))}
		</>
	);
}

function ArchiveCatalog({ projectId }: { projectId: string }) {
	const options = orpc.projectArchives.list.queryOptions({
		input: { projectId },
	});
	const archives = useQuery({ ...options, refetchInterval: 2000 });
	return (
		<>
			{!!archives.isLoading && <p>Loading Project Archives…</p>}
			{!!archives.error && <p role="alert">{archives.error.message}</p>}
			{archives.data?.archives.length === 0 ? (
				<div className="rounded-card border-workbench-border-strong bg-workbench-strip border border-dashed p-8 text-center">
					<h2 className="font-heading text-heading-compact font-bold">
						No archives yet
					</h2>
					<p className="text-workbench-muted-text">
						Create a Project Archive or upload a previously downloaded file.
					</p>
				</div>
			) : null}
			{archives.data?.archives.map((archive) => (
				<Archive
					archiveId={archive.id}
					createdAt={archive.createdAt}
					key={archive.id}
					projectId={projectId}
				/>
			))}
		</>
	);
}

function ArchiveCreationIntro({ projectId }: { projectId: string }) {
	const projects = useQuery(orpc.projects.list.queryOptions());
	const project = projects.data?.find((item) => item.id === projectId);
	return (
		<section className="bg-workbench-background ring-workbench-panel-hover flex min-h-[460px] flex-col gap-4 rounded-[4px] p-2 ring-1 lg:min-h-[calc(100svh-172px)]">
			{project ? (
				<ProjectCover className="min-h-56 flex-1" framed project={project} />
			) : null}
			<div className="space-y-3 px-4 py-4">
				<p className="text-workbench-faint-text font-mono text-[12px] tracking-widest uppercase">
					Archive of
				</p>
				<h2 className="font-heading text-[40px] leading-[44px] font-bold">
					{project?.name ?? "Project"}
				</h2>
				<p className="text-workbench-muted-text">
					Snapshot of now. A copy of the project as it is. The project keeps
					working.
				</p>
			</div>
		</section>
	);
}

function Archive({
	projectId,
	archiveId,
	createdAt,
}: {
	projectId: string;
	archiveId: string;
	createdAt: string;
}) {
	const download = useMutation({
		mutationFn: () => downloadProjectArchive(projectId, archiveId),
		meta: { errorPresentation: "inline" },
	});
	const archive = useQuery(
		orpc.projectArchives.get.queryOptions({ input: { projectId, archiveId } })
	);
	const [submitted, setSubmitted] = useState<{
		projectId: string;
		archiveId: string;
		name: string;
		idempotencyKey: string;
	} | null>(null);
	const [uncertain, setUncertain] = useState(false);
	const restore = useMutation(
		orpc.projectArchives.requestRestore.mutationOptions({
			meta: { errorPresentation: "inline" },
			onSuccess: () => setUncertain(false),
			onError: (error) => setUncertain(isWriteOutcomeUncertain(error)),
		})
	);
	const operations = useQuery({
		...orpc.backgroundOperations.list.queryOptions({ input: { projectId } }),
		refetchInterval: 2000,
		refetchOnReconnect: "always",
	});
	const operation =
		operations.data?.operations.find((item) => item.id === restore.data?.id) ??
		restore.data;
	const form = useForm({
		defaultValues: { name: "" },
		validators: {
			onSubmit: z.object({ name: z.string().trim().min(1).max(120) }),
		},
		onSubmit: ({ value }) => {
			if (uncertain || restore.isPending) {
				return;
			}
			const input = {
				projectId,
				archiveId,
				name: value.name.trim(),
				idempotencyKey: crypto.randomUUID(),
			};
			setSubmitted(input);
			restore.mutate(input);
		},
	});
	return (
		<section className="border-workbench-divider bg-workbench-background flex flex-col gap-4 rounded-[4px] border p-7">
			<h2 className="font-heading text-heading-compact font-bold">
				Project Archive — {new Date(createdAt).toLocaleString()}
			</h2>
			{!!archive.error && <p role="alert">{archive.error.message}</p>}
			{!!archive.data && (
				<p>
					Included files:{" "}
					{
						archive.data.manifest.files.filter(
							(file) => file.presence === "included"
						).length
					}
					. Excluded files:{" "}
					{
						archive.data.manifest.files.filter(
							(file) => file.presence === "excluded"
						).length
					}
					.
				</p>
			)}
			<Button
				disabled={download.isPending || !archive.data}
				onClick={() => download.mutate()}
			>
				Download Project Archive
			</Button>
			{download.error ? <p role="alert">{download.error.message}</p> : null}
			<p>Restore creates a new independent project.</p>
			<form
				className="border-workbench-divider grid gap-3 border-t pt-4"
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name="name">
					{(field) => (
						<>
							<label htmlFor={`name-${archiveId}`}>New project name</label>
							<Input
								disabled={uncertain || restore.isPending}
								id={`name-${archiveId}`}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
							{field.state.meta.errors.length > 0 && (
								<p role="alert">Enter a project name (up to 120 characters).</p>
							)}
						</>
					)}
				</form.Field>
				<Button disabled={restore.isPending || uncertain} type="submit">
					Restore
				</Button>
			</form>
			{uncertain && !!submitted && (
				<>
					<p role="alert">
						The restore outcome is unknown. Retry the same restore.
					</p>
					<Button
						disabled={restore.isPending}
						onClick={() => restore.mutate(submitted)}
					>
						Retry restore
					</Button>
				</>
			)}
			{!!restore.error && !uncertain && (
				<p role="alert">{restore.error.message}</p>
			)}
			{!!operations.error && <p role="alert">{operations.error.message}</p>}
			{!!operation && (
				<p role="status">
					Background Operation: {operation.status}. {operation.progressStep}{" "}
					{operation.progressPercent !== null &&
						`${operation.progressPercent}%`}{" "}
					{operation.resultSummary} {operation.failureSummary}
				</p>
			)}
		</section>
	);
}
