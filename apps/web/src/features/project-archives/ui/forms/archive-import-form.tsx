import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useId, useRef } from "react";
import { z } from "zod";
import { StatusMessage } from "@/components/status-message";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import type { ArchiveImportAttempt } from "../../lib/upload-project-archive";
import { uploadProjectArchive } from "../../lib/upload-project-archive";

const inputSchema = z.object({
	name: z.string().trim().min(1).max(120),
	file: z.custom<File>((value) => value instanceof File && value.size > 0),
});

export function ArchiveImportForm({
	projectId,
	onAccepted,
}: {
	projectId: string;
	onAccepted?: (operation: BackgroundOperation) => void;
}) {
	const id = useId();
	const pending = useRef<ArchiveImportAttempt | null>(null);
	const upload = useMutation({
		mutationFn: uploadProjectArchive,
		meta: { errorPresentation: "inline" },
		onSuccess: (operation) => onAccepted?.(operation),
	});
	const uncertain = isWriteOutcomeUncertain(upload.error);
	const locked = upload.isPending || uncertain || upload.isSuccess;
	const form = useForm({
		defaultValues: { name: "", file: null as File | null },
		validators: { onSubmit: inputSchema },
		onSubmit: ({ value }) => {
			const parsed = inputSchema.parse(value);
			const previous = pending.current;
			const attempt =
				previous?.file === parsed.file &&
				previous.name === parsed.name &&
				previous.projectId === projectId
					? previous
					: { ...parsed, projectId, idempotencyKey: crypto.randomUUID() };
			pending.current = attempt;
			upload.mutate(attempt);
		},
	});
	return (
		<section
			aria-label="Restore a portable Project Archive"
			className="space-y-3 border p-4"
		>
			<h2>Restore a portable Project Archive</h2>
			<p>
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
						<div>
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
						<div>
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
			{uncertain && pending.current ? (
				<>
					<StatusMessage tone="error">
						The upload outcome is unknown. Retry the same archive and request.
					</StatusMessage>
					<Button
						disabled={upload.isPending}
						onClick={() => {
							if (pending.current) {
								upload.mutate(pending.current);
							}
						}}
						type="button"
					>
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
