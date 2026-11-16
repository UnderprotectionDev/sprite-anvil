import {
	productionExperimentCreateInputSchema,
	productionExperimentLearningInputSchema,
} from "@sprite-anvil/api/production-experiments";
import { narrowestScopeChain } from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

export function ProductionExperimentsView({
	projectId,
}: {
	projectId: string;
}) {
	const records = useQuery(
		orpc.assetRecords.list.queryOptions({ input: { projectId } })
	);
	const [recordId, setRecordId] = useState<string | null>(null);
	return (
		<main className="mx-auto max-w-4xl space-y-4 p-6">
			<h1>Production Experiments</h1>
			{!!records.isPending && <p role="status">Loading Asset Records…</p>}
			{!!records.isError && (
				<p role="alert">Asset Records could not be loaded.</p>
			)}
			{records.isSuccess && records.data.length === 0 && (
				<p>No Asset Records are available.</p>
			)}
			<h2>Asset Records</h2>
			{records.data?.map((record) => (
				<Button
					key={record.id}
					onClick={() => setRecordId(record.id)}
					type="button"
				>
					{record.name}
				</Button>
			))}
			{!!recordId && (
				<ExperimentList
					assetRecordId={recordId}
					key={recordId}
					projectId={projectId}
				/>
			)}
		</main>
	);
}

function ExperimentList({
	projectId,
	assetRecordId,
}: {
	projectId: string;
	assetRecordId: string;
}) {
	const list = useQuery(
		orpc.productionExperiments.list.queryOptions({
			input: { projectId, assetRecordId },
		})
	);
	const create = useMutation(
		orpc.productionExperiments.create.mutationOptions()
	);
	const [selected, setSelected] = useState<string | null>(null);
	const packages = useQuery(
		orpc.generationPackages.list.queryOptions({
			input: { projectId, assetRecordId },
		})
	);
	const versions = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	const emptyTrial = () => ({
		label: "",
		generationPackageId: "",
		assetVersionId: "",
	});
	const form = useForm({
		defaultValues: { title: "", trials: [emptyTrial(), emptyTrial()] },
		onSubmit: async ({ value }) => {
			const parsed = productionExperimentCreateInputSchema.safeParse({
				projectId,
				assetRecordId,
				...value,
			});
			if (!parsed.success) {
				setValidation("Complete the title and each trial.");
				return;
			}
			setValidation(null);
			try {
				const result = await create.mutateAsync(parsed.data);
				await list.refetch();
				setSelected(result.id);
			} catch {
				/* mutation error is displayed below */
			}
		},
	});
	const trials = useStore(form.store, (state) => state.values.trials);
	const [validation, setValidation] = useState<string | null>(null);
	return (
		<section className="space-y-3">
			<h2>Experiments</h2>
			{!!list.isPending && <p role="status">Loading experiments…</p>}
			{!!list.isError && <p role="alert">Experiments could not be loaded.</p>}
			{list.isSuccess && list.data.length === 0 && <p>No experiments yet.</p>}
			{list.data?.map((experiment) => (
				<Button
					key={experiment.id}
					onClick={() => setSelected(experiment.id)}
					type="button"
				>
					{experiment.title}
				</Button>
			))}
			<form
				className="space-y-2"
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<h3>Create experiment</h3>
				<form.Field name="title">
					{(field) => (
						<label className="block" htmlFor="experiment-title">
							Title
							<Input
								id="experiment-title"
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</label>
					)}
				</form.Field>
				{!!(packages.isError || versions.isError) && (
					<p role="alert">Trial records could not be loaded.</p>
				)}
				<form.Field mode="array" name="trials">
					{(field) => (
						<>
							{field.state.value.map((_, index) => (
								/* biome-ignore lint/suspicious/noArrayIndexKey: Form array fields use positional paths. */
								<fieldset className="space-y-2" key={index}>
									<legend>Trial {index + 1}</legend>
									<form.Field name={`trials[${index}].label`}>
										{(item) => (
											<label className="block" htmlFor={`trial-${index}-label`}>
												Trial {index + 1} label
												<Input
													id={`trial-${index}-label`}
													onBlur={item.handleBlur}
													onChange={(event) =>
														item.handleChange(event.target.value)
													}
													value={item.state.value}
												/>
											</label>
										)}
									</form.Field>
									<form.Field name={`trials[${index}].generationPackageId`}>
										{(item) => (
											<label
												className="block"
												htmlFor={`trial-${index}-package`}
											>
												Trial {index + 1} Generation Package
												<NativeSelect
													id={`trial-${index}-package`}
													onChange={(event) => {
														item.handleChange(event.target.value);
														form.setFieldValue(
															`trials[${index}].assetVersionId`,
															""
														);
													}}
													value={item.state.value}
												>
													<NativeSelectOption value="">
														Choose a Generation Package
													</NativeSelectOption>
													{packages.data?.map((pkg) => (
														<NativeSelectOption key={pkg.id} value={pkg.id}>
															{pkg.targetTask} · {pkg.createdAt}
														</NativeSelectOption>
													))}
												</NativeSelect>
											</label>
										)}
									</form.Field>
									<form.Field name={`trials[${index}].assetVersionId`}>
										{(item) => (
											<label
												className="block"
												htmlFor={`trial-${index}-version`}
											>
												Trial {index + 1} Candidate Version
												<NativeSelect
													id={`trial-${index}-version`}
													onChange={(event) =>
														item.handleChange(event.target.value)
													}
													value={item.state.value}
												>
													<NativeSelectOption value="">
														Choose a Candidate Version
													</NativeSelectOption>
													{versions.data?.assetVersions
														.filter(
															(version) =>
																version.assetRecordId === assetRecordId &&
																version.productionEvidence?.manualImportEvidence
																	?.generationPackageId ===
																	trials[index]?.generationPackageId
														)
														.map((version) => (
															<NativeSelectOption
																key={version.id}
																value={version.id}
															>
																Version {version.versionNumber} ·{" "}
																{version.reviewDisposition}
															</NativeSelectOption>
														))}
												</NativeSelect>
											</label>
										)}
									</form.Field>
									{field.state.value.length > 2 && (
										<Button
											onClick={() => field.removeValue(index)}
											type="button"
										>
											Remove trial {index + 1}
										</Button>
									)}
								</fieldset>
							))}
							<Button
								disabled={field.state.value.length >= 20}
								onClick={() => field.pushValue(emptyTrial())}
								type="button"
							>
								Add trial
							</Button>
						</>
					)}
				</form.Field>
				{!!validation && <p role="alert">{validation}</p>}
				{!!create.isError && <p role="alert">{create.error.message}</p>}
				<Button disabled={create.isPending} type="submit">
					{create.isPending ? "Creating…" : "Create experiment"}
				</Button>
			</form>
			{!!selected && (
				<ExperimentDetail
					experimentId={selected}
					key={selected}
					onConcluded={() => void list.refetch()}
					projectId={projectId}
				/>
			)}
		</section>
	);
}

