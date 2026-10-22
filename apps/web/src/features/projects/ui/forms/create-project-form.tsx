import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import {
	type CreateProjectFormValues,
	createProjectFormSchema,
} from "../../schemas";

const emptyCreateProjectForm: CreateProjectFormValues = {
	name: "",
	generalArtDirection: "",
};

export function useCreateProjectForm(
	onSubmit: (input: CreateProjectFormValues) => void
) {
	return useForm({
		defaultValues: emptyCreateProjectForm,
		onSubmit: ({ value }) => onSubmit(createProjectFormSchema.parse(value)),
		validators: { onSubmit: createProjectFormSchema },
	});
}

export type CreateProjectFormApi = ReturnType<typeof useCreateProjectForm>;

export function CreateProjectForm({
	form,
	isSaving,
	writeOutcomeUncertain,
}: {
	form: CreateProjectFormApi;
	isSaving: boolean;
	writeOutcomeUncertain: boolean;
}) {
	return (
		<form
			className="grid gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<div className="space-y-2">
						<Label className="text-sm" htmlFor="project-name">
							Oyun projesi adı
						</Label>
						<Input
							autoComplete="off"
							className="min-h-11 text-sm md:text-sm"
							disabled={isSaving || writeOutcomeUncertain}
							id="project-name"
							maxLength={120}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						/>
					</div>
				)}
			</form.Field>
			<form.Field name="generalArtDirection">
				{(field) => (
					<div className="space-y-2">
						<Label className="text-sm" htmlFor="project-art-direction">
							Genel sanat yaklaşımı
						</Label>
						<Textarea
							className="field-sizing-fixed min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm md:text-sm"
							disabled={isSaving || writeOutcomeUncertain}
							id="project-art-direction"
							maxLength={1000}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						/>
					</div>
				)}
			</form.Field>
			<form.Subscribe
				selector={(state) =>
					createProjectFormSchema.safeParse(state.values).success
				}
			>
				{(isComplete) => (
					<Button
						className="min-h-11 w-full text-sm"
						disabled={isSaving || writeOutcomeUncertain || !isComplete}
						type="submit"
					>
						{isSaving ? "Kaydediliyor…" : "Proje oluştur"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
