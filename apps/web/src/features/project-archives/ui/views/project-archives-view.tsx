import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import { downloadProjectArchive } from "../../lib/download-project-archive";
import { ArchiveImportForm } from "../forms/archive-import-form";

export function ProjectArchivesView({ projectId }: { projectId: string }) {
	const queryClient = useQueryClient();
	const [submitted, setSubmitted] = useState<{
		projectId: string;
		idempotencyKey: string;
		workingFileIds: string[];
	} | null>(null);
	const [uncertain, setUncertain] = useState(false);
	const options = orpc.projectArchives.list.queryOptions({
		input: { projectId },
	});
	const archives = useQuery({ ...options, refetchInterval: 2000 });
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
			onSuccess: () => {
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
	const createForm = useForm({
		defaultValues: { workingFileIds: [] as string[] },
		onSubmit: ({ value }) => {
			if (uncertain || create.isPending) {
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
		<main>
			<h1>Project Archives</h1>
			<p>Working files are excluded unless selected.</p>
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
			{!!create.data?.id &&
				!operations.data?.operations.some(
					(item) => item.id === create.data?.id
				) && <p role="status">Background Operation: {create.data.status}.</p>}
			{!!operations.error && <p role="alert">{operations.error.message}</p>}
			{operations.data?.operations
				.filter((item) => item.kind === "archive" || item.kind === "restore")
				.map((item) => (
					<p key={item.id} role="status">
						{item.scopeSummary}: {item.status}. {item.progressStep}{" "}
						{item.progressPercent !== null && `${item.progressPercent}%`}{" "}
						{item.resultSummary} {item.failureSummary}
					</p>
				))}
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void createForm.handleSubmit();
				}}
			>
				<fieldset disabled={create.isPending || uncertain}>
					<legend>Include working files</legend>
					{workingFiles.isLoading ? <p>Loading working files…</p> : null}
					{workingFiles.error ? (
						<p role="alert">{workingFiles.error.message}</p>
					) : null}
					{workingFiles.data?.files.length === 0 ? (
						<p>No working files are available.</p>
					) : null}
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
				<Button
					disabled={
						create.isPending ||
						uncertain ||
						workingFiles.isLoading ||
						!!workingFiles.error
					}
					type="submit"
				>
					Create Project Archive
				</Button>
			</form>
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
			{!!archives.isLoading && <p>Loading Project Archives…</p>}
			{!!archives.error && <p role="alert">{archives.error.message}</p>}
			{archives.data?.archives.map((archive) => (
				<Archive
					archiveId={archive.id}
					createdAt={archive.createdAt}
					key={archive.id}
					projectId={projectId}
				/>
			))}
		</main>
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
		<section>
			<h2>Project Archive — {new Date(createdAt).toLocaleString()}</h2>
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
