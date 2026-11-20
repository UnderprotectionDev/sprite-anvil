import { requireContractInput } from "@sprite-anvil/api/contract-input";
import type { ProjectContextCreateInput } from "@sprite-anvil/api/project-context";
import {
	projectArtDirectionMaxLength,
	projectCreateContract,
	projectNameMaxLength,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";

const emptyCreateProjectForm: ProjectContextCreateInput = {
	name: "",
	generalArtDirection: "",
};

const projectInput = requireContractInput(projectCreateContract);

export function useCreateProjectForm(
	onSubmit: (input: ProjectContextCreateInput) => void
) {
	return useForm({
		defaultValues: emptyCreateProjectForm,
		onSubmit: async ({ value }) => {
			const result = await projectInput["~standard"].validate(value);
			if (!result.issues) {
				onSubmit(result.value);
			}
		},
		validators: {
			onChange: projectInput,
			onMount: projectInput,
			onSubmit: projectInput,
		},
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
				// A locked form must not start a submit: handleSubmit validates
				// asynchronously, so a pending submit could otherwise read values
				// after the form has been reset.
				if (isSaving || writeOutcomeUncertain) {
					return;
				}
				form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<div className="space-y-2">
						<Label className="text-sm" htmlFor="project-name">
							Game project name
						</Label>
						<Input
							autoComplete="off"
							className="min-h-11 text-sm md:text-sm"
							disabled={isSaving || writeOutcomeUncertain}
							id="project-name"
							maxLength={projectNameMaxLength}
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
							General art direction
						</Label>
						<Textarea
							className="bg-background field-sizing-fixed min-h-32 w-full resize-y rounded-md border px-3 py-2 text-sm md:text-sm"
							disabled={isSaving || writeOutcomeUncertain}
							id="project-art-direction"
							maxLength={projectArtDirectionMaxLength}
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
				selector={(state) => state.isValid && !state.isSubmitting}
			>
				{(isComplete) => (
					<Button
						className="min-h-11 w-full text-sm"
						disabled={isSaving || writeOutcomeUncertain || !isComplete}
						type="submit"
					>
						{isSaving ? "Saving…" : "Create project"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
