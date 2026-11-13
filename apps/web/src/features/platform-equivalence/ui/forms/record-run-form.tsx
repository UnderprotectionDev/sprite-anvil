import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { SyntheticEvent } from "react";
import { StatusMessage } from "@/components/status-message";
import { usePendingIdempotencyKey } from "@/utils/pending-idempotency-key";
import { useRecordPlatformEquivalenceRun } from "../../hooks/use-platform-equivalence-writes";
import {
	currentSurface,
	surfaceLabels,
} from "../../lib/platform-equivalence-labels";
import { platformEquivalenceRunFormSchema } from "../../schemas";

export interface BundleChoice {
	createdAt: string;
	id: string;
	manifestDigest: string;
}

export function RecordRunForm({
	bundles,
	projectId,
}: {
	bundles: BundleChoice[];
	projectId: string;
}) {
	const surface = currentSurface();
	const record = useRecordPlatformEquivalenceRun();
	// A retry of the same bundle and surface replays the first attempt; a success starts a new act.
	const idempotencyKey = usePendingIdempotencyKey();

	const form = useForm({
		defaultValues: { bundleId: "" },
		onSubmit: async ({ value }) => {
			try {
				await record.mutateAsync({
					bundleId: value.bundleId,
					idempotencyKey: idempotencyKey.keyFor(`${surface}:${value.bundleId}`),
					projectId,
					surface,
				});
				idempotencyKey.clear();
				form.reset();
			} catch {
				// The mutation state below reports the failure.
			}
		},
		validators: { onSubmit: platformEquivalenceRunFormSchema },
	});

	const submit = (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		void form.handleSubmit();
	};

	return (
		<form
			aria-label="Record a run"
			className="space-y-4 rounded-lg border p-4"
			onSubmit={submit}
		>
			<h2 className="font-semibold text-xl">Record a run</h2>
			<p className="text-muted-foreground text-sm">
				This records what the {surfaceLabels[surface]} derived from one stored
				Export Bundle. The surface name comes from this app and the server does
				not verify it.
			</p>
			<div className="space-y-2">
				<Label htmlFor="platform-equivalence-bundle">Export Bundle</Label>
				<form.Field name="bundleId">
					{(field) => {
						const messages = field.state.meta.errors.flatMap((error) =>
							typeof error === "object" && error !== null && "message" in error
								? [String(error.message)]
								: []
						);
						return (
							<>
								<NativeSelect
									aria-describedby={
										messages.length > 0
											? "platform-equivalence-bundle-errors"
											: undefined
									}
									aria-invalid={messages.length > 0 ? true : undefined}
									className="w-full [&>select]:min-h-10"
									id="platform-equivalence-bundle"
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
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
								{messages.length > 0 ? (
									<ul
										className="space-y-1 text-destructive text-sm"
										id="platform-equivalence-bundle-errors"
										role="alert"
									>
										{messages.map((message) => (
											<li key={message}>{message}</li>
										))}
									</ul>
								) : null}
							</>
						);
					}}
				</form.Field>
			</div>
			{record.isError ? (
				<StatusMessage tone="error">
					The run could not be recorded. Try again.
				</StatusMessage>
			) : null}
			{record.isSuccess ? (
				<StatusMessage tone="success">Run recorded.</StatusMessage>
			) : null}
			<form.Subscribe selector={(state) => state.isSubmitting}>
				{(isSubmitting) => (
					<Button className="min-h-11" disabled={isSubmitting} type="submit">
						{isSubmitting ? "Recording…" : "Record run"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
