import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { orpc } from "@/utils/orpc";
export function ProjectDeletionApproval({
	projectId,
	onAccepted,
}: {
	projectId: string;
	onAccepted: () => void;
}) {
	const queryClient = useQueryClient();
	const impact = useQuery({
		...orpc.projects.deletion.prepare.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
	});
	const [key] = useState(() => crypto.randomUUID());
	const approval = useMutation(
		orpc.projects.deletion.approve.mutationOptions({
			meta: { errorPresentation: "inline" },
			onSuccess: async (job) => {
				queryClient.setQueryData(
					orpc.projects.deletion.job.queryOptions({ input: { projectId } })
						.queryKey,
					job
				);
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: orpc.projects.list.key() }),
					queryClient.invalidateQueries({
						queryKey: orpc.projectContexts.list.key(),
					}),
				]);
				onAccepted();
			},
		})
	);
	const form = useForm({
		defaultValues: { confirmation: "" },
		validators: { onSubmit: z.object({ confirmation: z.string().min(1) }) },
		onSubmit: ({ value }) => {
			if (
				!impact.data ||
				impact.data.blocked ||
				value.confirmation !== impact.data.projectName ||
				approval.isPending
			) {
				return;
			}
			approval.mutate({
				projectId,
				scopeDigest: impact.data.scopeDigest,
				confirmation: value.confirmation,
				idempotencyKey: key,
			});
		},
	});
	if (impact.isLoading) {
		return <p role="status">Preparing deletion impact…</p>;
	}
	if (!impact.data) {
		return (
			<p role="alert">
				Could not prepare project deletion. Refresh and try again.
			</p>
		);
	}
	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<div className="border-workbench-danger/60 bg-workbench-danger-wash rounded border p-4">
				<p className="font-semibold">{impact.data.projectName}</p>
				<p className="text-sm">
					{impact.data.records.reduce((sum, item) => sum + item.count, 0)}{" "}
					records · {impact.data.managedObjects} managed files
				</p>
				<p className="text-sm">
					{impact.data.sharedObjects} shared files retained outside this
					project.
				</p>
			</div>
			<ul className="border-workbench-divider max-h-40 overflow-auto rounded border p-3">
				{impact.data.records.map((item) => (
					<li className="flex justify-between gap-2 text-sm" key={item.kind}>
						<span>{item.kind.replaceAll("_", " ")}</span>
						<span>{item.count}</span>
					</li>
				))}
			</ul>
			<p className="text-workbench-muted-text text-sm">
				Downloaded copies cannot be recalled. Backup purge deadline is not
				published.
			</p>
			{impact.data.blocked ? (
				<p className="text-workbench-danger" role="alert">
					Deletion is blocked by active operations or unverified storage.
					Resolve these and review the impact again.
				</p>
			) : null}
			<form.Field name="confirmation">
				{(field) => (
					<div className="grid gap-2">
						<Label htmlFor="confirm-project-deletion">
							Type the exact project name to confirm
						</Label>
						<Input
							disabled={approval.isPending || impact.data.blocked}
							id="confirm-project-deletion"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						/>
					</div>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.values.confirmation}>
				{(confirmation) => (
					<Button
						disabled={
							approval.isPending ||
							impact.data.blocked ||
							confirmation !== impact.data.projectName
						}
						type="submit"
						variant="destructive"
					>
						{approval.isPending ? "Confirming…" : "Permanently delete project"}
					</Button>
				)}
			</form.Subscribe>
			{approval.isError ? (
				<p className="text-workbench-danger" role="alert">
					{approval.error.message}
				</p>
			) : null}
		</form>
	);
}
