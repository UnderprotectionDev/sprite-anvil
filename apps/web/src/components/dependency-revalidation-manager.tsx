import type {
	AssetVersionReviewInput,
	AssetVersionSourceKind,
} from "@sprite-anvil/api/asset-versions";
import type {
	ChangeFacetInput,
	DependencyLinkInput,
} from "@sprite-anvil/api/dependency-revalidation";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import type z from "zod";
import { StatusMessage } from "@/components/status-message";
import {
	changeFacetFormSchema,
	dependencyLinkFormSchema,
} from "@/features/dependency-revalidation/schemas";
import {
	DependencyFacets,
	dependencyFacetLabel,
	selectedDependencyFacets,
} from "@/features/dependency-revalidation/ui/components/dependency-facets";
import { DerivativeReReviewForm } from "@/features/dependency-revalidation/ui/components/derivative-re-review-form";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

interface Props {
	canonicalVersionIds: string[];
	onImpactSaved?: () => Promise<void>;
	projectId: string;
	records: { id: string; name: string }[];
	versions: {
		id: string;
		assetRecordId: string;
		assetFamilyId?: string;
		reviewDisposition?: AssetVersionReviewInput["decision"];
		previewUrl?: string;
		versionNumber: number;
		sourceKind?: AssetVersionSourceKind;
	}[];
}

