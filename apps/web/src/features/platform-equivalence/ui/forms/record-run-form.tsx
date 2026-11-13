import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type SyntheticEvent, useRef, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { errorCodeOf } from "@/utils/error-code";
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
	const [failure, setFailure] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	// The key makes a retry after an uncertain outcome idempotent; a server verdict ends it.
	const idempotencyKey = useRef(crypto.randomUUID());

	const form = useForm({
		defaultValues: { bundleId: "" },
		onSubmit: async ({ value }) => {
			setFailure(null);
			setSaved(false);
			try {
				await record.mutateAsync({
					bundleId: value.bundleId,
					idempotencyKey: idempotencyKey.current,
					projectId,
					surface,
				});
				idempotencyKey.current = crypto.randomUUID();
				setSaved(true);
				form.reset();
			} catch (error) {
				if (errorCodeOf(error)) {
					idempotencyKey.current = crypto.randomUUID();
				}
				setFailure("The run could not be recorded. Try again.");
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
			{failure ? <StatusMessage tone="error">{failure}</StatusMessage> : null}
			{saved ? (
				<StatusMessage tone="success">Run recorded.</StatusMessage>
			) : null}
			<Button className="min-h-11" disabled={record.isPending} type="submit">
				{record.isPending ? "Recording…" : "Record run"}
			</Button>
		</form>
	);
}
