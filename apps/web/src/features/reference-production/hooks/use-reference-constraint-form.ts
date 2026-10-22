import { useForm } from "@tanstack/react-form";
import {
	type ReferenceConstraintDraft,
	referenceConstraintFormSchema,
} from "../schemas";

export function useReferenceConstraintForm({
	defaultValues,
	hasCanonicalDesign,
	onSubmit,
	onSubmitInvalid,
}: {
	defaultValues: ReferenceConstraintDraft;
	hasCanonicalDesign: boolean;
	onSubmit: (draft: ReferenceConstraintDraft) => Promise<void> | void;
	onSubmitInvalid?: (draft: ReferenceConstraintDraft) => void;
}) {
	return useForm({
		defaultValues,
		onSubmit: ({ value }) => onSubmit(value),
		onSubmitInvalid: ({ value }) => onSubmitInvalid?.(value),
		validators: { onSubmit: referenceConstraintFormSchema(hasCanonicalDesign) },
	});
}

export type ReferenceConstraintForm = ReturnType<
	typeof useReferenceConstraintForm
>;
