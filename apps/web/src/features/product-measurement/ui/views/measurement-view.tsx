import {
	type MeasurementDefinition,
	type MeasurementDefinitionActivateInput,
	measurementDefinitionActivateInputSchema,
	measurementEventFamilySchema,
} from "@sprite-anvil/api/measurement-definitions";
import type { MeasurementMeasureReport } from "@sprite-anvil/api/measurement-measures";
import { productMeasurementEvents } from "@sprite-anvil/api/measurement-workflows";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { Input } from "@sprite-anvil/ui/components/input";
import { NativeSelect } from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

function eventListId(name: string): string | undefined {
	if (name === "startEvent") {
		return "measurement-start-events";
	}
	if (name === "endEvent") {
		return "measurement-end-events";
	}
	return undefined;
}

export function MeasurementView() {
	const client = useQueryClient();
	const options = orpc.measurementDefinitions.list.queryOptions();
	const list = useQuery(options);
	const activation = useMutation(
		orpc.measurementDefinitions.activate.mutationOptions()
	);
	const computation = useMutation(
		orpc.measurementMeasures.compute.mutationOptions()
	);
	return (
		<main>
			<h1>Measurements</h1>
			{!!list.isLoading && <p>Loading Measurement Definitions…</p>}
			{!!list.error && <p role="alert">{list.error.message}</p>}
			{!!list.data && (
				<MeasurementContent
					activate={async (input) => {
						await activation.mutateAsync(input);
						await client.invalidateQueries({ queryKey: options.queryKey });
					}}
					compute={() => computation.mutateAsync()}
					definitions={list.data.definitions}
				/>
			)}
		</main>
	);
}

