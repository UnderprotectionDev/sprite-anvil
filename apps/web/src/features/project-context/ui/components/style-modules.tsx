import type {
	ProjectContext,
	styleModuleCopyInputSchema,
	styleModuleCreateInputSchema,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { Input } from "@sprite-anvil/ui/components/input";
import { NativeSelect } from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import type { z } from "zod";
import { createPendingIdempotencyKey } from "@/utils/pending-idempotency-key";

type CreateInput = z.infer<typeof styleModuleCreateInputSchema>;
type CopyInput = z.infer<typeof styleModuleCopyInputSchema>;
export function StyleModules({
	project,
	projects,
	create,
	copy,
}: {
	project: ProjectContext;
	projects: ProjectContext[];
	create: (input: CreateInput) => Promise<unknown>;
	copy: (input: CopyInput) => Promise<unknown>;
}) {
	const [pendingKeys] = useState(
		() => new Map<string, ReturnType<typeof createPendingIdempotencyKey>>()
	);
	function keyFor(operation: string, input: object) {
		const fingerprint = `${operation}:${JSON.stringify(input)}`;
		let pending = pendingKeys.get(fingerprint);
		if (!pending) {
			pending = createPendingIdempotencyKey();
			pendingKeys.set(fingerprint, pending);
		}
		return { fingerprint, key: pending.keyFor(fingerprint) };
	}
	const [error, setError] = useState<string | null>(null);
	const rules = project.currentContextRevision.rules.filter(
		(rule) => !rule.styleModule
	);
	const sources = projects
		.filter((item) => item.id !== project.id)
		.flatMap((item) => {
			const modules = new Map(
				item.currentContextRevision.rules.flatMap((rule) =>
					rule.styleModule
						? [[rule.styleModule.id, rule.styleModule] as const]
						: []
				)
			);
			return [...modules.values()].map((module) => ({ project: item, module }));
		});
	const form = useForm({
		defaultValues: { name: "", selected: [] as string[] },
		onSubmit: async ({ value }) => {
			const input = {
				projectId: project.id,
				baseContextRevisionId: project.currentContextRevision.id,
				name: value.name,
				rules: rules
					.filter((rule) =>
						value.selected.includes(
							`${rule.scope.kind}:${rule.scope.id}:${rule.id}`
						)
					)
					.map((rule) => ({ ruleId: rule.id, scope: rule.scope })),
			};
			try {
				const pending = keyFor("create", input);
				await create({ ...input, idempotencyKey: pending.key });
				pendingKeys.delete(pending.fingerprint);
				setError(null);
			} catch (cause) {
				setError(
					cause instanceof Error ? cause.message : "Could not create proposal."
				);
			}
		},
	});
	const copyForm = useForm({
		defaultValues: { selection: "" },
		onSubmit: async ({ value }) => {
			const source = sources.find((item) => item.module.id === value.selection);
			if (source) {
				const input = {
					projectId: project.id,
					baseContextRevisionId: project.currentContextRevision.id,
					sourceProjectId: source.project.id,
					sourceRevisionId: source.project.currentContextRevision.id,
					moduleId: source.module.id,
				};
				try {
					const pending = keyFor("copy", input);
					await copy({ ...input, idempotencyKey: pending.key });
					pendingKeys.delete(pending.fingerprint);
					setError(null);
				} catch (cause) {
					setError(
						cause instanceof Error
							? cause.message
							: "Could not create proposal."
					);
				}
			}
		},
	});
	return (
		<section>
			<h2>Style Modules</h2>
			{error ? <p role="alert">{error}</p> : null}
			<p>
				Group rules or copy a module into a proposal. Copies use the receiving
				project scope. Activate the proposal to apply it.
			</p>
			{[
				...new Map(
					project.currentContextRevision.rules.flatMap((rule) =>
						rule.styleModule
							? [[rule.styleModule.id, rule.styleModule] as const]
							: []
					)
				).values(),
			].map((module) => (
				<p key={module.id}>
					{module.name} · version {module.version}
				</p>
			))}
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name="name">
					{(field) => (
						<label htmlFor="style-module-name">
							Style Module name
							<Input
								id="style-module-name"
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</label>
					)}
				</form.Field>
				<form.Field name="selected">
					{(field) => (
						<fieldset>
							<legend>Rules in one scope</legend>
							{rules.map((rule) => {
								const key = `${rule.scope.kind}:${rule.scope.id}:${rule.id}`;
								return (
									<label htmlFor={key} key={key}>
										<Checkbox
											checked={field.state.value.includes(key)}
											id={key}
											onCheckedChange={(checked) =>
												field.handleChange(
													checked
														? [...field.state.value, key]
														: field.state.value.filter((item) => item !== key)
												)
											}
										/>
										{rule.id} · {rule.scope.kind}
									</label>
								);
							})}
						</fieldset>
					)}
				</form.Field>
				<Button type="submit">Propose Style Module</Button>
			</form>
			{sources.length > 0 && (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void copyForm.handleSubmit();
					}}
				>
					<copyForm.Field name="selection">
						{(field) => (
							<label htmlFor="style-module-copy">
								Style Module to copy
								<NativeSelect
									id="style-module-copy"
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								>
									<option value="">Select a module</option>
									{sources.map(({ project: source, module }) => (
										<option key={module.id} value={module.id}>
											{source.name} · {module.name} · version {module.version}
										</option>
									))}
								</NativeSelect>
							</label>
						)}
					</copyForm.Field>
					<Button type="submit">Copy to proposal</Button>
				</form>
			)}
		</section>
	);
}