function ExperimentDetail({
	projectId,
	experimentId,
	onConcluded,
}: {
	projectId: string;
	experimentId: string;
	onConcluded: () => void;
}) {
	const detail = useQuery(
		orpc.productionExperiments.get.queryOptions({
			input: { projectId, experimentId },
		})
	);
	const conclude = useMutation(
		orpc.productionExperiments.conclude.mutationOptions()
	);
	if (detail.isPending) {
		return <p role="status">Loading experiment…</p>;
	}
	if (detail.isError) {
		return <p role="alert">Experiment could not be loaded.</p>;
	}
	const experiment = detail.data;
	return (
		<section className="space-y-3">
			<h2>{experiment.title}</h2>
			<h3>Trials</h3>
			{experiment.trials.map((trial) => (
				<p key={trial.id}>
					{trial.label} · Generation Package {trial.generationPackageId} ·
					Candidate Version {trial.candidateVersion.versionNumber} (
					{trial.candidateVersion.reviewDisposition})
				</p>
			))}
			<h3>Comparison</h3>
			<p>{experiment.comparison.statement}</p>
			{experiment.comparison.inputs.map((input) => (
				<div key={input.input}>
					<h4>
						{input.input}: {input.status}
					</h4>
					{input.trials.map((trial) => (
						<p key={trial.trialId}>
							{experiment.trials.find((t) => t.id === trial.trialId)?.label}:{" "}
							{trial.value === null
								? "Not provided"
								: JSON.stringify(trial.value)}
						</p>
					))}
				</div>
			))}
			{experiment.conclusion ? (
				<p>
					Conclusion: {experiment.conclusion.outcome}{" "}
					{experiment.conclusion.note}
				</p>
			) : (
				<>
					<h3>Conclude</h3>
					<p>Selection does not approve a Candidate Version.</p>
					{experiment.trials.map((trial) => (
						<Button
							disabled={conclude.isPending}
							key={trial.id}
							onClick={() =>
								void conclude
									.mutateAsync({
										projectId,
										experimentId,
										outcome: "selection_made",
										selectedTrialId: trial.id,
									})
									.then(() => {
										void detail.refetch();
										onConcluded();
									})
									.catch(() => undefined)
							}
							type="button"
						>
							Select {trial.label}
						</Button>
					))}
					{(["inconclusive", "abandoned"] as const).map((outcome) => (
						<Button
							disabled={conclude.isPending}
							key={outcome}
							onClick={() =>
								void conclude
									.mutateAsync({ projectId, experimentId, outcome })
									.then(() => {
										void detail.refetch();
										onConcluded();
									})
									.catch(() => undefined)
							}
							type="button"
						>
							{outcome}
						</Button>
					))}
					{!!conclude.isError && <p role="alert">{conclude.error.message}</p>}
				</>
			)}
			{!!experiment.conclusion && (
				<LearningForm
					assetRecordId={experiment.assetRecordId}
					experimentId={experimentId}
					projectId={projectId}
				/>
			)}
		</section>
	);
}

