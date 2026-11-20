import { useForm } from "@tanstack/react-form";
import type { ReferenceConstraintDraft } from "../schemas";
import { referenceConstraintFormSchema } from "../schemas";

export function useReferenceConstraintForm({
	defaultValues,
	hasCanonicalDesign,
	onSubmit,
	onSubmitInvalid,
}: {
	defaultValues: ReferenceConstraintDraft;
	hasCanonicalDesign: boolean;
	onSubmit: (
		draft: ReferenceConstraintDraft,
		reset: (draft: ReferenceConstraintDraft) => void
	) => Promise<void> | void;
	onSubmitInvalid?: (draft: ReferenceConstraintDraft) => void;
}) {
	return useForm({
		defaultValues,
		onSubmit: ({ formApi, value }) =>
			onSubmit(value, (draft) => formApi.reset(draft)),
		onSubmitInvalid: ({ value }) => onSubmitInvalid?.(value),
		validators: { onSubmit: referenceConstraintFormSchema(hasCanonicalDesign) },
	});
}

export type ReferenceConstraintForm = ReturnType<
	typeof useReferenceConstraintForm
>;
