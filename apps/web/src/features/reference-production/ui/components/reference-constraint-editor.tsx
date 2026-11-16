import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useStore } from "@tanstack/react-form";
import type {
	ReferenceFeature,
	ReferenceRole,
} from "@/utils/reference-board-contract";
import {
	defaultTransferredFeatures,
	referenceFeatureLabels,
	referenceFeatures,
	referenceRoleLabels,
	referenceRoles,
} from "@/utils/reference-board-contract";
import type { ReferenceConstraintForm } from "../../hooks/use-reference-constraint-form";
import type { ReferenceConstraintDraft } from "../../schemas";

export const emptyReferenceConstraintDraft = (): ReferenceConstraintDraft => ({
	contextOverrideRationale: "",
	customPurpose: "",
	forbiddenFeatures: [],
	notes: "",
	role: "pose",
	transferredFeatures: ["pose"],
});

function toggleFeature(
	current: readonly ReferenceFeature[],
	feature: ReferenceFeature,
	checked: boolean
) {
	return checked
		? [...new Set([...current, feature])]
		: current.filter((item) => item !== feature);
}

function FeatureChoices({
	form,
	idPrefix,
	legend,
	name,
	readOnly,
}: {
	form: ReferenceConstraintForm;
	idPrefix: string;
	legend: string;
	name: "forbiddenFeatures" | "transferredFeatures";
	readOnly: boolean;
}) {
	return (
		<FieldSet className="gap-2">
			<FieldLegend className="mb-0">{legend}</FieldLegend>
			<form.Field name={name}>
				{(field) => (
					<div className="grid gap-2 sm:grid-cols-2">
						{referenceFeatures.map((feature) => (
							<Label className="min-h-11 text-sm leading-normal" key={feature}>
								<Checkbox
									aria-label={referenceFeatureLabels[feature]}
									checked={field.state.value.includes(feature)}
									disabled={readOnly}
									id={`${idPrefix}-${legend}-${feature}`}
									onCheckedChange={(checked) =>
										field.handleChange(
											toggleFeature(field.state.value, feature, checked)
										)
									}
								/>
								<span>{referenceFeatureLabels[feature]}</span>
							</Label>
						))}
					</div>
				)}
			</form.Field>
		</FieldSet>
	);
}

export function ReferenceConstraintEditor({
	form,
	hasCanonicalDesign,
	idPrefix,
	readOnly = false,
}: {
	form: ReferenceConstraintForm;
	hasCanonicalDesign: boolean;
	idPrefix: string;
	readOnly?: boolean;
}) {
	const role = useStore(form.store, (state) => state.values.role);
	const needsOverride = useStore(
		form.store,
		({ values }) =>
			hasCanonicalDesign &&
			values.transferredFeatures.includes("identity") &&
			!values.forbiddenFeatures.includes("identity")
	);

	return (
		<div className="space-y-4">
			<form.Field name="role">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor={`${idPrefix}-role`}
					>
						<span>Reference usage purpose</span>
						<NativeSelect
							className="w-full"
							disabled={readOnly}
							id={`${idPrefix}-role`}
							onChange={(event) => {
								const nextRole = event.target.value as ReferenceRole;
								field.handleChange(nextRole);
								if (nextRole !== "custom") {
									form.setFieldValue("customPurpose", "");
								}
								form.setFieldValue(
									"transferredFeatures",
									defaultTransferredFeatures(nextRole)
								);
							}}
							value={field.state.value}
						>
							{referenceRoles.map((option) => (
								<NativeSelectOption key={option} value={option}>
									{referenceRoleLabels[option]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			{role === "custom" ? (
				<form.Field name="customPurpose">
					{(field) => (
						<Label
							className="block space-y-1 text-sm leading-normal"
							htmlFor={`${idPrefix}-custom-purpose`}
						>
							<span>Custom usage purpose</span>
							<Input
								className="min-h-11 w-full"
								disabled={readOnly}
								id={`${idPrefix}-custom-purpose`}
								maxLength={240}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
			) : null}
			<FeatureChoices
				form={form}
				idPrefix={idPrefix}
				legend="Transferable features"
				name="transferredFeatures"
				readOnly={readOnly}
			/>
			<FeatureChoices
				form={form}
				idPrefix={idPrefix}
				legend="Avoided features"
				name="forbiddenFeatures"
				readOnly={readOnly}
			/>
			<p className="text-muted-foreground text-xs">
				A Generation Package cannot be created when permission and prohibition
				conflict for the same feature. Edit a rule to resolve the conflict.
			</p>
			{needsOverride ? (
				<form.Field name="contextOverrideRationale">
					{(field) => (
						<Label
							className="block space-y-1 text-sm leading-normal"
							htmlFor={`${idPrefix}-context-override`}
						>
							<span>Context Override rationale</span>
							<Textarea
								aria-describedby={`${idPrefix}-context-override-help`}
								className="min-h-20 w-full"
								disabled={readOnly}
								id={`${idPrefix}-context-override`}
								maxLength={1000}
								onChange={(event) => field.handleChange(event.target.value)}
								required
								value={field.state.value}
							/>
							<span
								className="text-muted-foreground text-xs"
								id={`${idPrefix}-context-override-help`}
							>
								A rationale is required because this exceeds the identity
								boundary of the Asset Family Canonical Design version.
							</span>
						</Label>
					)}
				</form.Field>
			) : null}
			<form.Field name="notes">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor={`${idPrefix}-notes`}
					>
						<span>Reference note</span>
						<Textarea
							className="min-h-20 w-full"
							disabled={readOnly}
							id={`${idPrefix}-notes`}
							maxLength={1000}
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
		</div>
	);
}