function learningRuleValue(type: string, value: string): unknown {
	switch (type) {
		case "number":
			return { type, value: value.trim() ? Number(value) : Number.NaN };
		case "boolean":
			return {
				type,
				value: value === "true" || (value === "false" ? false : null),
			};
		case "text_list":
			return {
				type,
				value: value
					.split("\n")
					.map((item) => item.trim())
					.filter(Boolean),
			};
		default:
			return { type: "text", value };
	}
}
function LearningValueInput({
	id,
	type,
	value,
	onChange,
	onBlur,
}: {
	id: string;
	type: string;
	value: string;
	onChange: (value: string) => void;
	onBlur: () => void;
}) {
	if (id === "value" && type === "text_list") {
		return (
			<Textarea
				id={id}
				onBlur={onBlur}
				onChange={(event) => onChange(event.target.value)}
				value={value}
			/>
		);
	}
	if (id === "value" && type === "boolean") {
		return (
			<NativeSelect
				id={id}
				onChange={(event) => onChange(event.target.value)}
				value={value}
			>
				<NativeSelectOption value="">Choose true or false</NativeSelectOption>
				<NativeSelectOption value="true">True</NativeSelectOption>
				<NativeSelectOption value="false">False</NativeSelectOption>
			</NativeSelect>
		);
	}
	return (
		<Input
			id={id}
			onBlur={onBlur}
			onChange={(event) => onChange(event.target.value)}
			value={value}
		/>
	);
}

