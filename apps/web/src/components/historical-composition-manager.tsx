import type {
	AssetVersionReviewEvent,
	CompositeVersionReviewEvent,
} from "@sprite-anvil/api/asset-versions";
import type { HistoricalCompositionInput } from "@sprite-anvil/api/historical-compositions";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { historicalCompositionFormSchema } from "@/features/dependency-revalidation/schemas";
import { builtinProfileRevisionName } from "@/utils/builtin-profile-labels";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";

interface Props {
	canonicalDesigns: { assetVersionId: string }[];
	composites: {
		id: string;
		assetRecordId: string;
		versionNumber: number;
		reviewEvents: CompositeVersionReviewEvent[];
	}[];
	projectId: string;
	records: { id: string; name: string }[];
	versions: {
		id: string;
		assetRecordId: string;
		versionNumber: number;
		reviewEvents?: AssetVersionReviewEvent[];
	}[];
}
type Selection = Omit<
	HistoricalCompositionInput,
	"projectId" | "idempotencyKey"
>;
const emptySelection: Selection = {
	compositeVersionId: "",
	contextRevisionId: "",
	canonicalDesignVersionId: "",
	dependencyLinkIds: [],
	dependencyVersionIds: [],
	readinessEvidenceIds: [],
	profileContractRevisionIds: [],
	reviewEventIds: [],
};

function HistoricalChoices({
	title,
	options,
	field,
	disabled,
}: {
	title: string;
	options: { id: string; label: string }[];
	field: { handleChange: (ids: string[]) => void; state: { value: string[] } };
	disabled: boolean;
}) {
	const selected = field.state.value;
	return (
		<FieldSet className="space-y-2 rounded border p-3" disabled={disabled}>
			<FieldLegend>{title}</FieldLegend>
			{options.length === 0 ? (
				<p>
					No selectable records; missing evidence appears as a blocker in the
					report.
				</p>
			) : (
				options.map((option) => (
					<Label className="flex items-start gap-2" key={option.id}>
						<Checkbox
							checked={selected.includes(option.id)}
							disabled={disabled}
							onCheckedChange={(checked) =>
								field.handleChange(
									checked
										? [...selected, option.id]
										: selected.filter((id) => id !== option.id)
								)
							}
						/>
						<span>{option.label}</span>
					</Label>
				))
			)}
		</FieldSet>
	);
}

