import { runtimeEnvironmentTextLimit } from "@sprite-anvil/api/runtime-environment";
import type { RuntimeValidationRecord } from "@sprite-anvil/api/runtime-validation";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type SyntheticEvent, useRef, useState } from "react";
import { FieldErrors, fieldErrorAttributes } from "@/components/field-errors";
import { StatusMessage } from "@/components/status-message";
import { errorCodeOf } from "@/utils/error-code";
import { useCreateRuntimeValidationRecord } from "../../hooks/use-runtime-validation-writes";
import { errorMessageOf } from "../../lib/runtime-validation-labels";
import { runtimeValidationRecordFormSchema } from "../../schemas";

export interface BundleChoice {
	createdAt: string;
	id: string;
	manifestDigest: string;
}

export function RuntimeValidationRecordForm({
	bundles,
	projectId,
	records,
}: {
	bundles: BundleChoice[];
	projectId: string;
	records: Pick<
		RuntimeValidationRecord,
		| "createdAt"
		| "engineVersion"
		| "failureSource"
		| "gameBuild"
		| "id"
		| "outcome"
	>[];
}) {
	// Mirrors the server: only an Inconclusive record or a Fail with a confirmed source can be superseded.
	const retestable = records.filter(
		(record) =>
			record.outcome === "inconclusive" ||
			(record.outcome === "fail" && record.failureSource !== "source_unknown")
	);
	const create = useCreateRuntimeValidationRecord();
	const [failure, setFailure] = useState<string | null>(null);
	// The key makes a retry after an uncertain outcome idempotent; a server verdict ends it.
	const idempotencyKey = useRef(crypto.randomUUID());

	const form = useForm({
		defaultValues: {
			adapterVersion: "",
			bundleId: "",
			engineVersion: "",
			gameBuild: "",
			supersedesRecordId: "",
		},
		onSubmit: async ({ value }) => {
			setFailure(null);
			try {
				await create.mutateAsync({
					adapterVersion: value.adapterVersion.trim() || null,
					bundleId: value.bundleId,
					engineVersion: value.engineVersion,
					gameBuild: value.gameBuild,
					idempotencyKey: idempotencyKey.current,
					projectId,
					supersedesRecordId: value.supersedesRecordId || null,
				});
				idempotencyKey.current = crypto.randomUUID();
				form.reset();
			} catch (error) {
				if (errorCodeOf(error)) {
					idempotencyKey.current = crypto.randomUUID();
				}
				setFailure(
					errorMessageOf(error) ??
						"The Runtime Validation Record could not be saved. Try again."
				);
			}
		},
		validators: { onSubmit: runtimeValidationRecordFormSchema },
	});

	const submit = (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		void form.handleSubmit();
	};

	return (
		<form
			aria-label="New Runtime Validation Record"
			className="space-y-4 rounded-lg border p-4"
			onSubmit={submit}
		>
			<h2 className="font-semibold text-xl">New Runtime Validation Record</h2>
			<p className="text-muted-foreground text-sm">
				A record is evidence from testing one exact Export Bundle in a real game
				build. It is saved as is and never changed; you add the evidence to it
				afterwards.
			</p>

			<div className="space-y-2">
				<Label htmlFor="runtime-validation-bundle">Export Bundle</Label>
				<form.Field name="bundleId">
					{(field) => (
						<>
							<NativeSelect
								className="w-full [&>select]:min-h-10"
								id="runtime-validation-bundle"
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
								{...fieldErrorAttributes(
									"runtime-validation-bundle",
									field.state.meta.errors
								)}
							>
								<NativeSelectOption value="">
									Choose an Export Bundle
								</NativeSelectOption>
								{bundles.map((bundle) => (
									<NativeSelectOption key={bundle.id} value={bundle.id}>
										{`${new Date(bundle.createdAt).toLocaleString()} · ${bundle.manifestDigest.slice(0, 12)}`}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<FieldErrors
								errors={field.state.meta.errors}
								fieldId="runtime-validation-bundle"
							/>
						</>
					)}
				</form.Field>
			</div>

			<div className="grid gap-4 sm:grid-cols-3">
				<div className="space-y-2">
					<Label htmlFor="runtime-validation-build">Game build</Label>
					<form.Field name="gameBuild">
						{(field) => (
							<>
								<Input
									id="runtime-validation-build"
									maxLength={runtimeEnvironmentTextLimit}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
									{...fieldErrorAttributes(
										"runtime-validation-build",
										field.state.meta.errors
									)}
								/>
								<FieldErrors
									errors={field.state.meta.errors}
									fieldId="runtime-validation-build"
								/>
							</>
						)}
					</form.Field>
				</div>
				<div className="space-y-2">
					<Label htmlFor="runtime-validation-engine">Engine version</Label>
					<form.Field name="engineVersion">
						{(field) => (
							<>
								<Input
									id="runtime-validation-engine"
									maxLength={runtimeEnvironmentTextLimit}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
									{...fieldErrorAttributes(
										"runtime-validation-engine",
										field.state.meta.errors
									)}
								/>
								<FieldErrors
									errors={field.state.meta.errors}
									fieldId="runtime-validation-engine"
								/>
							</>
						)}
					</form.Field>
				</div>
				<div className="space-y-2">
					<Label htmlFor="runtime-validation-adapter">
						Adapter version (optional)
					</Label>
					<form.Field name="adapterVersion">
						{(field) => (
							<>
								<Input
									id="runtime-validation-adapter"
									maxLength={runtimeEnvironmentTextLimit}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
									{...fieldErrorAttributes(
										"runtime-validation-adapter",
										field.state.meta.errors
									)}
								/>
								<FieldErrors
									errors={field.state.meta.errors}
									fieldId="runtime-validation-adapter"
								/>
							</>
						)}
					</form.Field>
				</div>
			</div>

			{retestable.length > 0 ? (
				<div className="space-y-2">
					<Label htmlFor="runtime-validation-supersedes">
						Retest or fix of an earlier record (optional)
					</Label>
					<form.Field name="supersedesRecordId">
						{(field) => (
							<NativeSelect
								className="w-full [&>select]:min-h-10"
								id="runtime-validation-supersedes"
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							>
								<NativeSelectOption value="">
									This is not a retest
								</NativeSelectOption>
								{retestable.map((record) => (
									<NativeSelectOption key={record.id} value={record.id}>
										{`${record.gameBuild} on ${record.engineVersion} · ${new Date(record.createdAt).toLocaleString()}`}
									</NativeSelectOption>
								))}
							</NativeSelect>
						)}
					</form.Field>
					<p className="text-muted-foreground text-xs">
						The earlier record stays exactly as it is; this new record only
						points to it.
					</p>
				</div>
			) : null}

			{failure ? <StatusMessage tone="error">{failure}</StatusMessage> : null}
			<Button className="min-h-11" disabled={create.isPending} type="submit">
				Save Runtime Validation Record
			</Button>
		</form>
	);
}
