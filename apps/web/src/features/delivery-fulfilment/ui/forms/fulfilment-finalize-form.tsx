import {
	type FulfilmentMappingDraft,
	summarizeMappingDraft,
} from "@sprite-anvil/api/delivery-fulfilment";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type SyntheticEvent, useRef, useState } from "react";
import { errorCodeOf } from "@/utils/error-code";
import { useFinalizeFulfilment } from "../../hooks/use-finalize-fulfilment";
import { shortId } from "../../lib/fulfilment-mapping-labels";
import { fulfilmentFinalizeFormSchema } from "../../schemas";

function messagesOf(errors: unknown[]) {
	return errors.flatMap((error) =>
		typeof error === "object" && error !== null && "message" in error
			? [String(error.message)]
			: []
	);
}

/**
 * The user's act: pick a bundle for every conflict, then create the immutable
 * Delivery Fulfilment. A draft with a missing requirement cannot be finalized.
 */
export function FulfilmentFinalizeForm({
	deliveryTargetId,
	draft,
}: {
	deliveryTargetId: string;
	draft: FulfilmentMappingDraft;
}) {
	const finalize = useFinalizeFulfilment();
	const [failure, setFailure] = useState<string | null>(null);
	const idempotencyKey = useRef(crypto.randomUUID());
	const conflicts = draft.requirements.filter(
		(entry) => entry.status === "conflict"
	);
	const { missing } = summarizeMappingDraft(draft);

	const form = useForm({
		defaultValues: { bundleIds: conflicts.map(() => "") },
		onSubmit: async ({ value }) => {
			setFailure(null);
			try {
				await finalize.mutateAsync({
					deliveryTargetId,
					draftId: draft.id,
					idempotencyKey: idempotencyKey.current,
					projectId: draft.projectId,
					selections: conflicts.map((requirement, index) => ({
						assetFamilyId: requirement.assetFamilyId,
						bundleId: value.bundleIds[index] ?? "",
						itemId: requirement.itemId,
					})),
				});
				// A later Fulfilment of the same mapping is a new act, so it needs its own key.
				idempotencyKey.current = crypto.randomUUID();
			} catch (error) {
				if (errorCodeOf(error)) {
					idempotencyKey.current = crypto.randomUUID();
				}
				setFailure(
					error instanceof Error && error.message
						? error.message
						: "The Delivery Fulfilment could not be created. Try again."
				);
			}
		},
		validators: { onSubmit: fulfilmentFinalizeFormSchema },
	});

	if (missing > 0) {
		return (
			<p className="text-muted-foreground">
				This mapping cannot be finalized while {missing}{" "}
				{missing === 1 ? "requirement is" : "requirements are"} missing. A
				Delivery Fulfilment covers every requirement.
			</p>
		);
	}

	return (
		<form
			aria-label="Finalize Fulfilment"
			className="space-y-4"
			onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			{conflicts.map((requirement, index) => {
				const inputId = `fulfilment-pick-${index}`;
				const label = `Export Bundle for ${requirement.assetFamilyName}: ${requirement.itemName}`;
				return (
					<form.Field
						key={`${requirement.assetFamilyId}:${requirement.itemId}`}
						name={`bundleIds[${index}]`}
					>
						{(field) => {
							const messages = messagesOf(field.state.meta.errors);
							return (
								<div className="space-y-2">
									<Label htmlFor={inputId}>{label}</Label>
									<NativeSelect
										aria-describedby={
											messages.length > 0 ? `${inputId}-errors` : undefined
										}
										aria-invalid={messages.length > 0 ? true : undefined}
										className="w-full [&>select]:min-h-10"
										id={inputId}
										onChange={(event) => field.handleChange(event.target.value)}
										value={field.state.value}
									>
										<NativeSelectOption value="">
											Choose an Export Bundle
										</NativeSelectOption>
										{requirement.candidates.map((candidate) => (
											<NativeSelectOption
												key={candidate.bundleId}
												value={candidate.bundleId}
											>
												Export Bundle {shortId(candidate.bundleId)}: Asset
												Versions {candidate.assetVersionIds.join(", ")}
											</NativeSelectOption>
										))}
									</NativeSelect>
									{messages.length > 0 ? (
										<p
											className="text-destructive text-sm"
											id={`${inputId}-errors`}
											role="alert"
										>
											{messages[0]}
										</p>
									) : null}
								</div>
							);
						}}
					</form.Field>
				);
			})}
			{failure ? <p role="alert">{failure}</p> : null}
			<Button className="min-h-11" disabled={finalize.isPending} type="submit">
				Finalize Fulfilment
			</Button>
		</form>
	);
}
