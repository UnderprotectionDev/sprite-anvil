import type { ReferenceFeature } from "@sprite-anvil/api/asset-record-tracking";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { UnitVersion } from "@sprite-anvil/api/asset-versions";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type {
	ContextRule,
	ContextScope,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type z from "zod";
import { StatusMessage } from "@/components/status-message";
import { generationPackageFormSchema } from "@/features/generation-packages/schemas";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { usePendingIdempotencyKey } from "@/utils/pending-idempotency-key";

const referenceRoleLabels = {
	avoid: "Avoided feature",
	composition: "Composition",
	custom: "Custom usage purpose",
	equipment: "Equipment",
	identity: "Identity",
	palette: "Palette",
	pose: "Pose or motion",
	style: "Drawing style",
	theme: "Theme",
} as const;

const referenceFeatureLabels: Record<ReferenceFeature, string> = {
	composition: "Composition",
	equipment: "Equipment",
	identity: "Identity",
	palette: "Palette",
	pose: "Pose or motion",
	style: "Drawing style",
	theme: "Theme",
};

const unitTypeLabels = {
	direction: "Direction",
	frame: "Frame",
	state: "State",
	tile: "Tiling",
} as const;

const contextScopeLabels: Record<ContextScope["kind"], string> = {
	asset: "Asset",
	asset_family: "Asset Family",
	operation: "Operation",
	project: "Project",
	theme: "Theme",
	visual_world: "Visual World",
};

type GenerationPackageFormValues = z.infer<typeof generationPackageFormSchema>;

const newlinePattern = /\r?\n/u;

function formatContextRuleValue(rule: ContextRule) {
	switch (rule.value.type) {
		case "boolean":
			return rule.value.value ? "Yes" : "No";
		case "number":
			return String(rule.value.value);
		case "text":
			return rule.value.value;
		case "text_list":
			return rule.value.value.join(", ");
		default: {
			const exhaustiveCheck: never = rule.value;
			return exhaustiveCheck;
		}
	}
}

function formatContextScope(scope: ContextScope) {
	return `${contextScopeLabels[scope.kind]} · ${scope.id}`;
}

function getUnitVersionLabel(
	unit: Pick<UnitVersion, "unitKey" | "unitType" | "versionNumber">
) {
	return `${unit.unitKey} · ${unitTypeLabels[unit.unitType]} · Version ${unit.versionNumber}`;
}

function parseConstraintLines(value: string) {
	return value
		.split(newlinePattern)
		.map((line) => line.trim())
		.filter(Boolean);
}

function getDateLabel(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function GenerationPackageDetails({
	generationPackage,
}: {
	generationPackage: GenerationPackage;
}) {
	const { productionContextSnapshot: context } = generationPackage;
	return (
		<details className="rounded-lg border p-4">
			<summary className="cursor-pointer font-medium">
				{generationPackage.targetTask} ·{" "}
				{getDateLabel(generationPackage.createdAt)}
			</summary>
			<div className="mt-4 space-y-5 text-sm">
				<section className="space-y-2">
					<h3 className="font-semibold">Production Context Snapshot</h3>
					<p>Context Revision {context.revisionNumber}</p>
					<p>{context.generalArtDirection}</p>
					<p>
						Visual World: {context.visualWorld?.name ?? "Not specified"} ·
						Theme: {context.theme?.name ?? "Not specified"}
					</p>
					{context.rules.length > 0 ? (
						<ul className="list-inside list-disc space-y-1">
							{context.rules.map((rule) => (
								<li key={`${rule.id}:${rule.scope.kind}:${rule.scope.id}`}>
									{rule.id} · Scope: {formatContextScope(rule.scope)} ·
									Precedence chain:{" "}
									{rule.precedenceChain.map(formatContextScope).join(" → ")} ·
									Value: {formatContextRuleValue(rule)}
								</li>
							))}
						</ul>
					) : (
						<p>No scoped Context Rule for this record.</p>
					)}
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">Target and dimensions</h3>
					<p>
						{generationPackage.targetDimensions.width} ×{" "}
						{generationPackage.targetDimensions.height} px
					</p>
					<p>
						Canonical Design:{" "}
						{generationPackage.canonicalDesign
							? `Version ${generationPackage.canonicalDesign.versionNumber}`
							: "Not selected"}
					</p>
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">Reference Usage Purposes</h3>
					{generationPackage.referenceRoles.length > 0 ? (
						<ul className="list-inside list-disc space-y-1">
							{generationPackage.referenceRoles.map((reference) => (
								<li key={`${reference.kind}:${reference.id}`}>
									{referenceRoleLabels[reference.role]} ·{" "}
									{reference.assetRecordName ??
										reference.fileName ??
										"Reference"}
									{reference.customPurpose
										? ` · Usage purpose: ${reference.customPurpose}`
										: ""}
									{reference.contextOverrideRationale
										? ` · Context Override rationale: ${reference.contextOverrideRationale}`
										: ""}
									{reference.transferredFeatures.length > 0
										? ` · Transferable: ${reference.transferredFeatures.map((feature) => referenceFeatureLabels[feature]).join(", ")}`
										: ""}
									{reference.forbiddenFeatures.length > 0
										? ` · Avoided: ${reference.forbiddenFeatures.map((feature) => referenceFeatureLabels[feature]).join(", ")}`
										: ""}
								</li>
							))}
						</ul>
					) : (
						<p>No Reference Usage Purpose added.</p>
					)}
				</section>
				{(
					[
						["Features to preserve", generationPackage.preserveConstraints],
						["Features to change", generationPackage.changeConstraints],
						["Features to avoid", generationPackage.avoidConstraints],
					] as const
				).map(([title, values]) => (
					<section className="space-y-2" key={title}>
						<h3 className="font-semibold">{title}</h3>
						{values.length > 0 ? (
							<ul className="list-inside list-disc space-y-1">
								{values.map((value) => (
									<li key={value}>{value}</li>
								))}
							</ul>
						) : (
							<p>Not specified.</p>
						)}
					</section>
				))}
				<section className="space-y-2">
					<h3 className="font-semibold">Unit Versions to keep unchanged</h3>
					{generationPackage.lockedUnits.length > 0 ? (
						<ul className="list-inside list-disc space-y-1">
							{generationPackage.lockedUnits.map((unit) => (
								<li key={unit.id}>{getUnitVersionLabel(unit)}</li>
							))}
						</ul>
					) : (
						<p>No Unit Version pinned.</p>
					)}
				</section>
				<section className="space-y-2">
					<h3 className="font-semibold">Expected output structure</h3>
					<p className="whitespace-pre-wrap">
						{generationPackage.expectedOutputStructure}
					</p>
				</section>
			</div>
		</details>
	);
}

function ConstraintField({
	id,
	label,
	onBlur,
	onValueChange,
	value,
}: {
	id: string;
	label: string;
	onBlur: () => void;
	onValueChange: (value: string) => void;
	value: string;
}) {
	return (
		<div className="space-y-2">
			<Label className="text-sm leading-normal font-medium" htmlFor={id}>
				{label}
			</Label>
			<Textarea
				className="min-h-16 w-full"
				id={id}
				maxLength={15_000}
				onBlur={onBlur}
				onChange={(event) => onValueChange(event.target.value)}
				value={value}
			/>
			<p className="text-muted-foreground text-xs">
				Enter one feature per line.
			</p>
		</div>
	);
}

export function GenerationPackagePanel({
	projectId,
	record,
}: {
	projectId: string;
	record: AssetRecord;
}) {
	const [isSaving, setIsSaving] = useState(false);
	const pendingPackageKey = usePendingIdempotencyKey();
	const createPackage = useMutation(
		orpc.generationPackages.create.mutationOptions(mutationMeta)
	);
	const [isCheckingOutcome, setIsCheckingOutcome] = useState(false);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const packagesQuery = useQuery(
		orpc.generationPackages.list.queryOptions({
			input: { assetRecordId: record.id, projectId },
		})
	);
	const assetVersionsQuery = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	const unitVersions = (assetVersionsQuery.data?.unitVersions ?? [])
		.filter((unit) => unit.assetRecordId === record.id)
		.toSorted((left, right) =>
			`${left.unitType}:${left.unitKey}:${left.versionNumber}`.localeCompare(
				`${right.unitType}:${right.unitKey}:${right.versionNumber}`
			)
		);
	const generationPackages = packagesQuery.data ?? [];

	function renderUnitVersionOptions(
		selectedIds: string[],
		toggle: (id: string, checked: boolean) => void,
		disabled: boolean
	) {
		if (assetVersionsQuery.isPending) {
			return (
				<p aria-live="polite" className="text-muted-foreground text-sm">
					Loading Unit Versions…
				</p>
			);
		}
		if (assetVersionsQuery.isError) {
			return (
				<div className="space-y-2">
					<StatusMessage tone="error">
						Could not load Unit Versions.
					</StatusMessage>
					<Button
						onClick={() => void assetVersionsQuery.refetch()}
						type="button"
						variant="outline"
					>
						Reload
					</Button>
				</div>
			);
		}
		if (unitVersions.length === 0) {
			return (
				<p className="text-muted-foreground text-sm">
					This Asset Record has no Unit Versions available to pin.
				</p>
			);
		}
		return (
			<div className="space-y-2">
				{unitVersions.map((unit) => (
					<Label
						className="items-start gap-3 rounded-md border p-3 text-sm leading-normal"
						key={unit.id}
					>
						<Checkbox
							checked={selectedIds.includes(unit.id)}
							className="mt-0.5"
							disabled={disabled}
							onCheckedChange={(checked) => toggle(unit.id, checked)}
						/>
						<span>{getUnitVersionLabel(unit)}</span>
					</Label>
				))}
			</div>
		);
	}

	function renderSavedGenerationPackages() {
		if (packagesQuery.isPending) {
			return (
				<p aria-live="polite" className="text-muted-foreground text-sm">
					Loading Generation Packages…
				</p>
			);
		}
		if (packagesQuery.isError) {
			return (
				<div className="space-y-2">
					<StatusMessage tone="error">
						Could not load Generation Packages.
					</StatusMessage>
					<Button
						onClick={() => void packagesQuery.refetch()}
						type="button"
						variant="outline"
					>
						Reload
					</Button>
				</div>
			);
		}
		if (generationPackages.length === 0) {
			return (
				<p className="text-muted-foreground text-sm">
					This Asset Record has no Generation Packages yet.
				</p>
			);
		}
		return (
			<div className="space-y-3">
				{generationPackages.map((generationPackage) => (
					<GenerationPackageDetails
						generationPackage={generationPackage}
						key={generationPackage.id}
					/>
				))}
			</div>
		);
	}

	const form = useForm({
		defaultValues: {
			avoidConstraints: "",
			changeConstraints: "",
			expectedOutputStructure: "",
			lockedUnitVersionIds: [] as string[],
			preserveConstraints: "",
			targetHeight: String(
				record.measurements.logicalResolution.confirmed?.height ?? ""
			),
			targetTask: "",
			targetWidth: String(
				record.measurements.logicalResolution.confirmed?.width ?? ""
			),
		},
		onSubmit: ({ value }) => handleCreate(value),
		validators: { onSubmit: generationPackageFormSchema },
	});

	async function handleCreate(value: GenerationPackageFormValues) {
		if (writeOutcomeUncertain) {
			return;
		}
		setErrorMessage(null);
		setStatusMessage(null);
		setIsSaving(true);
		try {
			const request = {
				assetRecordId: record.id,
				avoidConstraints: parseConstraintLines(value.avoidConstraints),
				changeConstraints: parseConstraintLines(value.changeConstraints),
				expectedOutputStructure: value.expectedOutputStructure,
				lockedUnitVersionIds: value.lockedUnitVersionIds,
				preserveConstraints: parseConstraintLines(value.preserveConstraints),
				projectId,
				targetDimensions: {
					height: Number(value.targetHeight),
					width: Number(value.targetWidth),
				},
				targetTask: value.targetTask,
			};
			// A retry of the same form content reuses the key, so a lost response cannot add a second package.
			await createPackage.mutateAsync({
				...request,
				idempotencyKey: pendingPackageKey.keyFor(JSON.stringify(request)),
			});
			pendingPackageKey.clear();
			form.setFieldValue("targetTask", "");
			form.setFieldValue("expectedOutputStructure", "");
			form.setFieldValue("preserveConstraints", "");
			form.setFieldValue("changeConstraints", "");
			form.setFieldValue("avoidConstraints", "");
			form.setFieldValue("lockedUnitVersionIds", []);
			setStatusMessage("Generation Package created and saved.");
			try {
				const result = await packagesQuery.refetch();
				if (result.isError) {
					setErrorMessage(
						"Generation Package saved, but the list could not be refreshed. Reload saved Generation Packages."
					);
				}
			} catch {
				setErrorMessage(
					"Generation Package saved, but the list could not be refreshed. Reload saved Generation Packages."
				);
			}
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
				setErrorMessage(
					"Could not verify the result. Check saved Generation Packages before resubmitting the same request."
				);
			} else {
				setErrorMessage(
					getErrorMessage(
						error,
						"Could not create Generation Package. Check required information and try again."
					)
				);
			}
		} finally {
			setIsSaving(false);
		}
	}

	async function checkWriteOutcome() {
		setIsCheckingOutcome(true);
		try {
			const result = await packagesQuery.refetch();
			if (result.isError) {
				setErrorMessage(
					"Could not refresh saved Generation Packages. Check again before resubmitting the same request."
				);
				return;
			}
			setWriteOutcomeUncertain(false);
			setErrorMessage(null);
			setStatusMessage(
				"Saved Generation Packages refreshed. Review the result and create a new package if needed."
			);
		} catch {
			setErrorMessage(
				"Could not refresh saved Generation Packages. Check again before resubmitting the same request."
			);
		} finally {
			setIsCheckingOutcome(false);
		}
	}

	const canCreate =
		record.availability === "active" &&
		!isSaving &&
		!writeOutcomeUncertain &&
		!assetVersionsQuery.isPending &&
		!assetVersionsQuery.isError;

	return (
		<section
			aria-labelledby="generation-packages-heading"
			className="space-y-5 rounded-lg border p-5"
		>
			<header className="space-y-2">
				<h2 className="text-xl font-semibold" id="generation-packages-heading">
					Generation Packages
				</h2>
				<p className="text-muted-foreground text-sm">
					Pin active context and production boundaries for one external attempt.
					You write the natural language instruction in ChatGPT or another
					production surface.
				</p>
			</header>

			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<FieldSet
					className="gap-4"
					disabled={isSaving || writeOutcomeUncertain}
				>
					<FieldLegend className="sr-only">
						Generation Package details
					</FieldLegend>
					<form.Field name="targetTask">
						{(field) => (
							<div className="space-y-2">
								<Label
									className="text-sm leading-normal font-medium"
									htmlFor="generation-target-task"
								>
									Production target
								</Label>
								<Textarea
									className="min-h-20 w-full"
									id="generation-target-task"
									maxLength={2000}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								/>
							</div>
						)}
					</form.Field>

					<FieldSet className="gap-2">
						<FieldLegend className="mb-0" variant="label">
							Target dimensions
						</FieldLegend>
						<p className="text-muted-foreground text-sm">
							The record’s confirmed logical dimensions are used initially; you
							can change them for this attempt.
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							<form.Field name="targetWidth">
								{(field) => (
									<div className="space-y-2">
										<Label
											className="text-sm leading-normal font-medium"
											htmlFor="generation-target-width"
										>
											Target width (px)
										</Label>
										<Input
											id="generation-target-width"
											max={100_000}
											min={1}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											required
											step={1}
											type="number"
											value={field.state.value}
										/>
									</div>
								)}
							</form.Field>
							<form.Field name="targetHeight">
								{(field) => (
									<div className="space-y-2">
										<Label
											className="text-sm leading-normal font-medium"
											htmlFor="generation-target-height"
										>
											Target height (px)
										</Label>
										<Input
											id="generation-target-height"
											max={100_000}
											min={1}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											required
											step={1}
											type="number"
											value={field.state.value}
										/>
									</div>
								)}
							</form.Field>
						</div>
					</FieldSet>

					<form.Field name="preserveConstraints">
						{(field) => (
							<ConstraintField
								id="generation-preserve-constraints"
								label="Features to preserve"
								onBlur={field.handleBlur}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="changeConstraints">
						{(field) => (
							<ConstraintField
								id="generation-change-constraints"
								label="Features to change"
								onBlur={field.handleBlur}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>
					<form.Field name="avoidConstraints">
						{(field) => (
							<ConstraintField
								id="generation-avoid-constraints"
								label="Features to avoid"
								onBlur={field.handleBlur}
								onValueChange={field.handleChange}
								value={field.state.value}
							/>
						)}
					</form.Field>

					<form.Field name="expectedOutputStructure">
						{(field) => (
							<div className="space-y-2">
								<Label
									className="text-sm leading-normal font-medium"
									htmlFor="generation-expected-output"
								>
									Expected output structure
								</Label>
								<Textarea
									className="min-h-20 w-full"
									id="generation-expected-output"
									maxLength={2000}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								/>
							</div>
						)}
					</form.Field>

					<FieldSet className="gap-3" disabled={!canCreate}>
						<FieldLegend className="mb-0" variant="label">
							Unit Versions to keep unchanged
						</FieldLegend>
						<form.Field mode="array" name="lockedUnitVersionIds">
							{(field) =>
								renderUnitVersionOptions(
									field.state.value,
									(id, checked) => {
										if (checked) {
											field.pushValue(id);
											return;
										}
										field.removeValue(field.state.value.indexOf(id));
									},
									!canCreate
								)
							}
						</form.Field>
					</FieldSet>
				</FieldSet>

				{errorMessage ? (
					<StatusMessage
						className="border-destructive rounded-md border p-3"
						tone="error"
					>
						{errorMessage}
					</StatusMessage>
				) : null}
				{writeOutcomeUncertain ? (
					<Button
						disabled={isCheckingOutcome}
						onClick={() => void checkWriteOutcome()}
						type="button"
						variant="outline"
					>
						{isCheckingOutcome ? "Checking status…" : "Check status"}
					</Button>
				) : null}
				{statusMessage ? (
					<p aria-live="polite" className="text-sm" role="status">
						{statusMessage}
					</p>
				) : null}
				{record.availability === "active" ? (
					<Button disabled={!canCreate} type="submit">
						{isSaving ? "Kaydediliyor…" : "Pin Generation Package"}
					</Button>
				) : (
					<p className="text-muted-foreground text-sm">
						A new Generation Package cannot be created for an archived Asset
						Record.
					</p>
				)}
			</form>

			<section
				aria-labelledby="saved-generation-packages-heading"
				className="space-y-3"
			>
				<h3 className="font-semibold" id="saved-generation-packages-heading">
					Saved Generation Packages
				</h3>
				{renderSavedGenerationPackages()}
			</section>
		</section>
	);
}