function LearningForm({
	projectId,
	experimentId,
	assetRecordId,
}: {
	projectId: string;
	experimentId: string;
	assetRecordId: string;
}) {
	const projects = useQuery(orpc.projectContexts.list.queryOptions());
	const records = useQuery(
		orpc.assetRecords.list.queryOptions({ input: { projectId } })
	);
	const scopes = useQuery(
		orpc.contextScopes.list.queryOptions({ input: { projectId } })
	);
	const transfer = useMutation(
		orpc.productionExperiments.transferLearning.mutationOptions()
	);
	const [message, setMessage] = useState<string | null>(null);
	const form = useForm({
		defaultValues: {
			summary: "",
			comment: "",
			ruleId: "",
			operation: "add",
			supersedesRuleId: "",
			valueType: "text",
			scopeIndex: "0",
			value: "",
			rationale: "",
		},
		onSubmit: async ({ value }) => {
			const project = projects.data?.find((item) => item.id === projectId);
			const record = records.data?.find((item) => item.id === assetRecordId);
			if (!(project && record && scopes.data)) {
				setMessage("Context data could not be loaded.");
				return;
			}
			const chain = narrowestScopeChain(projectId, record, scopes.data);
			const scope = chain[Number(value.scopeIndex)];
			if (!scope) {
				setMessage("Choose an available scope.");
				return;
			}
			const ruleValue = learningRuleValue(value.valueType, value.value);
			const parsed = productionExperimentLearningInputSchema.safeParse({
				projectId,
				experimentId,
				baseContextRevisionId: project.currentContextRevision.id,
				summary: value.summary,
				comment: value.comment,
				widenScope: Number(value.scopeIndex) > 0,
				changes: [
					{
						operation: value.operation,
						ruleId: value.ruleId,
						scope,
						...(value.supersedesRuleId.trim()
							? { supersedesRuleId: value.supersedesRuleId.trim() }
							: {}),
						...(value.operation === "remove" ? {} : { value: ruleValue }),
						rationale: value.rationale,
						evidence: [{ kind: "user_decision", statement: value.comment }],
					},
				],
			});
			if (!parsed.success) {
				setMessage("Complete all learning fields with a valid rule ID.");
				return;
			}
			try {
				await transfer.mutateAsync(parsed.data);
				setMessage("Context Proposal created. It is not active.");
			} catch {
				setMessage("Context Proposal could not be created.");
			}
		},
	});
	const selectedType = useStore(form.store, (state) => state.values.valueType);
	const selectedOperation = useStore(
		form.store,
		(state) => state.values.operation
	);
	const selectedScopeIndex = useStore(
		form.store,
		(state) => state.values.scopeIndex
	);
	const selectedRecord = records.data?.find(
		(item) => item.id === assetRecordId
	);
	const chain =
		selectedRecord && scopes.data
			? narrowestScopeChain(projectId, selectedRecord, scopes.data)
			: [];
	const selectedScope = chain[Number(selectedScopeIndex)];
	const affectedRecords =
		selectedScope && scopes.data
			? records.data?.filter((item) =>
					narrowestScopeChain(projectId, item, scopes.data).some(
						(scope) =>
							scope.kind === selectedScope.kind && scope.id === selectedScope.id
					)
				)
			: [];
	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<h3>Transfer learning</h3>
			<p>Create a Context Proposal for review. It will not activate a rule.</p>
			<form.Field name="operation">
				{(field) => (
					<label className="block" htmlFor="learning-operation">
						Rule change
						<NativeSelect
							id="learning-operation"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						>
							<NativeSelectOption value="add">Add</NativeSelectOption>
							<NativeSelectOption value="replace">Replace</NativeSelectOption>
							<NativeSelectOption value="remove">Remove</NativeSelectOption>
						</NativeSelect>
					</label>
				)}
			</form.Field>
			<form.Field name="valueType">
				{(field) => (
					<label className="block" htmlFor="learning-value-type">
						Rule value type
						<NativeSelect
							id="learning-value-type"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						>
							<NativeSelectOption value="text">Text</NativeSelectOption>
							<NativeSelectOption value="number">Number</NativeSelectOption>
							<NativeSelectOption value="boolean">
								Boolean (true or false)
							</NativeSelectOption>
							<NativeSelectOption value="text_list">
								Text list (one per line)
							</NativeSelectOption>
						</NativeSelect>
					</label>
				)}
			</form.Field>
			<form.Field name="scopeIndex">
				{(field) => (
					<label className="block" htmlFor="learning-scope">
						Proposal scope
						<NativeSelect
							id="learning-scope"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						>
							{chain.map((scope, index) => (
								<NativeSelectOption
									key={`${scope.kind}:${scope.id}`}
									value={String(index)}
								>
									{scope.kind} · {scope.id}
									{index === 0 ? " (narrowest)" : " (wider)"}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</label>
				)}
			</form.Field>
			{!!selectedScope && (
				<div>
					<p>
						Current Asset Records in this scope (future production may be
						affected):
					</p>
					<ul>
						{affectedRecords?.map((item) => (
							<li key={item.id}>{item.name}</li>
						))}
					</ul>
				</div>
			)}
			{(
				[
					["summary", "Summary"],
					["comment", "Learning comment"],
					["ruleId", "Rule ID"],
					["supersedesRuleId", "Overrides inherited rule ID (optional)"],
					["value", "Rule value"],
					["rationale", "Rationale"],
				] as const
			)
				.filter(([name]) => name !== "value" || selectedOperation !== "remove")
				.map(([name, label]) => (
					<form.Field key={name} name={name}>
						{(field) => (
							<label className="block" htmlFor={name}>
								{label}
								<LearningValueInput
									id={name}
									onBlur={field.handleBlur}
									onChange={field.handleChange}
									type={selectedType}
									value={field.state.value}
								/>
							</label>
						)}
					</form.Field>
				))}
			<Button disabled={transfer.isPending} type="submit">
				Create Context Proposal
			</Button>
			{!!message && <p role="status">{message}</p>}
		</form>
	);
}
