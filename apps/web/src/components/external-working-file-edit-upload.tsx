import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { useForm, useSelector } from "@tanstack/react-form";
import type {
	DragEvent,
	ClipboardEvent as ReactClipboardEvent,
	SyntheticEvent,
} from "react";
import { useId, useRef, useState } from "react";
import type z from "zod";
import { StatusMessage } from "@/components/status-message";
import {
	candidateExportFileSchema,
	externalWorkingFileEditFormSchema,
	fileSelectionError,
	managedSnapshotFileSchema,
} from "@/features/production-provenance/schemas";

interface ExternalWorkingFileEditUploadProps {
	disabled?: boolean;
	onImport: (candidateFile: File, sourceFile: File) => Promise<boolean>;
}

function droppedFile(event: DragEvent<HTMLElement>) {
	event.preventDefault();
	return event.dataTransfer.files.item(0);
}

function pastedFile(event: ReactClipboardEvent<HTMLElement>) {
	const file = event.clipboardData.files.item(0);
	if (file) {
		event.preventDefault();
	}
	return file;
}

export function ExternalWorkingFileEditUpload({
	disabled = false,
	onImport,
}: ExternalWorkingFileEditUploadProps) {
	const [error, setError] = useState<string | null>(null);
	const candidateInputRef = useRef<HTMLInputElement>(null);
	const sourceInputRef = useRef<HTMLInputElement>(null);
	const hintId = useId();
	const form = useForm({
		defaultValues: {
			candidateFile: null as File | null,
			sourceFile: null as File | null,
		},
		onSubmit: async ({ formApi, value }) => {
			const { candidateFile, sourceFile } = value;
			if (!(candidateFile && sourceFile)) {
				return;
			}
			setError(null);
			try {
				if (await onImport(candidateFile, sourceFile)) {
					formApi.reset();
					if (candidateInputRef.current) {
						candidateInputRef.current.value = "";
					}
					if (sourceInputRef.current) {
						sourceInputRef.current.value = "";
					}
				} else {
					setError("Upload did not complete. Retry with the same files.");
				}
			} catch {
				setError("Could not import files. Try again.");
			}
		},
		validators: { onSubmit: externalWorkingFileEditFormSchema },
	});
	const busy = useSelector(form.store, (state) => state.isSubmitting);
	const values = useSelector(form.store, (state) => state.values);

	function selectFile(
		file: File | null,
		schema: z.ZodType<File>,
		handleChange: (file: File | null) => void
	) {
		if (!file) {
			return;
		}
		setError(null);
		const selectionError = fileSelectionError(schema, file);
		handleChange(selectionError ? null : file);
		setError(selectionError);
	}

	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		event.stopPropagation();
		if (disabled || busy) {
			return;
		}
		void form.handleSubmit();
	}

	return (
		<form className="w-full space-y-3 rounded-md border p-3" onSubmit={submit}>
			<div>
				<p className="text-sm font-medium">External working file edit</p>
				<p className="text-muted-foreground text-xs">
					Save the PNG/WebP export as a Candidate Version and the editable
					source file as a Managed Snapshot together.
				</p>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<form.Field name="candidateFile">
					{(field) => (
						<div className="space-y-1">
							<p className="text-sm font-medium">PNG/WebP export</p>
							<Button
								aria-describedby={`${hintId}-candidate`}
								aria-label="Select, drop, or paste PNG/WebP export"
								className="min-h-11 w-full justify-start border-dashed px-3 py-2 text-left text-sm font-normal"
								disabled={disabled || busy}
								onClick={() => candidateInputRef.current?.click()}
								onDragOver={(event) => event.preventDefault()}
								onDrop={(event) =>
									selectFile(
										droppedFile(event),
										candidateExportFileSchema,
										field.handleChange
									)
								}
								onPaste={(event) =>
									selectFile(
										pastedFile(event),
										candidateExportFileSchema,
										field.handleChange
									)
								}
								type="button"
								variant="outline"
							>
								{field.state.value?.name ?? "Select, drop, or paste file"}
							</Button>
							<p className="sr-only" id={`${hintId}-candidate`}>
								Select, drop, or paste a PNG or WebP file from the clipboard.
							</p>
							<Input
								accept="image/png,image/webp"
								aria-label="PNG/WebP export"
								className="sr-only h-px w-px border-0 p-0"
								disabled={disabled || busy}
								onChange={(event) => {
									const file = event.currentTarget.files?.[0] ?? null;
									event.currentTarget.value = "";
									selectFile(
										file,
										candidateExportFileSchema,
										field.handleChange
									);
								}}
								ref={candidateInputRef}
								type="file"
							/>
						</div>
					)}
				</form.Field>
				<form.Field name="sourceFile">
					{(field) => (
						<div className="space-y-1">
							<p className="text-sm font-medium">Editable working file</p>
							<Button
								aria-describedby={`${hintId}-source`}
								aria-label="Select, drop, or paste editable working file"
								className="min-h-11 w-full justify-start border-dashed px-3 py-2 text-left text-sm font-normal"
								disabled={disabled || busy}
								onClick={() => sourceInputRef.current?.click()}
								onDragOver={(event) => event.preventDefault()}
								onDrop={(event) =>
									selectFile(
										droppedFile(event),
										managedSnapshotFileSchema,
										field.handleChange
									)
								}
								onPaste={(event) =>
									selectFile(
										pastedFile(event),
										managedSnapshotFileSchema,
										field.handleChange
									)
								}
								type="button"
								variant="outline"
							>
								{field.state.value?.name ?? "Select, drop, or paste file"}
							</Button>
							<p className="sr-only" id={`${hintId}-source`}>
								Select, drop, or paste the editable working file from the
								clipboard.
							</p>
							<Input
								accept="*/*"
								aria-label="Editable working file"
								className="sr-only h-px w-px border-0 p-0"
								disabled={disabled || busy}
								onChange={(event) => {
									const file = event.currentTarget.files?.[0] ?? null;
									event.currentTarget.value = "";
									selectFile(
										file,
										managedSnapshotFileSchema,
										field.handleChange
									);
								}}
								ref={sourceInputRef}
								type="file"
							/>
						</div>
					)}
				</form.Field>
			</div>
			{error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
			<Button
				disabled={
					disabled || busy || !values.candidateFile || !values.sourceFile
				}
				type="submit"
			>
				{busy
					? "Saving Candidate Version and Managed Snapshot…"
					: "Save Candidate Version and Managed Snapshot"}
			</Button>
		</form>
	);
}
