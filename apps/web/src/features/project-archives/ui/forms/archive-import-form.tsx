import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import { z } from "zod";
import { StatusMessage } from "@/components/status-message";
import { isZip, useArchiveImport } from "../../hooks/use-archive-import";

const inputSchema = z.object({
	name: z.string().trim().min(1).max(120),
	file: z.custom<File>((value) => value instanceof File && isZip(value)),
});

export function ArchiveImportForm({
	projectId,
	onAccepted,
}: {
	projectId: string;
	onAccepted?: (operation: BackgroundOperation) => void;
}) {
	const id = useId();
	const { upload, uncertain, locked, submit, retry } = useArchiveImport(
		projectId,
		onAccepted
	);
	const form = useForm({
		defaultValues: { name: "", file: null as File | null },
		validators: { onSubmit: inputSchema },
		onSubmit: ({ value }) => {
			submit(inputSchema.parse(value));
		},
	});
	return (
		<section
			aria-label="Restore a portable Project Archive"
			className="rounded-card border-workbench-divider bg-workbench-strip space-y-4 border p-5"
		>
			<h2 className="font-heading text-heading-compact font-bold">
				Restore a portable Project Archive
			</h2>
			<p className="text-body text-workbench-muted-text">
				Upload a previously downloaded ZIP to create an independent project. Its
				original project does not need to exist.
			</p>
			<form
				className="space-y-3"
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name="file">
					{(field) => (
						<div className="rounded-card border-workbench-border-strong bg-workbench-preview grid gap-3 border border-dashed p-5">
							<Label htmlFor={`${id}-file`}>Project Archive ZIP</Label>
							<Input
								accept=".zip,application/zip"
								disabled={locked}
								id={`${id}-file`}
								onChange={(event) =>
									field.handleChange(event.target.files?.[0] ?? null)
								}
								type="file"
							/>
						</div>
					)}
				</form.Field>
				<form.Field name="name">
					{(field) => (
						<div className="grid gap-2">
							<Label htmlFor={`${id}-name`}>Restored project name</Label>
							<Input
								disabled={locked}
								id={`${id}-name`}
								maxLength={120}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</div>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => state.errors}>
					{(errors) =>
						errors.length > 0 ? (
							<StatusMessage tone="error">
								Choose a non-empty ZIP and enter a project name (up to 120
								characters).
							</StatusMessage>
						) : null
					}
				</form.Subscribe>
				<Button disabled={locked} type="submit">
					Upload and restore
				</Button>
			</form>
			{uncertain ? (
				<>
					<StatusMessage tone="error">
						The upload outcome is unknown. Retry the same archive and request.
					</StatusMessage>
					<Button disabled={upload.isPending} onClick={retry} type="button">
						Retry archive import
					</Button>
				</>
			) : null}
			{upload.isError && !uncertain ? (
				<StatusMessage tone="error">{upload.error.message}</StatusMessage>
			) : null}
			{upload.isSuccess ? (
				<StatusMessage tone="info">
					Restore requested. Follow its progress in Background Operations.
				</StatusMessage>
			) : null}
		</section>
	);
}
