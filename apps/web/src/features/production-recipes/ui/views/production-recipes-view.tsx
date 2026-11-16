import {
	referenceFeatures,
	referenceRoles,
} from "@sprite-anvil/api/asset-record-tracking";
import {
	type ProductionRecipe,
	productionRecipeCreateInputSchema,
	productionRecipeCreateVersionInputSchema,
	productionRecipeUseInputSchema,
	validateProductionRecipeContent,
} from "@sprite-anvil/api/production-recipes";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { Input } from "@sprite-anvil/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { z } from "zod";
import { orpc } from "@/utils/orpc";

export function ProductionRecipesView({ projectId }: { projectId: string }) {
	const recipes = useQuery({
		...orpc.productionRecipes.list.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
	});
	return (
		<main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
			<h1 className="font-semibold text-2xl">Production Recipes</h1>
			<CreateRecipe
				onCreated={() => void recipes.refetch()}
				projectId={projectId}
			/>
			{!!recipes.isPending && <p role="status">Loading Production Recipes…</p>}
			{!!recipes.isError && (
				<div role="alert">
					Production Recipes could not be loaded.{" "}
					<Button onClick={() => void recipes.refetch()}>Retry</Button>
				</div>
			)}
			{recipes.isSuccess && recipes.data.length === 0 && (
				<p>This project has no Production Recipes yet.</p>
			)}
			{recipes.data?.map((recipe) => (
				<section key={recipe.id}>
					<h2>{recipe.title}</h2>
					<p>Version {recipe.versions.at(-1)?.versionNumber}</p>
					<EditRecipe
						key={`${recipe.id}-${recipe.versions.at(-1)?.versionNumber}`}
						onCreated={() => void recipes.refetch()}
						projectId={projectId}
						recipe={recipe}
					/>
					<UseRecipe projectId={projectId} recipe={recipe} />
					<CopyRecipe projectId={projectId} recipeId={recipe.id} />
				</section>
			))}
		</main>
	);
}

