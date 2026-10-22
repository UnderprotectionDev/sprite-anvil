import { useForm } from "@tanstack/react-form";
import {
	type ThemeFormValues,
	themeFormSchema,
	type VisualWorldFormValues,
	visualWorldFormSchema,
} from "../schemas";

export function useVisualWorldForm(
	onSubmit: (input: VisualWorldFormValues) => void
) {
	return useForm({
		defaultValues: { name: "", description: "" },
		onSubmit: ({ value }) => onSubmit(value),
		validators: { onSubmit: visualWorldFormSchema },
	});
}

export type VisualWorldFormApi = ReturnType<typeof useVisualWorldForm>;

export function useThemeForm(onSubmit: (input: ThemeFormValues) => void) {
	return useForm({
		defaultValues: { visualWorldId: "", name: "", description: "" },
		onSubmit: ({ value }) => onSubmit(value),
		validators: { onSubmit: themeFormSchema },
	});
}

export type ThemeFormApi = ReturnType<typeof useThemeForm>;
