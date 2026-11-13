import type { DeliveryTarget } from "@sprite-anvil/api/delivery-planning-outputs";
import { rightsRecordStates } from "@sprite-anvil/api/rights-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type SyntheticEvent, useRef, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { errorCodeOf } from "@/utils/error-code";
import { useSaveDeliveryTargetDraft } from "../../hooks/use-delivery-target-writes";
import {
	errorMessageOf,
	productionRequirementLabels,
	purposeLabels,
	rightsStateLabels,
	rightsSubjectLabels,
} from "../../lib/delivery-planning-labels";
import {
	defaultFormValues,
	type FamilyListChoice,
	toSaveInput,
} from "../../lib/delivery-target-form";
import { deliveryTargetFormSchema } from "../../schemas";

const selectClassName = "w-full [&>select]:min-h-10";
const requirementKeys = Object.keys(productionRequirementLabels) as Array<
	keyof typeof productionRequirementLabels
>;
const purposeKeys = Object.keys(purposeLabels) as Array<
	keyof typeof purposeLabels
>;
const subjectKeys = Object.keys(rightsSubjectLabels) as Array<
	keyof typeof rightsSubjectLabels
>;

function FieldErrors({ errors }: { errors: unknown[] }) {
	const messages = errors.flatMap((error) =>
		typeof error === "object" && error !== null && "message" in error
			? [String(error.message)]
			: []
	);
	if (messages.length === 0) {
		return null;
	}
	return (
		<ul className="space-y-1 text-destructive text-sm">
			{messages.map((message) => (
				<li key={message}>{message}</li>
			))}
		</ul>
	);
}

