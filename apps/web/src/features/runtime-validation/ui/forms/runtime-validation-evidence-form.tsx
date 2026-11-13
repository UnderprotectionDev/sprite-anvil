import {
	runtimeValidationEvidenceKinds,
	runtimeValidationEvidenceSources,
} from "@sprite-anvil/api/runtime-validation";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type SyntheticEvent, useRef, useState } from "react";
import { FieldErrors, fieldErrorAttributes } from "@/components/field-errors";
import { StatusMessage } from "@/components/status-message";
import { errorCodeOf } from "@/utils/error-code";
import {
	useAddRuntimeValidationTextEvidence,
	useUploadRuntimeValidationEvidenceFile,
} from "../../hooks/use-runtime-validation-writes";
import { RuntimeValidationUploadError } from "../../lib/runtime-validation-api";
import {
	errorMessageOf,
	evidenceKindLabels,
	evidenceSourceLabels,
} from "../../lib/runtime-validation-labels";
import { runtimeValidationEvidenceFormSchema } from "../../schemas";

export function RuntimeValidationEvidenceForm({
	projectId,
	recordId,
}: {
	projectId: string;
	recordId: string;
}) {
	const addText = useAddRuntimeValidationTextEvidence();
	const upload = useUploadRuntimeValidationEvidenceFile();
	const fileInput = useRef<HTMLInputElement>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const idempotencyKey = useRef(crypto.randomUUID());

	const form = useForm({
		defaultValues: {
			file: null as File | null,
			kind: "observation" as (typeof runtimeValidationEvidenceKinds)[number],
			source: "manual" as (typeof runtimeValidationEvidenceSources)[number],
			text: "",
		},
		onSubmit: async ({ value }) => {
			setFailure(null);
			try {
				if (value.file) {
					// An observation with a file never reaches here: the form schema refuses it with a message.
					await upload.mutateAsync({
						file: value.file,
						idempotencyKey: idempotencyKey.current,
						kind: value.kind,
						projectId,
						recordId,
						source: value.source,
					});
				} else if (
					value.kind === "test_result" ||
					value.kind === "observation"
				) {
					await addText.mutateAsync({
						idempotencyKey: idempotencyKey.current,
						kind: value.kind,
						projectId,
						recordId,
						source: value.source,
						text: value.text,
					});
				}
				idempotencyKey.current = crypto.randomUUID();
				form.reset();
				if (fileInput.current) {
					fileInput.current.value = "";
				}
			} catch (error) {
				const settled =
					errorCodeOf(error) !== undefined ||
					(error instanceof RuntimeValidationUploadError &&
						!error.outcomeUncertain);
				if (settled) {
					idempotencyKey.current = crypto.randomUUID();
				}
				setFailure(
					errorMessageOf(error) ?? "The evidence could not be saved. Try again."
				);
			}
		},
		validators: { onSubmit: runtimeValidationEvidenceFormSchema },
	});

	const submit = (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		void form.handleSubmit();
	};
	const inputId = (name: string) => `runtime-validation-${recordId}-${name}`;

	return (
		<form
			aria-label="Add evidence"
			className="space-y-4 border-t pt-4"
			onSubmit={submit}
		>
			<h4 className="font-medium">Add evidence</h4>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor={inputId("kind")}>Kind</Label>
					<form.Field name="kind">
						{(field) => (
							<NativeSelect
								className="w-full [&>select]:min-h-10"
								id={inputId("kind")}
								onChange={(event) =>
									field.handleChange(
										event.target.value as typeof field.state.value
									)
								}
								value={field.state.value}
							>
								{runtimeValidationEvidenceKinds.map((kind) => (
									<NativeSelectOption key={kind} value={kind}>
										{evidenceKindLabels[kind]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						)}
					</form.Field>
				</div>
				<div className="space-y-2">
					<Label htmlFor={inputId("source")}>Source</Label>
					<form.Field name="source">
						{(field) => (
							<NativeSelect
								className="w-full [&>select]:min-h-10"
								id={inputId("source")}
								onChange={(event) =>
									field.handleChange(
										event.target.value as typeof field.state.value
									)
								}
								value={field.state.value}
							>
								{runtimeValidationEvidenceSources.map((source) => (
									<NativeSelectOption key={source} value={source}>
										{evidenceSourceLabels[source]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						)}
					</form.Field>
				</div>
			</div>
			<div className="space-y-2">
				<Label htmlFor={inputId("text")}>Observation or test result text</Label>
				<form.Field name="text">
					{(field) => (
						<>
							<Textarea
								className="min-h-24"
								id={inputId("text")}
								maxLength={10_000}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
								{...fieldErrorAttributes(
									inputId("text"),
									field.state.meta.errors
								)}
							/>
							<FieldErrors
								errors={field.state.meta.errors}
								fieldId={inputId("text")}
							/>
						</>
					)}
				</form.Field>
			</div>
			<div className="space-y-2">
				<Label htmlFor={inputId("file")}>
					Screenshot, recording or test result file (up to 5 MiB)
				</Label>
				<form.Field name="file">
					{(field) => (
						<>
							<Input
								className="min-h-10"
								id={inputId("file")}
								onChange={(event) =>
									field.handleChange(event.target.files?.[0] ?? null)
								}
								ref={fileInput}
								type="file"
								{...fieldErrorAttributes(
									inputId("file"),
									field.state.meta.errors
								)}
							/>
							<FieldErrors
								errors={field.state.meta.errors}
								fieldId={inputId("file")}
							/>
						</>
					)}
				</form.Field>
			</div>
			{failure ? <StatusMessage tone="error">{failure}</StatusMessage> : null}
			<Button
				className="min-h-11"
				disabled={addText.isPending || upload.isPending}
				type="submit"
			>
				Add evidence
			</Button>
		</form>
	);
}