export function MeasurementContent({
	definitions,
	activate,
	compute,
}: {
	definitions: MeasurementDefinition[];
	activate: (input: MeasurementDefinitionActivateInput) => Promise<unknown>;
	compute: () => Promise<MeasurementMeasureReport>;
}) {
	const [error, setError] = useState("");
	const [report, setReport] = useState<MeasurementMeasureReport>();
	const form = useForm({
		defaultValues: {
			metricId: "",
			contractVersion: "1.0",
			eventFamily: "production_workflow",
			startEvent: "",
			endEvent: "",
			numerator: "",
			denominator: "",
			exclusions: "",
			users: "owner_only",
			projects: "all_projects",
			projectIds: "",
			web: true,
			desktop: false,
			timeWindowDays: "30",
			retentionDays: "30",
			decisionUse: "",
		},
		onSubmit: async ({ value }) => {
			const parsed = measurementDefinitionActivateInputSchema.safeParse({
				id: crypto.randomUUID(),
				metricId: value.metricId,
				contractVersion: value.contractVersion,
				eventFamily: value.eventFamily,
				startEvent: value.startEvent,
				endEvent: value.endEvent,
				numerator: { outcomeClass: value.numerator },
				denominator: { outcomeClass: value.denominator },
				exclusions: value.exclusions
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
				scope: {
					users: value.users,
					projects:
						value.projects === "all_projects"
							? { kind: "all_projects" }
							: {
									kind: "listed_projects",
									projectIds: value.projectIds
										.split(",")
										.map((s) => s.trim())
										.filter(Boolean),
								},
					surfaces: [
						...(value.web ? ["web"] : []),
						...(value.desktop ? ["desktop"] : []),
					],
				},
				timeWindowDays: Number(value.timeWindowDays),
				retentionDays: Number(value.retentionDays),
				decisionUse: value.decisionUse,
			});
			if (!parsed.success) {
				setError(
					parsed.error.issues
						.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
						.join(" ")
				);
				return;
			}
			try {
				setError("");
				await activate(parsed.data);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Activation failed");
			}
		},
	});
	const fields = [
		["metricId", "Metric ID"],
		["contractVersion", "Contract version"],
		["startEvent", "Start event"],
		["endEvent", "End event"],
		["numerator", "Numerator outcome class"],
		["denominator", "Denominator outcome class"],
		["exclusions", "Exclusion rules (comma separated)"],
		["projectIds", "Project IDs (comma separated, for listed projects)"],
		["timeWindowDays", "Time window (days)"],
		["retentionDays", "Retention (days)"],
		["decisionUse", "Product decision"],
	] as const;
	return (
		<>
			<section>
				<h2>Measurement Definitions</h2>
				{definitions.length === 0 && (
					<p>No Measurement Definitions activated.</p>
				)}
				{definitions.map((d) => (
					<p key={d.id}>
						{d.metricId} — version {d.version} (contract {d.contractVersion})
					</p>
				))}
			</section>
			<section>
				<h2>Activate Measurement Definition</h2>
				<p>
					Event and outcome identifiers use lowercase letters, digits and
					underscores. Time is recorded by the server.
				</p>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void form.handleSubmit();
					}}
				>
					{fields.map(([name, label]) => (
						<form.Field key={name} name={name}>
							{(field) => (
								<label htmlFor={name}>
									{label}
									<Input
										id={name}
										list={eventListId(name)}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										value={field.state.value}
									/>
								</label>
							)}
						</form.Field>
					))}
					<form.Subscribe selector={(state) => state.values.eventFamily}>
						{(family) =>
							(["start", "finish"] as const).map((phase) => (
								<datalist
									id={
										phase === "start"
											? "measurement-start-events"
											: "measurement-end-events"
									}
									key={phase}
								>
									{productMeasurementEvents
										.filter(
											(event) =>
												event.family === family && event.phase === phase
										)
										.map((event) => (
											<option key={event.name} value={event.name} />
										))}
								</datalist>
							))
						}
					</form.Subscribe>
					<form.Field name="eventFamily">
						{(field) => (
							<label htmlFor="eventFamily">
								Event family
								<NativeSelect
									id="eventFamily"
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
								>
									{measurementEventFamilySchema.options.map((x) => (
										<option key={x} value={x}>
											{x}
										</option>
									))}
								</NativeSelect>
							</label>
						)}
					</form.Field>
					<form.Field name="users">
						{(field) => (
							<label htmlFor="users">
								Users
								<NativeSelect
									id="users"
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
								>
									<option value="owner_only">Owner only</option>
									<option value="all_users">All users</option>
								</NativeSelect>
							</label>
						)}
					</form.Field>
					<form.Field name="projects">
						{(field) => (
							<label htmlFor="projects">
								Projects
								<NativeSelect
									id="projects"
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
								>
									<option value="all_projects">All projects</option>
									<option value="listed_projects">Listed projects</option>
								</NativeSelect>
							</label>
						)}
					</form.Field>
					{(["web", "desktop"] as const).map((name) => (
						<form.Field key={name} name={name}>
							{(field) => (
								<label htmlFor={name}>
									<Checkbox
										checked={field.state.value}
										id={name}
										onCheckedChange={(checked) => field.handleChange(checked)}
									/>
									{name}
								</label>
							)}
						</form.Field>
					))}
					<Button type="submit">Activate Measurement Definition</Button>
				</form>
			</section>
			<section>
				<h2>Measurement report</h2>
				<Button
					onClick={async () => {
						try {
							setError("");
							setReport(await compute());
						} catch (e) {
							setReport(undefined);
							setError(e instanceof Error ? e.message : "Compute failed");
						}
					}}
				>
					Compute report
				</Button>
				{!!report && (
					<>
						<p>
							Product success is not claimed without a baseline and agreed
							target.
						</p>
						{report.measures.length === 0 && (
							<p>No data: no Measurement Definitions are available.</p>
						)}
						{report.measures.map((m) => (
							<article key={m.definitionId}>
								<h3>
									{m.metricId} — version {m.version} (contract{" "}
									{m.contractVersion})
								</h3>
								<p>
									Window starts {m.windowStart}; report as of {report.asOf}.
								</p>
								<p>
									Completed flows: {m.duration.completedFlows}. Median duration:{" "}
									{m.duration.medianMs === null
										? "No data"
										: `${m.duration.medianMs} ms`}
									. Minimum: {m.duration.minMs ?? "No data"} ms; maximum:{" "}
									{m.duration.maxMs ?? "No data"} ms.
								</p>
								<p>
									Numerator ({m.success.numerator.outcomeClass}):{" "}
									{m.success.numerator.count}; denominator (
									{m.success.denominator.outcomeClass}):{" "}
									{m.success.denominator.count}.
								</p>
								<p>
									Incomplete flows: {m.abandonment.total}; missing start:{" "}
									{m.abandonment.missingStart}; missing end:{" "}
									{m.abandonment.missingEnd}. These flows are excluded from
									completed durations.
								</p>
								<p>
									Excluded flows: {m.excludedFlows}; unused end events:{" "}
									{m.unusedEndEvents}.
								</p>
								<h4>Guardrail counts</h4>
								{Object.entries(m.guardrail.endOutcomeCounts).map(([k, v]) => (
									<p key={k}>
										Outcome {k}: {v}
									</p>
								))}
								{Object.entries(m.guardrail.counterTotals).map(([k, v]) => (
									<p key={k}>
										Counter {k}: {v}
									</p>
								))}
							</article>
						))}
					</>
				)}
			</section>
			{!!error && <p role="alert">{error}</p>}
		</>
	);
}