export function DeliveryTargetDraftForm({
	contextRevision,
	families,
	onClose,
	projectId,
	target,
}: {
	contextRevision: { id: string; isActive: boolean; revisionNumber: number };
	families: FamilyListChoice[];
	onClose: () => void;
	projectId: string;
	target: DeliveryTarget | null;
}) {
	const saveDraft = useSaveDeliveryTargetDraft(projectId);
	const [failure, setFailure] = useState<string | null>(null);
	// The ids make a retry after an uncertain outcome idempotent; a server verdict ends them.
	const ids = useRef({
		deliveryTargetId: target?.id ?? crypto.randomUUID(),
		draftId: crypto.randomUUID(),
	});

	const form = useForm({
		defaultValues: defaultFormValues(families, {
			name: target?.name ?? "",
			purpose: target?.purpose ?? "",
			revision: target?.activeRevision ?? null,
		}),
		onSubmit: async ({ value }) => {
			setFailure(null);
			try {
				await saveDraft.mutateAsync(
					toSaveInput(value, {
						contextRevisionId: contextRevision.id,
						deliveryTargetId: ids.current.deliveryTargetId,
						draftId: ids.current.draftId,
						projectId,
					})
				);
				onClose();
			} catch (error) {
				if (errorCodeOf(error)) {
					ids.current.draftId = crypto.randomUUID();
				}
				setFailure(
					errorMessageOf(error) ?? "The draft could not be saved. Try again."
				);
			}
		},
		validators: { onSubmit: deliveryTargetFormSchema },
	});

	const submit = (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		void form.handleSubmit();
	};
	const isRevision = target !== null;

	return (
		<form
			aria-label={isRevision ? "New revision draft" : "New Delivery Target"}
			className="space-y-6 rounded-lg border p-4"
			onSubmit={submit}
		>
			<h2 className="font-semibold text-xl">
				{isRevision ? `New revision of ${target.name}` : "New Delivery Target"}
			</h2>
			<p className="text-muted-foreground text-sm">
				A draft changes nothing official. It becomes a revision only when you
				activate it after review.
			</p>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="delivery-target-name">Name</Label>
					<form.Field name="name">
						{(field) => (
							<>
								<Input
									disabled={isRevision}
									id="delivery-target-name"
									maxLength={120}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
								<FieldErrors errors={field.state.meta.errors} />
							</>
						)}
					</form.Field>
				</div>
				<div className="space-y-2">
					<Label htmlFor="delivery-target-purpose">Purpose</Label>
					<form.Field name="purpose">
						{(field) => (
							<>
								<NativeSelect
									className={selectClassName}
									disabled={isRevision}
									id="delivery-target-purpose"
									onChange={(event) =>
										field.handleChange(
											event.target.value as typeof field.state.value
										)
									}
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Choose a purpose
									</NativeSelectOption>
									{purposeKeys.map((purpose) => (
										<NativeSelectOption key={purpose} value={purpose}>
											{purposeLabels[purpose]}
										</NativeSelectOption>
									))}
								</NativeSelect>
								<FieldErrors errors={field.state.meta.errors} />
							</>
						)}
					</form.Field>
				</div>
			</div>

			<div className="space-y-1">
				<p className="font-medium text-sm">Context Revision</p>
				<p className="text-sm">
					Context Revision {contextRevision.revisionNumber} (current,{" "}
					{contextRevision.isActive ? "active" : "not yet activated"})
				</p>
				<p className="text-muted-foreground text-xs">
					The target pins the project's current Context Revision.
				</p>
			</div>

			<FieldSet>
				<FieldLegend variant="label">Asset Families</FieldLegend>
				<p className="text-muted-foreground text-sm">
					Pin at least two families and the Required Items List revision each is
					judged against. The family's own list is never replaced.
				</p>
				<form.Field name="families">
					{(familiesField) => (
						<div className="space-y-3">
							{familiesField.state.value.map((family, index) => {
								const choice = families.find(
									(candidate) => candidate.id === family.assetFamilyId
								);
								const revisions = choice?.revisions ?? [];
								if (revisions.length === 0) {
									return (
										<div
											className="space-y-1 rounded-md border p-3 opacity-80"
											key={family.assetFamilyId}
										>
											<Label className="flex items-center gap-2 text-sm">
												<Checkbox checked={false} disabled />
												{family.assetFamilyName}
											</Label>
											<p className="text-muted-foreground text-xs">
												{family.assetFamilyName} has no Required Items List
												revision yet.
											</p>
										</div>
									);
								}
								return (
									<div
										className="space-y-3 rounded-md border p-3"
										key={family.assetFamilyId}
									>
										<form.Field name={`families[${index}].selected`}>
											{(field) => (
												<Label className="flex items-center gap-2 font-medium text-sm">
													<Checkbox
														checked={field.state.value}
														onCheckedChange={(checked) =>
															field.handleChange(Boolean(checked))
														}
													/>
													{family.assetFamilyName}
												</Label>
											)}
										</form.Field>
										{family.selected ? (
											<div className="grid gap-3 sm:grid-cols-2">
												<form.Field
													name={`families[${index}].requiredSetRevisionId`}
												>
													{(field) => (
														<NativeSelect
															aria-label={`Required Items List revision for ${family.assetFamilyName}`}
															className={selectClassName}
															onChange={(event) =>
																field.handleChange(event.target.value)
															}
															value={field.state.value}
														>
															{revisions.map((revision) => (
																<NativeSelectOption
																	key={revision.id}
																	value={revision.id}
																>
																	Required Items List revision{" "}
																	{revision.revisionNumber}
																	{revision.isActive ? " (active)" : ""}
																</NativeSelectOption>
															))}
														</NativeSelect>
													)}
												</form.Field>
												<form.Field
													name={`families[${index}].productionRequirement`}
												>
													{(field) => (
														<NativeSelect
															aria-label={`Production Evidence requirement for ${family.assetFamilyName}`}
															className={selectClassName}
															onChange={(event) =>
																field.handleChange(
																	event.target.value as typeof field.state.value
																)
															}
															value={field.state.value}
														>
															<NativeSelectOption value="default">
																Use the default requirement
															</NativeSelectOption>
															{requirementKeys.map((requirement) => (
																<NativeSelectOption
																	key={requirement}
																	value={requirement}
																>
																	{productionRequirementLabels[requirement]}
																</NativeSelectOption>
															))}
														</NativeSelect>
													)}
												</form.Field>
											</div>
										) : null}
									</div>
								);
							})}
							<FieldErrors errors={familiesField.state.meta.errors} />
						</div>
					)}
				</form.Field>
			</FieldSet>

			<FieldSet>
				<FieldLegend variant="label">Production Evidence Policy</FieldLegend>
				<div className="space-y-2">
					<Label htmlFor="delivery-target-default-production">
						Default Production Evidence requirement
					</Label>
					<form.Field name="defaultProductionRequirement">
						{(field) => (
							<>
								<NativeSelect
									className={selectClassName}
									id="delivery-target-default-production"
									onChange={(event) =>
										field.handleChange(
											event.target.value as typeof field.state.value
										)
									}
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Choose a requirement
									</NativeSelectOption>
									{requirementKeys.map((requirement) => (
										<NativeSelectOption key={requirement} value={requirement}>
											{productionRequirementLabels[requirement]}
										</NativeSelectOption>
									))}
								</NativeSelect>
								<FieldErrors errors={field.state.meta.errors} />
							</>
						)}
					</form.Field>
				</div>
			</FieldSet>

			<FieldSet>
				<FieldLegend variant="label">Rights Evidence Policy</FieldLegend>
				<p className="text-muted-foreground text-sm">
					Which Rights Record states the target accepts. The product compares
					states; it does not judge legal sufficiency.
				</p>
				<form.Field name="acceptableStates">
					{(field) => (
						<div className="space-y-2">
							{rightsRecordStates.map((state) => (
								<Label className="flex items-center gap-2 text-sm" key={state}>
									<Checkbox
										checked={field.state.value.includes(state)}
										onCheckedChange={(checked) =>
											field.handleChange(
												checked
													? [...field.state.value, state]
													: field.state.value.filter((value) => value !== state)
											)
										}
									/>
									{rightsStateLabels[state]}
								</Label>
							))}
							<FieldErrors errors={field.state.meta.errors} />
						</div>
					)}
				</form.Field>
				<p className="font-medium text-sm">Require Rights Records for</p>
				<form.Field name="requireRecordFor">
					{(field) => (
						<div className="space-y-2">
							{subjectKeys.map((subject) => (
								<Label
									className="flex items-center gap-2 text-sm"
									key={subject}
								>
									<Checkbox
										checked={field.state.value.includes(subject)}
										onCheckedChange={(checked) =>
											field.handleChange(
												checked
													? [...field.state.value, subject]
													: field.state.value.filter(
															(value) => value !== subject
														)
											)
										}
									/>
									{rightsSubjectLabels[subject]}
								</Label>
							))}
						</div>
					)}
				</form.Field>
			</FieldSet>

			<FieldSet>
				<FieldLegend variant="label">Runtime validation</FieldLegend>
				<p className="text-muted-foreground text-sm">
					Optional acceptance criterion. When required, the target is ready only
					through a current Pass you finalized for the exact Export Bundle in
					each environment listed here. An unconfirmed failure source blocks it.
				</p>
				<form.Field name="requireRuntimeValidation">
					{(field) => (
						<Label className="flex items-center gap-2 text-sm">
							<Checkbox
								checked={field.state.value}
								onCheckedChange={(checked) =>
									field.handleChange(Boolean(checked))
								}
							/>
							Require runtime validation
						</Label>
					)}
				</form.Field>
				<form.Subscribe
					selector={(state) => state.values.requireRuntimeValidation}
				>
					{(required) =>
						required ? (
							<form.Field mode="array" name="runtimeEnvironments">
								{(environments) => (
									<div className="space-y-3">
										{environments.state.value.map((_, index) => (
											<div
												className="space-y-2 rounded-md border p-3"
												// biome-ignore lint/suspicious/noArrayIndexKey: environments have no id before they are saved
												key={index}
											>
												<div className="grid gap-3 sm:grid-cols-3">
													{(
														[
															["gameBuild", "Game build"],
															["engineVersion", "Engine version"],
															["adapterVersion", "Adapter version (optional)"],
														] as const
													).map(([key, label]) => (
														<form.Field
															key={key}
															name={`runtimeEnvironments[${index}].${key}`}
														>
															{(field) => (
																<div className="space-y-1">
																	<Label
																		htmlFor={`delivery-target-runtime-${index}-${key}`}
																	>
																		{label}
																	</Label>
																	<Input
																		id={`delivery-target-runtime-${index}-${key}`}
																		maxLength={200}
																		onBlur={field.handleBlur}
																		onChange={(event) =>
																			field.handleChange(event.target.value)
																		}
																		value={field.state.value}
																	/>
																	<FieldErrors
																		errors={field.state.meta.errors}
																	/>
																</div>
															)}
														</form.Field>
													))}
												</div>
												<Button
													onClick={() => environments.removeValue(index)}
													type="button"
													variant="outline"
												>
													Remove environment
												</Button>
											</div>
										))}
										<Button
											onClick={() =>
												environments.pushValue({
													adapterVersion: "",
													engineVersion: "",
													gameBuild: "",
												})
											}
											type="button"
											variant="outline"
										>
											Add environment
										</Button>
										<FieldErrors errors={environments.state.meta.errors} />
									</div>
								)}
							</form.Field>
						) : null
					}
				</form.Subscribe>
				<p className="text-muted-foreground text-xs">
					A Pass counts as current while no later record for the same Export
					Bundle and environment supersedes it.
				</p>
			</FieldSet>

			{failure ? <StatusMessage tone="error">{failure}</StatusMessage> : null}
			<div className="flex flex-wrap gap-2">
				<Button
					className="min-h-11"
					disabled={saveDraft.isPending}
					type="submit"
				>
					{saveDraft.isPending ? "Saving…" : "Save draft"}
				</Button>
				<Button
					className="min-h-11"
					onClick={onClose}
					type="button"
					variant="outline"
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}
