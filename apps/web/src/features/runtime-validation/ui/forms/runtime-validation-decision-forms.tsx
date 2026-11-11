import {
	runtimeValidationConfirmedFailureSources,
	runtimeValidationOutcomes,
} from "@sprite-anvil/api/runtime-validation-decisions";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type SyntheticEvent, useRef, useState } from "react";
import { errorCodeOf } from "@/utils/error-code";
import {
	useConfirmRuntimeValidationFailureSource,
	useFinalizeRuntimeValidationOutcome,
} from "../../hooks/use-runtime-validation-writes";
import {
	errorMessageOf,
	failureSourceLabels,
	outcomeLabels,
} from "../../lib/runtime-validation-labels";
import {
	runtimeValidationFailureSourceFormSchema,
	runtimeValidationOutcomeFormSchema,
} from "../../schemas";
import { FieldErrors, fieldErrorAttributes } from "../components/field-errors";

function preventAndSubmit(submit: () => Promise<unknown>) {
	return (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		void submit();
	};
}

/** The user alone decides the outcome; the first decision is final, so a changed result is a new record. */
export function RuntimeValidationOutcomeForm({
	projectId,
	recordId,
}: {
	projectId: string;
	recordId: string;
}) {
	const finalize = useFinalizeRuntimeValidationOutcome();
	const [failure, setFailure] = useState<string | null>(null);
	const idempotencyKey = useRef(crypto.randomUUID());

	const form = useForm({
		defaultValues: {
			outcome: "" as "" | (typeof runtimeValidationOutcomes)[number],
		},
		onSubmit: async ({ value }) => {
			setFailure(null);
			if (value.outcome === "") {
				return;
			}
			try {
				await finalize.mutateAsync({
					idempotencyKey: idempotencyKey.current,
					outcome: value.outcome,
					projectId,
					recordId,
				});
			} catch (error) {
				if (errorCodeOf(error)) {
					idempotencyKey.current = crypto.randomUUID();
				}
				setFailure(
					errorMessageOf(error) ?? "The outcome could not be saved. Try again."
				);
			}
		},
		validators: { onSubmit: runtimeValidationOutcomeFormSchema },
	});
	const inputId = `runtime-validation-${recordId}-outcome`;

	return (
		<form
			aria-label="Finalize outcome"
			className="space-y-3"
			onSubmit={preventAndSubmit(form.handleSubmit)}
		>
			<p className="text-muted-foreground text-sm">
				Only you decide the outcome; an adapter can only draft evidence. The
				first outcome is final. If you change your mind, add a new record.
			</p>
			<div className="space-y-2">
				<Label htmlFor={inputId}>Outcome</Label>
				<form.Field name="outcome">
					{(field) => (
						<>
							<NativeSelect
								className="w-full [&>select]:min-h-10"
								id={inputId}
								onChange={(event) =>
									field.handleChange(
										event.target.value as typeof field.state.value
									)
								}
								value={field.state.value}
								{...fieldErrorAttributes(inputId, field.state.meta.errors)}
							>
								<NativeSelectOption value="">
									Choose an outcome
								</NativeSelectOption>
								{runtimeValidationOutcomes.map((outcome) => (
									<NativeSelectOption key={outcome} value={outcome}>
										{outcomeLabels[outcome]}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<FieldErrors errors={field.state.meta.errors} fieldId={inputId} />
						</>
					)}
				</form.Field>
			</div>
			{failure ? <p role="alert">{failure}</p> : null}
			<Button className="min-h-11" disabled={finalize.isPending} type="submit">
				Finalize outcome
			</Button>
		</form>
	);
}

/** Confirms or reclassifies the failure source; every confirmation is appended, none rewrites an earlier one. */
export function RuntimeValidationFailureSourceForm({
	projectId,
	recordId,
}: {
	projectId: string;
	recordId: string;
}) {
	const confirm = useConfirmRuntimeValidationFailureSource();
	const [failure, setFailure] = useState<string | null>(null);
	const idempotencyKey = useRef(crypto.randomUUID());

	const form = useForm({
		defaultValues: {
			failureSource: "" as
				| ""
				| (typeof runtimeValidationConfirmedFailureSources)[number],
		},
		onSubmit: async ({ value }) => {
			setFailure(null);
			if (value.failureSource === "") {
				return;
			}
			try {
				await confirm.mutateAsync({
					failureSource: value.failureSource,
					idempotencyKey: idempotencyKey.current,
					projectId,
					recordId,
				});
				idempotencyKey.current = crypto.randomUUID();
				form.reset();
			} catch (error) {
				if (errorCodeOf(error)) {
					idempotencyKey.current = crypto.randomUUID();
				}
				setFailure(
					errorMessageOf(error) ??
						"The failure source could not be saved. Try again."
				);
			}
		},
		validators: { onSubmit: runtimeValidationFailureSourceFormSchema },
	});
	const inputId = `runtime-validation-${recordId}-failure-source`;

	return (
		<form
			aria-label="Confirm failure source"
			className="space-y-3"
			onSubmit={preventAndSubmit(form.handleSubmit)}
		>
			<div className="space-y-2">
				<Label htmlFor={inputId}>Failure source</Label>
				<form.Field name="failureSource">
					{(field) => (
						<>
							<NativeSelect
								className="w-full [&>select]:min-h-10"
								id={inputId}
								onChange={(event) =>
									field.handleChange(
										event.target.value as typeof field.state.value
									)
								}
								value={field.state.value}
								{...fieldErrorAttributes(inputId, field.state.meta.errors)}
							>
								<NativeSelectOption value="">
									Choose a source
								</NativeSelectOption>
								{runtimeValidationConfirmedFailureSources.map((source) => (
									<NativeSelectOption key={source} value={source}>
										{failureSourceLabels[source]}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<FieldErrors errors={field.state.meta.errors} fieldId={inputId} />
						</>
					)}
				</form.Field>
			</div>
			{failure ? <p role="alert">{failure}</p> : null}
			<Button className="min-h-11" disabled={confirm.isPending} type="submit">
				Confirm failure source
			</Button>
		</form>
	);
}