function EditRecipe({
	projectId,
	recipe,
	onCreated,
}: {
	projectId: string;
	recipe: ProductionRecipe;
	onCreated: () => void;
}) {
	const version = recipe.versions.at(-1) ?? recipe.versions[0];
	const id = useId();
	const mutation = useMutation(
		orpc.productionRecipes.createVersion.mutationOptions()
	);
	const [error, setError] = useState("");
	const form = useForm({
		defaultValues: { content: structuredClone(version.content), note: "" },
		onSubmit: async ({ value }) => {
			const parsed = productionRecipeCreateVersionInputSchema.safeParse({
				projectId,
				recipeId: recipe.id,
				baseVersionNumber: version.versionNumber,
				content: value.content,
				...(value.note.trim() ? { note: value.note } : {}),
			});
			if (!parsed.success) {
				setError("Check the recipe content and version note.");
				return;
			}
			const problem = validateProductionRecipeContent(parsed.data.content);
			if (problem) {
				setError(problem);
				return;
			}
			setError("");
			try {
				await mutation.mutateAsync(parsed.data);
				onCreated();
			} catch {
				/* displayed below */
			}
		},
	});
	return (
		<form
			className="space-y-2"
			onSubmit={(e) => {
				e.preventDefault();
				void form.handleSubmit();
			}}
		>
			<h3>Edit Production Recipe</h3>
			<p>Editing version {version.versionNumber}</p>
			{(
				[
					["instructionSkeleton", "Instruction skeleton"],
					["expectedOutputStructure", "Expected output structure"],
				] as const
			).map(([name, label]) => (
				<form.Field key={name} name={`content.${name}`}>
					{(field) => (
						<label htmlFor={`${id}-${name}`}>
							{label}
							<Textarea
								id={`${id}-${name}`}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value ?? ""}
							/>
						</label>
					)}
				</form.Field>
			))}
			<form.Field mode="array" name="content.fields">
				{(field) => (
					<fieldset>
						<legend>Fields</legend>
						{field.state.value.map((item, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: The API entries have no stable identity and can be edited or duplicated.
							<fieldset key={`${index}-${field.state.value.length}`}>
								<legend>Field {index + 1}</legend>
								{(["key", "label"] as const).map((name) => (
									<label htmlFor={`${id}-field-${index}-${name}`} key={name}>
										{name === "key" ? "Field key" : "Field label"}
										<Input
											id={`${id}-field-${index}-${name}`}
											onChange={(e) =>
												field.handleChange(
													field.state.value.map((v, i) =>
														i === index
															? { ...item, [name]: e.target.value }
															: v
													)
												)
											}
											value={item[name]}
										/>
									</label>
								))}
								<label htmlFor={`${id}-mode-${index}`}>
									Field mode
									<NativeSelect
										id={`${id}-mode-${index}`}
										onChange={(e) =>
											field.handleChange(
												field.state.value.map((v, i) =>
													i === index
														? {
																...item,
																mode:
																	e.target.value === "fixed"
																		? "fixed"
																		: "fill_in",
																value: e.target.value === "fixed" ? "" : null,
															}
														: v
												)
											)
										}
										value={item.mode}
									>
										<NativeSelectOption value="fixed">Fixed</NativeSelectOption>
										<NativeSelectOption value="fill_in">
											Fill in
										</NativeSelectOption>
									</NativeSelect>
								</label>
								{item.mode === "fixed" && (
									<label htmlFor={`${id}-value-${index}`}>
										Fixed value
										<Input
											id={`${id}-value-${index}`}
											onChange={(e) =>
												field.handleChange(
													field.state.value.map((v, i) =>
														i === index ? { ...item, value: e.target.value } : v
													)
												)
											}
											value={item.value ?? ""}
										/>
									</label>
								)}
								<Button onClick={() => field.removeValue(index)} type="button">
									Remove field
								</Button>
							</fieldset>
						))}
						<Button
							onClick={() =>
								field.pushValue({
									key: "",
									label: "",
									mode: "fill_in",
									value: null,
								})
							}
							type="button"
						>
							Add field
						</Button>
					</fieldset>
				)}
			</form.Field>
			<form.Field mode="array" name="content.referenceRoles">
				{(field) => (
					<fieldset>
						<legend>Reference Roles</legend>
						{field.state.value.map((item, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: The API entries have no stable identity and can be edited or duplicated.
							<fieldset key={`${index}-${field.state.value.length}`}>
								<legend>Reference Role {index + 1}</legend>
								<label htmlFor={`${id}-role-${index}`}>
									Role
									<NativeSelect
										id={`${id}-role-${index}`}
										onChange={(e) =>
											field.handleChange(
												field.state.value.map((v, i) =>
													i === index
														? {
																...item,
																role: e.target.value as typeof item.role,
															}
														: v
												)
											)
										}
										value={item.role}
									>
										{referenceRoles.map((role) => (
											<NativeSelectOption key={role} value={role}>
												{role}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</label>
								{(
									[
										["customPurpose", "Custom purpose"],
										["notes", "Notes"],
									] as const
								).map(([name, label]) => (
									<label htmlFor={`${id}-role-${index}-${name}`} key={name}>
										{label}
										<Input
											id={`${id}-role-${index}-${name}`}
											onChange={(e) =>
												field.handleChange(
													field.state.value.map((v, i) =>
														i === index
															? { ...item, [name]: e.target.value || null }
															: v
													)
												)
											}
											value={item[name] ?? ""}
										/>
									</label>
								))}
								{(
									[
										["transferredFeatures", "Transferred features"],
										["forbiddenFeatures", "Forbidden features"],
									] as const
								).map(([name, label]) => (
									<fieldset key={name}>
										<legend>{label}</legend>
										{referenceFeatures.map((feature) => (
											<label
												htmlFor={`${id}-${index}-${name}-${feature}`}
												key={feature}
											>
												<Checkbox
													checked={item[name].includes(feature)}
													id={`${id}-${index}-${name}-${feature}`}
													onCheckedChange={(checked) =>
														field.handleChange(
															field.state.value.map((v, i) =>
																i === index
																	? {
																			...item,
																			[name]: checked
																				? [...item[name], feature]
																				: item[name].filter(
																						(selected) => selected !== feature
																					),
																		}
																	: v
															)
														)
													}
												/>
												{feature}
											</label>
										))}
									</fieldset>
								))}
								<Button onClick={() => field.removeValue(index)} type="button">
									Remove Reference Role
								</Button>
							</fieldset>
						))}
						<Button
							onClick={() =>
								field.pushValue({
									role: "identity",
									customPurpose: null,
									notes: null,
									transferredFeatures: [],
									forbiddenFeatures: [],
								})
							}
							type="button"
						>
							Add Reference Role
						</Button>
					</fieldset>
				)}
			</form.Field>
			<form.Field name="note">
				{(field) => (
					<label htmlFor={`${id}-note`}>
						Version note (optional)
						<Input
							id={`${id}-note`}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</label>
				)}
			</form.Field>
			{!!error && <p role="alert">{error}</p>}
			{!!mutation.isError && <p role="alert">{mutation.error.message}</p>}
			{!!mutation.isSuccess && (
				<p role="status">Production Recipe version created.</p>
			)}
			<Button disabled={mutation.isPending} type="submit">
				Create version
			</Button>
		</form>
	);
}

function CopyRecipe({
	projectId,
	recipeId,
}: {
	projectId: string;
	recipeId: string;
}) {
	const projects = useQuery(orpc.projects.list.queryOptions());
	const queryClient = useQueryClient();
	const copy = useMutation(orpc.productionRecipes.copy.mutationOptions());
	const form = useForm({
		defaultValues: { targetProjectId: "" },
		validators: { onSubmit: z.object({ targetProjectId: z.uuid() }) },
		onSubmit: async ({ value }) => {
			try {
				await copy.mutateAsync({
					sourceProjectId: projectId,
					targetProjectId: value.targetProjectId,
					recipeId,
				});
				await queryClient.invalidateQueries({
					queryKey: orpc.productionRecipes.list.queryKey({
						input: { projectId: value.targetProjectId },
					}),
				});
			} catch {
				/* The mutation error is displayed below. */
			}
		},
	});
	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.Field name="targetProjectId">
				{(field) => (
					<label htmlFor={`copy-project-${recipeId}`}>
						Copy to project
						<NativeSelect
							id={`copy-project-${recipeId}`}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						>
							<NativeSelectOption value="">Choose a project</NativeSelectOption>
							{projects.data
								?.filter((project) => project.id !== projectId)
								.map((project) => (
									<NativeSelectOption key={project.id} value={project.id}>
										{project.name}
									</NativeSelectOption>
								))}
						</NativeSelect>
					</label>
				)}
			</form.Field>
			{!!projects.isPending && <p role="status">Loading projects…</p>}
			{!!projects.isError && <p role="alert">Projects could not be loaded.</p>}
			<Button disabled={copy.isPending} type="submit">
				{copy.isPending ? "Copying…" : "Copy recipe"}
			</Button>
			{!!copy.isError && <p role="alert">{copy.error.message}</p>}
			{!!copy.isSuccess && (
				<p role="status">Independent copy created in the selected project.</p>
			)}
		</form>
	);
}

function CreateRecipe({
	projectId,
	onCreated,
}: {
	projectId: string;
	onCreated: () => void;
}) {
	const formId = useId();
	const records = useQuery(
		orpc.assetRecords.list.queryOptions({ input: { projectId } })
	);
	const create = useMutation(orpc.productionRecipes.create.mutationOptions());
	const [validation, setValidation] = useState("");
	const form = useForm({
		defaultValues: { recordId: "", experimentId: "", trialId: "", title: "" },
		onSubmit: async ({ value }) => {
			const parsed = productionRecipeCreateInputSchema.safeParse({
				projectId,
				experimentId: value.experimentId,
				trialId: value.trialId,
				title: value.title,
			});
			if (!parsed.success) {
				setValidation(
					"Choose a source, experiment and trial, and enter a title."
				);
				return;
			}
			setValidation("");
			try {
				await create.mutateAsync(parsed.data);
				onCreated();
			} catch {
				/* displayed below */
			}
		},
	});
	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<h2>Create Production Recipe</h2>
			<form.Field name="title">
				{(field) => (
					<label htmlFor={`${formId}-title`}>
						Title
						<Input
							id={`${formId}-title`}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</label>
				)}
			</form.Field>
			<form.Field name="recordId">
				{(field) => (
					<label htmlFor={`${formId}-record`}>
						Source Asset Record
						<NativeSelect
							id={`${formId}-record`}
							onChange={(e) => {
								field.handleChange(e.target.value);
								form.setFieldValue("experimentId", "");
								form.setFieldValue("trialId", "");
							}}
							value={field.state.value}
						>
							<NativeSelectOption value="">
								Choose an Asset Record
							</NativeSelectOption>
							{records.data?.map((record) => (
								<NativeSelectOption key={record.id} value={record.id}>
									{record.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</label>
				)}
			</form.Field>
			{records.isError ? (
				<p role="alert">Asset Records could not be loaded.</p>
			) : null}
			<form.Subscribe selector={(state) => state.values.recordId}>
				{(recordId) =>
					recordId ? (
						<ExperimentSelector
							form={form}
							projectId={projectId}
							recordId={recordId}
						/>
					) : null
				}
			</form.Subscribe>
			{validation ? <p role="alert">{validation}</p> : null}
			{create.isError ? <p role="alert">{create.error.message}</p> : null}
			{create.isSuccess ? (
				<p role="status">Production Recipe created.</p>
			) : null}
			<Button disabled={create.isPending} type="submit">
				Create recipe
			</Button>
		</form>
	);
}

function ExperimentSelector({
	projectId,
	recordId,
	form,
}: {
	projectId: string;
	recordId: string;
	form: ReturnType<typeof useCreateRecipeForm>;
}) {
	const formId = useId();
	const experiments = useQuery(
		orpc.productionExperiments.list.queryOptions({
			input: { projectId, assetRecordId: recordId },
		})
	);
	return (
		<>
			<form.Field name="experimentId">
				{(field) => (
					<label htmlFor={`${formId}-experiment`}>
						Production Experiment
						<NativeSelect
							id={`${formId}-experiment`}
							onChange={(e) => {
								field.handleChange(e.target.value);
								form.setFieldValue("trialId", "");
							}}
							value={field.state.value}
						>
							<NativeSelectOption value="">
								Choose an experiment
							</NativeSelectOption>
							{experiments.data?.map((experiment) => (
								<NativeSelectOption key={experiment.id} value={experiment.id}>
									{experiment.title}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</label>
				)}
			</form.Field>
			{experiments.isError ? (
				<p role="alert">Experiments could not be loaded.</p>
			) : null}
			<form.Subscribe selector={(state) => state.values.experimentId}>
				{(id) => (
					<form.Field name="trialId">
						{(field) => (
							<label htmlFor={`${formId}-trial`}>
								Trial
								<NativeSelect
									id={`${formId}-trial`}
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Choose a trial
									</NativeSelectOption>
									{experiments.data
										?.find((experiment) => experiment.id === id)
										?.trials.map((trial) => (
											<NativeSelectOption key={trial.id} value={trial.id}>
												{trial.label}
											</NativeSelectOption>
										))}
								</NativeSelect>
							</label>
						)}
					</form.Field>
				)}
			</form.Subscribe>
		</>
	);
}
function useCreateRecipeForm() {
	return useForm({
		defaultValues: { recordId: "", experimentId: "", trialId: "", title: "" },
	});
}

function UseRecipe({
	projectId,
	recipe,
}: {
	projectId: string;
	recipe: ProductionRecipe;
}) {
	const formId = useId();
	const records = useQuery(
		orpc.assetRecords.list.queryOptions({ input: { projectId } })
	);
	const useRecipe = useMutation(orpc.productionRecipes.use.mutationOptions());
	const versions = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	const [validation, setValidation] = useState("");
	const version = recipe.versions.at(-1);
	const form = useForm({
		defaultValues: {
			assetRecordId: "",
			lockedUnitVersionIds: [] as string[],
			width: "",
			height: "",
			fillIns: Object.fromEntries(
				(version?.content.fields ?? [])
					.filter((field) => field.mode === "fill_in")
					.map((field) => [field.key, ""])
			),
		},
		onSubmit: async ({ value }) => {
			const parsed = productionRecipeUseInputSchema.safeParse({
				projectId,
				recipeId: recipe.id,
				assetRecordId: value.assetRecordId,
				fillIns: value.fillIns,
				lockedUnitVersionIds: value.lockedUnitVersionIds,
				targetDimensions: {
					width: Number(value.width),
					height: Number(value.height),
				},
			});
			if (
				!parsed.success ||
				Object.values(value.fillIns).some((entry) => !entry.trim())
			) {
				setValidation(
					"Choose a target, enter valid dimensions and complete every fill-in field."
				);
				return;
			}
			setValidation("");
			try {
				await useRecipe.mutateAsync(parsed.data);
			} catch {
				/* displayed below */
			}
		},
	});
	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<h3>Use Production Recipe</h3>
			<form.Field name="assetRecordId">
				{(field) => (
					<label htmlFor={`${formId}-target`}>
						Target Asset Record
						<NativeSelect
							id={`${formId}-target`}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						>
							<NativeSelectOption value="">
								Choose an Asset Record
							</NativeSelectOption>
							{records.data?.map((record) => (
								<NativeSelectOption key={record.id} value={record.id}>
									{record.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</label>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.values.assetRecordId}>
				{(recordId) =>
					recordId ? (
						<fieldset>
							<legend>Locked Unit Versions (optional)</legend>
							{versions.isPending ? (
								<p role="status">Loading Unit Versions…</p>
							) : null}
							{versions.isError ? (
								<p role="alert">Unit Versions could not be loaded.</p>
							) : null}
							<form.Field name="lockedUnitVersionIds">
								{(field) =>
									(versions.data?.unitVersions ?? [])
										.filter((unit) => unit.assetRecordId === recordId)
										.map((unit) => (
											<label
												htmlFor={`${formId}-unit-${unit.id}`}
												key={unit.id}
											>
												<Checkbox
													checked={field.state.value.includes(unit.id)}
													id={`${formId}-unit-${unit.id}`}
													onCheckedChange={(checked) =>
														field.handleChange(
															checked
																? [...field.state.value, unit.id]
																: field.state.value.filter(
																		(id) => id !== unit.id
																	)
														)
													}
												/>
												{unit.unitType} {unit.unitKey} v{unit.versionNumber}
											</label>
										))
								}
							</form.Field>
						</fieldset>
					) : null
				}
			</form.Subscribe>
			{(version?.content.referenceRoles ?? []).map((role) => (
				<p key={JSON.stringify(role)}>
					Reference Role: {role.role}
					{role.customPurpose ? ` — ${role.customPurpose}` : ""}
				</p>
			))}
			{(["width", "height"] as const).map((name) => (
				<form.Field key={name} name={name}>
					{(field) => (
						<label htmlFor={`${formId}-dimension-${name}`}>
							{name === "width" ? "Target width" : "Target height"}
							<Input
								id={`${formId}-dimension-${name}`}
								min="1"
								onChange={(e) => field.handleChange(e.target.value)}
								type="number"
								value={field.state.value}
							/>
						</label>
					)}
				</form.Field>
			))}
			{version?.content.fields
				.filter((field) => field.mode === "fill_in")
				.map((item) => (
					<form.Field key={item.key} name={`fillIns.${item.key}`}>
						{(field) => (
							<label htmlFor={`${formId}-fill-${item.key}`}>
								{item.label}
								<Input
									id={`${formId}-fill-${item.key}`}
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
								/>
							</label>
						)}
					</form.Field>
				))}
			{validation ? <p role="alert">{validation}</p> : null}
			{useRecipe.isError ? <p role="alert">{useRecipe.error.message}</p> : null}
			{useRecipe.isSuccess ? (
				<p role="status">Generation Package created.</p>
			) : null}
			<Button disabled={useRecipe.isPending} type="submit">
				Use recipe
			</Button>
		</form>
	);
}
