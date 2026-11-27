import type { ProjectDeletionJob } from "@sprite-anvil/api/project-deletion";
import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@sprite-anvil/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { ProjectDeletionApproval } from "../forms/project-deletion-approval";

export function ProjectDeletionPanel({ projectId }: { projectId: string }) {
	const [open, setOpen] = useState(false);
	return (
		<section className="mt-auto space-y-3 pt-6">
			<h2 className="text-workbench-danger-soft flex items-center gap-3 font-mono text-[12px] tracking-widest uppercase">
				Danger zone
				<span className="bg-workbench-danger/40 h-px flex-1" />
			</h2>
			<div className="flex flex-wrap items-center gap-3">
				<p className="text-workbench-muted-text min-w-[160px] flex-1 text-sm">
					Deleting asks for confirmation and runs through the permanent deletion
					flow.
				</p>
				<Dialog onOpenChange={setOpen} open={open}>
					<DialogTrigger
						render={
							<Button
								className="border-workbench-danger text-workbench-danger-soft h-10 rounded-[4px]"
								type="button"
								variant="outline"
							/>
						}
					>
						<Trash2 className="size-4" />
						Delete project…
					</DialogTrigger>
					<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-auto sm:max-w-[560px]">
						<DialogHeader>
							<DialogTitle>Delete project</DialogTitle>
							<DialogDescription>
								Review the exact impact before you confirm. This cannot be
								undone.
							</DialogDescription>
						</DialogHeader>
						{open ? (
							<ProjectDeletionApproval
								onAccepted={() => setOpen(false)}
								projectId={projectId}
							/>
						) : null}
					</DialogContent>
				</Dialog>
			</div>
		</section>
	);
}

export function ProjectDeletionTracker({ projectId }: { projectId: string }) {
	const job = useQuery({
		...orpc.projects.deletion.job.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
		refetchInterval: (query) =>
			query.state.data?.state === "completed" ? false : 2000,
	});
	if (job.isLoading) {
		return <p role="status">Checking deletion job…</p>;
	}
	if (job.isError || !job.data) {
		return <p role="alert">Project details are not available.</p>;
	}
	return <ProjectDeletionJobCard job={job.data} />;
}

function ProjectDeletionJobCard({ job }: { job: ProjectDeletionJob }) {
	const completed = job.state === "completed";
	const queryClient = useQueryClient();
	const retry = useMutation(
		orpc.projects.deletion.retry.mutationOptions({
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries({
						queryKey: orpc.projects.deletion.job.key(),
					}),
					queryClient.invalidateQueries({
						queryKey: orpc.projects.deletion.list.key(),
					}),
				]),
		})
	);
	return (
		<section className="bg-workbench-background border-workbench-divider space-y-3 rounded border p-6">
			<h2 className="font-heading text-2xl font-bold">
				{completed ? "Project deleted" : "Project deletion job"}
			</h2>
			<p className="text-sm">Receipt reference: {job.id}</p>
			<p role="status">
				{completed
					? "Managed project records and approved files have been removed."
					: (job.operation?.progressStep ?? job.operation?.status ?? job.state)}
			</p>
			{job.operation?.failureSummary ? (
				<p className="text-workbench-danger" role="alert">
					{job.operation.failureSummary}
				</p>
			) : null}{" "}
			{job.operation?.status === "failed" &&
			job.state !== "rejected" &&
			job.state !== "completed" ? (
				<Button
					disabled={retry.isPending}
					onClick={() => retry.mutate({ jobId: job.id })}
					type="button"
					variant="outline"
				>
					Retry deletion
				</Button>
			) : null}
			<p className="text-workbench-muted-text text-sm">
				Backup cleanup deadline is not published. Downloaded copies cannot be
				recalled.
			</p>
		</section>
	);
}

export function ProjectDeletionHistory() {
	const [open, setOpen] = useState(false);
	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger
				render={
					<Button
						className="h-10 rounded-[4px]"
						type="button"
						variant="outline"
					/>
				}
			>
				Deletion jobs
			</DialogTrigger>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-auto sm:max-w-[640px]">
				<DialogHeader>
					<DialogTitle>Project deletion jobs</DialogTitle>
					<DialogDescription>
						Track confirmed project deletion requests and receipts.
					</DialogDescription>
				</DialogHeader>
				{open ? <DeletionHistoryList /> : null}
			</DialogContent>
		</Dialog>
	);
}
function DeletionHistoryList() {
	const jobs = useQuery({
		...orpc.projects.deletion.list.queryOptions(),
		meta: { errorPresentation: "inline" },
		refetchInterval: 2000,
	});
	if (jobs.isLoading) {
		return <p role="status">Loading deletion jobs…</p>;
	}
	if (jobs.isError) {
		return <p role="alert">Deletion jobs could not be loaded.</p>;
	}
	if (!jobs.data?.length) {
		return <p>No deletion jobs yet.</p>;
	}
	return (
		<div className="space-y-3">
			{jobs.data.map((job) => (
				<div key={job.id}>
					<ProjectDeletionJobCard job={job} />
					<Link
						className={buttonVariants({
							variant: "outline",
							className: "mt-2",
						})}
						params={{ projectId: job.projectId }}
						to="/projects/$projectId/details"
					>
						Open job
					</Link>
				</div>
			))}
		</div>
	);
}