export function HistoricalCompositionManager({
	projectId,
	records,
	versions,
	composites,
	canonicalDesigns,
}: Props) {
	const identifier = useId();
	const catalog = useQuery(
		orpc.dependencyRevalidation.list.queryOptions({ input: { projectId } })
	);
	const history = useQuery(
		orpc.dependencyRevalidation.listHistoricalCompositions.queryOptions({
			input: { projectId },
		})
	);
	const options = useQuery(
		orpc.dependencyRevalidation.historicalCompositionOptions.queryOptions({
			input: { projectId },
		})
	);
	const queryClient = useQueryClient();
	const pinMutation = useMutation(
		orpc.dependencyRevalidation.pinHistoricalComposition.mutationOptions()
	);
	const form = useForm({
		defaultValues: emptySelection,
		onSubmit: ({ value }) => save(value),
		validators: { onSubmit: historicalCompositionFormSchema },
	});
	const selection = useStore(form.store, (state) => state.values);
	const [pending, setPending] = useState<HistoricalCompositionInput | null>(
		null
	);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const failedRead = catalog.isError || history.isError || options.isError;
	const loading = !(
		catalog.isSuccess &&
		history.isSuccess &&
		options.isSuccess
	);
	const disabled = busy || pending !== null || loading;
	const names = new Map(records.map((record) => [record.id, record.name]));
	const labels = new Map(
		versions.map((version) => [
			version.id,
			`${names.get(version.assetRecordId) ?? version.assetRecordId} · v${version.versionNumber}`,
		])
	);
	const compositeLabels = new Map(
		composites.map((composite) => [
			composite.id,
			`${names.get(composite.assetRecordId) ?? composite.assetRecordId} · Composite Version v${composite.versionNumber}`,
		])
	);
	const contexts = new Map(
		catalog.data?.contextRevisions.map((context) => [
			context.id,
			`Context Revision ${context.revisionNumber}`,
		])
	);
	const selects = [
		{
			field: "compositeVersionId" as const,
			label: "Historical Composite Version",
			choices: composites.map((composite) => ({
				id: composite.id,
				label: compositeLabels.get(composite.id) ?? composite.id,
			})),
		},
		{
			field: "contextRevisionId" as const,
			label: "Historical Context Revision",
			choices: [...contexts].map(([id, label]) => ({ id, label })),
		},
		{
			field: "canonicalDesignVersionId" as const,
			label: "Historical Canonical Design",
			choices: [
				...new Set(canonicalDesigns.map((design) => design.assetVersionId)),
			].map((id) => ({ id, label: labels.get(id) ?? id })),
		},
	];
	const lists = [
		{
			field: "dependencyVersionIds" as const,
			title: "Historical dependency Asset Versions",
			choices: versions.map((version) => ({
				id: version.id,
				label: labels.get(version.id) ?? version.id,
			})),
		},
		{
			field: "dependencyLinkIds" as const,
			title: "Historical Dependency Links",
			choices:
				catalog.data?.dependencyLinks.map((link) => ({
					id: link.id,
					label: `${labels.get(link.source.id) ?? contexts.get(link.source.id) ?? link.source.id} → ${labels.get(link.targetAssetVersionId) ?? link.targetAssetVersionId} · ${link.facets.join(", ") || "incomplete declaration"}`,
				})) ?? [],
		},
		{
			field: "profileContractRevisionIds" as const,
			title: "Historical Specialized Profile Contracts",
			choices:
				options.data?.contracts.map((contract) => ({
					id: contract.id,
					label: `${builtinProfileRevisionName(contract.id, contract.name)} · ${contract.id}`,
				})) ?? [],
		},
		{
			field: "readinessEvidenceIds" as const,
			title: "Historical quality and applicability evidence",
			choices:
				options.data?.evidence.map((evidence) => ({
					id: evidence.id,
					label: `${evidence.requirementId ?? evidence.kind} · ${evidence.result} · ${evidence.assetVersionIds.map((id) => labels.get(id) ?? id).join(", ")} · ${contexts.get(evidence.contextRevisionId ?? "") ?? "No context"} · Canonical Design: ${labels.get(evidence.canonicalDesignVersionId ?? "") ?? "none"} · ${evidence.versionTargetId ?? "all versions"} · ${evidence.createdAt}`,
				})) ?? [],
		},
		{
			field: "reviewEventIds" as const,
			title: "Historical Review Records",
			choices: [
				...versions.flatMap(
					(version) =>
						version.reviewEvents?.map((review) => ({
							id: review.id,
							label: `${labels.get(version.id)} · ${review.type} · ${review.createdAt}`,
						})) ?? []
				),
				...composites.flatMap((composite) =>
					composite.reviewEvents.map((review) => ({
						id: review.id,
						label: `${compositeLabels.get(composite.id)} · ${review.type} · ${review.createdAt}`,
					}))
				),
			],
		},
	];
	async function save(values: Selection) {
		if (busy || loading) {
			return;
		}
		const input = pending ?? {
			...values,
			projectId,
			idempotencyKey: crypto.randomUUID(),
		};
		setPending(input);
		setBusy(true);
		setMessage("");
		try {
			await pinMutation.mutateAsync(input);
			setPending(null);
			let rereadFailed = false;
			try {
				await queryClient.invalidateQueries(
					{
						queryKey:
							orpc.dependencyRevalidation.listHistoricalCompositions.queryKey({
								input: { projectId },
							}),
					},
					{ throwOnError: true }
				);
			} catch {
				rereadFailed = true;
			}
			setMessage(
				rereadFailed
					? "Historical selection saved, but the report could not be reread. Use Refresh historical selections to retry."
					: "Historical selection saved; current Revalidation Required status did not change."
			);
		} catch (error) {
			if (
				!isWriteOutcomeUncertain(error) &&
				typeof error === "object" &&
				error !== null &&
				[
					"BAD_REQUEST",
					"NOT_FOUND",
					"UNAUTHORIZED",
					"FORBIDDEN",
					"CONFLICT",
				].includes(String(Reflect.get(error, "code")))
			) {
				setPending(null);
				setMessage(
					getErrorMessage(
						error,
						"Historical selection rejected. Correct your selection and try again."
					)
				);
				return;
			}
			setMessage(
				"Could not verify the save result. You can retry without changing the selection."
			);
		} finally {
			setBusy(false);
		}
	}
	return (
		<section
			aria-labelledby={`${identifier}-heading`}
			className="space-y-4 rounded border p-4"
		>
			<h3 className="font-semibold" id={`${identifier}-heading`}>
				Pin Historical Composition
			</h3>
			<p>
				Exact Composite Version units are preserved. Explicitly select
				historical context, Canonical Design, dependencies, Review Records, and
				quality evidence. This operation does not create a package or change
				current applicability.
			</p>
			{failedRead ? (
				<StatusMessage tone="error">
					Could not load historical selection records.
				</StatusMessage>
			) : null}
			{loading && !failedRead ? (
				<p role="status">Loading historical selection records.</p>
			) : null}
			<form
				className="space-y-3"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void form.handleSubmit();
				}}
			>
				{selects.map((select) => (
					<form.Field key={select.field} name={select.field}>
						{(field) => (
							<div className="space-y-1">
								<Label htmlFor={`${identifier}-${select.field}`}>
									{select.label}
								</Label>
								<NativeSelect
									className="block w-full"
									disabled={disabled}
									id={`${identifier}-${select.field}`}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Select exact version
									</NativeSelectOption>
									{select.choices.map((choice) => (
										<NativeSelectOption key={choice.id} value={choice.id}>
											{choice.label}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</div>
						)}
					</form.Field>
				))}
				{lists.map((list) => (
					<form.Field key={list.field} name={list.field}>
						{(field) => (
							<HistoricalChoices
								disabled={disabled}
								field={field}
								options={list.choices}
								title={list.title}
							/>
						)}
					</form.Field>
				))}
				<Button
					disabled={
						busy ||
						loading ||
						!historicalCompositionFormSchema.safeParse(selection).success
					}
					type="submit"
				>
					{pending ? "Retry historical pin" : "Pin historical composition"}
				</Button>
			</form>
			{message ? <p role="status">{message}</p> : null}
			<Button
				disabled={busy}
				onClick={() =>
					Promise.all([history.refetch(), options.refetch(), catalog.refetch()])
				}
				type="button"
				variant="outline"
			>
				Refresh historical selections
			</Button>
			{history.data?.pins.map((pin) => (
				<article className="space-y-2 rounded border p-3" key={pin.id}>
					<h4>Compatibility report · Historical selection</h4>
					<p>
						{compositeLabels.get(pin.selection.compositeVersionId) ??
							pin.selection.compositeVersionId}{" "}
						·{" "}
						{contexts.get(pin.selection.contextRevisionId) ??
							pin.selection.contextRevisionId}{" "}
						· Canonical Design:{" "}
						{labels.get(pin.selection.canonicalDesignVersionId) ??
							pin.selection.canonicalDesignVersionId}
					</p>
					<p>
						{pin.report.exportEligible
							? "Conditions are met for the pinned historical composition; no package has been produced yet."
							: "This composition cannot be packaged until blockers are resolved."}
					</p>
					<p>Unit Versions: {pin.unitVersionIds.join(", ")}</p>
					{lists.map((list) => (
						<p key={list.field}>
							{list.title}:{" "}
							{pin.selection[list.field]
								.map(
									(id) =>
										list.choices.find((choice) => choice.id === id)?.label ?? id
								)
								.join("; ") || "Not selected"}
						</p>
					))}
					<ul>
						{pin.report.blockers.map((blocker) => (
							<li
								key={`${blocker.code}-${blocker.targetId}-${blocker.message}`}
							>
								{blocker.message}
							</li>
						))}
					</ul>
				</article>
			))}
		</section>
	);
}
