import type { ContextAgentScope } from "@sprite-anvil/api/project-access-store";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useForm } from "@tanstack/react-form";
import type { ContextAgentPermissionFormValues } from "../../schemas";
import { contextAgentPermissionFormSchema } from "../../schemas";

export const scopeOptions: { label: string; scope: ContextAgentScope }[] = [
	{ label: "Read Project Context", scope: "project_context:read" },
	{ label: "Prepare Context Proposals", scope: "context_proposals:write" },
];

const defaultContextAgentPermissionForm: ContextAgentPermissionFormValues = {
	purpose: "Prepare proposals for Project Context",
	scopes: ["project_context:read", "context_proposals:write"],
};

export function useContextAgentPermissionForm(
	onSubmit: (input: { purpose: string; scopes: ContextAgentScope[] }) => void
) {
	return useForm({
		defaultValues: defaultContextAgentPermissionForm,
		onSubmit: ({ value }) =>
			onSubmit(contextAgentPermissionFormSchema.parse(value)),
		validators: { onSubmit: contextAgentPermissionFormSchema },
	});
}

export type ContextAgentPermissionFormApi = ReturnType<
	typeof useContextAgentPermissionForm
>;

export function ContextAgentPermissionForm({
	form,
	isDisabled,
	isSaving,
	writeOutcomeUncertain,
}: {
	form: ContextAgentPermissionFormApi;
	isDisabled: boolean;
	isSaving: boolean;
	writeOutcomeUncertain: boolean;
}) {
	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="purpose">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor="context-agent-purpose">Purpose</Label>
						<Input
							disabled={writeOutcomeUncertain}
							id="context-agent-purpose"
							maxLength={160}
							minLength={3}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						/>
					</div>
				)}
			</form.Field>

			<form.Field name="scopes">
				{(field) => (
					<FieldSet className="space-y-3" disabled={writeOutcomeUncertain}>
						<FieldLegend className="font-medium">Access scope</FieldLegend>
						{scopeOptions.map(({ label, scope }) => {
							const id = `scope-${scope.replaceAll(":", "-")}`;
							return (
								<div className="flex items-start gap-3" key={scope}>
									<Checkbox
										checked={field.state.value.includes(scope)}
										className="mt-1"
										disabled={writeOutcomeUncertain}
										id={id}
										onCheckedChange={(checked) =>
											field.handleChange(
												checked
													? [...new Set([...field.state.value, scope])]
													: field.state.value.filter(
															(selectedScope) => selectedScope !== scope
														)
											)
										}
									/>
									<Label className="font-normal" htmlFor={id}>
										{label}
									</Label>
								</div>
							);
						})}
					</FieldSet>
				)}
			</form.Field>

			<form.Subscribe
				selector={(state) =>
					contextAgentPermissionFormSchema.safeParse(state.values).success
				}
			>
				{(isComplete) => (
					<Button
						disabled={
							isSaving || isDisabled || writeOutcomeUncertain || !isComplete
						}
						type="submit"
					>
						{isSaving ? "Saving…" : "Grant Context Agent permission"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