export function DependencyRevalidationManager({
	projectId,
	versions,
	records,
	canonicalVersionIds,
	onImpactSaved,
}: Props) {
	const query = useQuery({
		...orpc.dependencyRevalidation.list.queryOptions({ input: { projectId } }),
	});
	const queryClient = useQueryClient();
	const createLinkMutation = useMutation(
		orpc.dependencyRevalidation.createLink.mutationOptions()
	);
	const determineMutation = useMutation(
		orpc.dependencyRevalidation.determine.mutationOptions()
	);
	const reReviewMutation = useMutation(
		orpc.dependencyRevalidation.reReview.mutationOptions()
	);
	const identifier = useId();
	const linkDefaults: z.input<typeof dependencyLinkFormSchema> = {
		kind: "asset_version",
		sourceId: "",
		targetId: "",
		facets: [],
		other: "",
	};
	const linkForm = useForm({
		defaultValues: linkDefaults,
		onSubmit: ({ value }) => {
			void save(
				() =>
					createLinkMutation.mutateAsync({
						projectId,
						source: { kind: value.kind, id: value.sourceId },
						targetAssetVersionId: value.targetId,
						facets: selectedDependencyFacets(value.facets, value.other),
					}),
				"Dependency Link saved."
			);
		},
		validators: { onSubmit: dependencyLinkFormSchema },
	});
	const changeDefaults: z.input<typeof changeFacetFormSchema> = {
		kind: "canonical_design",
		sourceId: "",
		facets: [],
		other: "",
	};
	const changeForm = useForm({
		defaultValues: changeDefaults,
		onSubmit: ({ value }) => {
			void save(
				() =>
					determineMutation.mutateAsync({
						projectId,
						source: { kind: value.kind, id: value.sourceId },
						facets: selectedDependencyFacets(value.facets, value.other),
					}),
				"Change Impact saved."
			);
		},
		validators: { onSubmit: changeFacetFormSchema },
	});
	const link = useSelector(linkForm.store, (state) => state.values);
	const change = useSelector(changeForm.store, (state) => state.values);
	const linkKind: DependencyLinkInput["source"]["kind"] = link.kind;
	const changeKind: ChangeFacetInput["source"]["kind"] = change.kind;
	const workflow = useMutation({
		...mutationMeta,
		mutationFn: (execute: () => Promise<void>) => execute(),
	});
	const busy = workflow.isPending;
	const [uncertain, setUncertain] = useState(false);
	const [message, setMessage] = useState("");
	const disabled = busy || uncertain || !query.isSuccess || query.isError;
	const names = new Map(records.map((record) => [record.id, record.name]));
	const versionLabels = new Map(
		versions.map((version) => [
			version.id,
			`${names.get(version.assetRecordId) ?? version.assetRecordId} · v${version.versionNumber}`,
		])
	);
	const contexts = query.data?.contextRevisions ?? [];
	const contextOptions = contexts.map((revision) => ({
		id: revision.id,
		label: `Context Revision ${revision.revisionNumber}${revision.isActive ? " (active)" : ""}`,
	}));
	function dependencySourceLabel(source: DependencyLinkInput["source"]) {
		if (source.kind === "context_revision") {
			return (
				contextOptions.find((option) => option.id === source.id)?.label ??
				source.id
			);
		}
		return versionLabels.get(source.id) ?? source.id;
	}
	const linkOptions =
		linkKind === "context_revision"
			? contextOptions
			: versions.map((version) => ({
					id: version.id,
					label: versionLabels.get(version.id) ?? version.id,
				}));
	const changeOptions =
		changeKind === "context_revision"
			? contextOptions
			: versions
					.filter((version) => canonicalVersionIds.includes(version.id))
					.map((version) => ({
						id: version.id,
						label: versionLabels.get(version.id) ?? version.id,
					}));

	async function save(
		operation: () => Promise<unknown>,
		successMessage: string
	) {
		if (disabled) {
			return;
		}
		setMessage("");
		try {
			await workflow.mutateAsync(async () => {
				await operation();
				let rereadFailed = false;
				try {
					await queryClient.invalidateQueries(
						{
							queryKey: orpc.dependencyRevalidation.list.queryKey({
								input: { projectId },
							}),
						},
						{ throwOnError: true }
					);
				} catch {
					rereadFailed = true;
				}
				await onImpactSaved?.();
				if (rereadFailed) {
					setUncertain(true);
					setMessage(
						"Record saved, but the result could not be reread. Check the status."
					);
				} else {
					setMessage(successMessage);
				}
			});
		} catch {
			setUncertain(true);
			setMessage(
				"The operation could not be completed or verified. Check the status before saving again."
			);
		}
	}

	async function checkStatus() {
		try {
			await workflow.mutateAsync(async () => {
				const result = await query.refetch();
				await onImpactSaved?.();
				if (!result.isError) {
					setUncertain(false);
					setMessage("Saved records reread. Check the result before saving.");
				}
			});
		} catch {
			setMessage("Could not reread records. Check the status again.");
		}
	}

	return (
		<section
			aria-labelledby={`${identifier}-heading`}
			className="space-y-5 rounded-lg border p-5"
		>
			<h2 className="text-2xl font-semibold" id={`${identifier}-heading`}>
				Determine Change Impact
			</h2>
			<p className="text-muted-foreground text-sm">
				Link dependencies to exact versions. Confirming changed features
				requires revalidation of affected direct and indirect Derived Assets.
				Historical approval and quality evidence remain unchanged.
			</p>
			{query.isPending ? (
				<p role="status">Loading dependency records…</p>
			) : null}
			{query.isError ? (
				<StatusMessage tone="error">
					Could not load dependency records.
				</StatusMessage>
			) : null}
			{message ? (
				<p aria-live="polite" role="status">
					{message}
				</p>
			) : null}
			{uncertain || query.isError ? (
				<Button
					disabled={busy}
					onClick={() => void checkStatus()}
					type="button"
					variant="outline"
				>
					Durumu kontrol et
				</Button>
			) : null}
			<form
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void linkForm.handleSubmit();
				}}
			>
				<FieldSet className="space-y-4" disabled={disabled}>
					<FieldLegend className="font-semibold">Dependency Link</FieldLegend>
					<linkForm.Field name="kind">
						{(field) => (
							<>
								<Label className="block" htmlFor={`${identifier}-link-kind`}>
									Dependency source type
								</Label>
								<NativeSelect
									className="w-full"
									id={`${identifier}-link-kind`}
									onChange={(event) => {
										field.handleChange(
											event.target.value === "context_revision"
												? "context_revision"
												: "asset_version"
										);
										linkForm.setFieldValue("sourceId", "");
									}}
									value={field.state.value}
								>
									<NativeSelectOption value="asset_version">
										Asset Version
									</NativeSelectOption>
									<NativeSelectOption value="context_revision">
										Context Revision
									</NativeSelectOption>
								</NativeSelect>
							</>
						)}
					</linkForm.Field>
					<linkForm.Field name="sourceId">
						{(field) => (
							<>
								<Label className="block" htmlFor={`${identifier}-link-source`}>
									Dependency source
								</Label>
								<NativeSelect
									className="w-full"
									id={`${identifier}-link-source`}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Select source
									</NativeSelectOption>
									{linkOptions.map((option) => (
										<NativeSelectOption key={option.id} value={option.id}>
											{option.label}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</>
						)}
					</linkForm.Field>
					<linkForm.Field name="targetId">
						{(field) => (
							<>
								<Label className="block" htmlFor={`${identifier}-target`}>
									Derived Asset Version
								</Label>
								<NativeSelect
									className="w-full"
									id={`${identifier}-target`}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Select version
									</NativeSelectOption>
									{versions
										.filter(
											(version) =>
												version.sourceKind === "derived" &&
												(linkKind !== "asset_version" ||
													version.id !== link.sourceId)
										)
										.map((version) => (
											<NativeSelectOption key={version.id} value={version.id}>
												{versionLabels.get(version.id)}
											</NativeSelectOption>
										))}
								</NativeSelect>
							</>
						)}
					</linkForm.Field>
					<linkForm.Field name="facets">
						{(facetsField) => (
							<linkForm.Field name="other">
								{(otherField) => (
									<DependencyFacets
										disabled={disabled}
										facetsField={facetsField}
										legend="Dependent features"
										otherField={otherField}
									/>
								)}
							</linkForm.Field>
						)}
					</linkForm.Field>
					<p className="text-muted-foreground text-sm">
						Without selected features the link is treated as incomplete and
						conservatively flagged on changes.
					</p>
					<Button
						disabled={
							disabled || !dependencyLinkFormSchema.safeParse(link).success
						}
						type="submit"
					>
						Save Dependency Link
					</Button>
				</FieldSet>
			</form>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void changeForm.handleSubmit();
				}}
			>
				<FieldSet className="space-y-4" disabled={disabled}>
					<FieldLegend className="font-semibold">
						Change Declaration
					</FieldLegend>
					<changeForm.Field name="kind">
						{(field) => (
							<>
								<Label className="block" htmlFor={`${identifier}-change-kind`}>
									Changed source type
								</Label>
								<NativeSelect
									className="w-full"
									id={`${identifier}-change-kind`}
									onChange={(event) => {
										field.handleChange(
											event.target.value === "context_revision"
												? "context_revision"
												: "canonical_design"
										);
										changeForm.setFieldValue("sourceId", "");
									}}
									value={field.state.value}
								>
									<NativeSelectOption value="canonical_design">
										Canonical Design
									</NativeSelectOption>
									<NativeSelectOption value="context_revision">
										Context Revision
									</NativeSelectOption>
								</NativeSelect>
							</>
						)}
					</changeForm.Field>
					<changeForm.Field name="sourceId">
						{(field) => (
							<>
								<Label
									className="block"
									htmlFor={`${identifier}-change-source`}
								>
									Changed source
								</Label>
								<NativeSelect
									className="w-full"
									id={`${identifier}-change-source`}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Select source
									</NativeSelectOption>
									{changeOptions.map((option) => (
										<NativeSelectOption key={option.id} value={option.id}>
											{option.label}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</>
						)}
					</changeForm.Field>
					<changeForm.Field name="facets">
						{(facetsField) => (
							<changeForm.Field name="other">
								{(otherField) => (
									<DependencyFacets
										disabled={disabled}
										facetsField={facetsField}
										legend="Changed features"
										otherField={otherField}
									/>
								)}
							</changeForm.Field>
						)}
					</changeForm.Field>
					<Button
						disabled={
							disabled || !changeFacetFormSchema.safeParse(change).success
						}
						type="submit"
					>
						Determine Change Impact
					</Button>
				</FieldSet>
			</form>
			{query.data ? (
				<div className="space-y-4">
					<h3 className="font-semibold">Saved Dependency Links</h3>
					<ul className="space-y-2">
						{query.data.dependencyLinks.map((savedLink) => (
							<li key={savedLink.id}>
								{dependencySourceLabel(savedLink.source)} →{" "}
								{versionLabels.get(savedLink.targetAssetVersionId) ??
									savedLink.targetAssetVersionId}
								:{" "}
								{savedLink.facets.length > 0
									? savedLink.facets.map(dependencyFacetLabel).join(", ")
									: "Incomplete Dependency Link"}
							</li>
						))}
					</ul>
					<h3 className="font-semibold">Current Revalidation Required</h3>
					{query.data.revalidationRequiredVersionIds.length === 0 ? (
						<p>No versions are affected by saved changes.</p>
					) : (
						<ul className="space-y-2">
							{query.data.revalidationRequiredVersionIds.map((versionId) => (
								<li key={versionId}>
									{versionLabels.get(versionId) ?? versionId}: Revalidation
									Required
								</li>
							))}
						</ul>
					)}
					<h3 className="font-semibold">Saved Change Impacts</h3>
					{query.data.revalidationRequiredVersionIds.map((versionId) => {
						const version = versions.find((entry) => entry.id === versionId);
						if (!version) {
							return null;
						}
						const activeContext = contexts.find((entry) => entry.isActive);
						const canonicalId = query.data.canonicalDesigns.find(
							(entry) => entry.assetFamilyId === version.assetFamilyId
						)?.assetVersionId;
						const canonical = versions.find(
							(entry) => entry.id === canonicalId
						);
						return (
							<DerivativeReReviewForm
								assetVersionId={versionId}
								canonicalDesignVersionId={canonicalId}
								canonicalLabel={
									versionLabels.get(canonicalId ?? "") ?? "Canonical Design"
								}
								canonicalPreviewUrl={canonical?.previewUrl}
								canonicalVersionNumber={canonical?.versionNumber}
								changeImpactIds={query.data.changeImpacts
									.filter((impact) =>
										impact.affectedVersions.some(
											(entry) => entry.assetVersionId === versionId
										)
									)
									.map((impact) => impact.id)}
								contextRevisionId={activeContext?.id}
								contextRevisionNumber={activeContext?.revisionNumber}
								disabled={disabled}
								key={versionId}
								label={versionLabels.get(versionId) ?? versionId}
								onReview={(input) =>
									void save(
										() => reReviewMutation.mutateAsync(input),
										input.decision === "approved"
											? "New Review Record saved for current applicability."
											: "Candidate review record saved for content correction. Prepare a new Unit or Composite Version; Revalidation Required remains."
									)
								}
								previewUrl={version.previewUrl}
								projectId={projectId}
								versionNumber={version.versionNumber}
							/>
						);
					})}
					<h3 className="font-semibold">Re-review Records</h3>
					<ul className="space-y-2">
						{query.data.reviews.map((review) => (
							<li key={review.id}>
								{versionLabels.get(review.assetVersionId) ??
									review.assetVersionId}{" "}
								—{" "}
								{review.decision === "approved"
									? "Current applicability confirmed"
									: "Content correction required"}{" "}
								— Context Revision{" "}
								{contexts.find((entry) => entry.id === review.contextRevisionId)
									?.revisionNumber ?? review.contextRevisionId}{" "}
								— Canonical Design:{" "}
								{versionLabels.get(review.canonicalDesignVersionId) ??
									review.canonicalDesignVersionId}{" "}
								— {review.rationale}
							</li>
						))}
					</ul>
					<ul className="space-y-3">
						{query.data.changeImpacts.map((impact) => (
							<li key={impact.id}>
								{impact.facets.map(dependencyFacetLabel).join(", ")} —{" "}
								{impact.affectedVersions.length} affected versions
								<ul>
									{impact.affectedVersions.map((version) => (
										<li key={version.assetVersionId}>
											{versionLabels.get(version.assetVersionId) ??
												version.assetVersionId}
											:{" "}
											{version.reason === "incomplete_dependency"
												? "Incomplete Dependency Link"
												: "Matching Dependency Link"}
										</li>
									))}
								</ul>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</section>
	);
}
