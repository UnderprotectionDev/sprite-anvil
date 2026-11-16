import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type {
	AssetFamilyComparisonInput,
	AssetFamilyComparisonRecord,
} from "@sprite-anvil/api/asset-family-comparisons";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AssetVersionPreview } from "@/components/asset-version-preview";
import {
	StatusMessage,
	WriteOutcomeMessage,
} from "@/components/status-message";
import { ENV } from "@/env";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";
import {
	assetFamilyComparisonFormSchema,
	maxComparedVersionCount,
} from "../../schemas";

const profileId = "object_weapon_equipment_states";
const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

const emptyObservations = {
	scale: "",
	perspective: "",
	materialLanguage: "",
	stateDirectionDistinction: "",
};

interface ComparisonFormValues {
	observations: typeof emptyObservations;
	selectedRecordIds: string[];
}

const observationLabels = {
	scale: "Scale observation",
	perspective: "Perspective observation",
	materialLanguage: "Material language observation",
	stateDirectionDistinction: "State and direction distinction observation",
} as const;

type FamilyRecord = AssetFamilyCatalog["assetRecords"][number] &
	Pick<AssetRecord, "assetCategory" | "availability">;

export function AssetFamilyComparisonManager({
	activation,
	assetFamilyId,
	assetRecords,
	catalog,
	familyName,
	projectId,
}: {
	activation: ProjectProfileContractActivation;
	assetFamilyId: string;
	assetRecords: FamilyRecord[];
	catalog: AssetVersionCatalog;
	familyName: string;
	projectId: string;
}) {
	const queryClient = useQueryClient();
	const saveComparison = useMutation(
		orpc.assetFamilyComparisons.save.mutationOptions()
	);
	const query = useQuery(
		orpc.assetFamilyComparisons.list.queryOptions({
			input: { projectId, assetFamilyId },
		})
	);
	const form = useForm({
		defaultValues: {
			selectedRecordIds: [] as string[],
			observations: emptyObservations,
		},
		validators: { onChange: assetFamilyComparisonFormSchema },
		onSubmit: ({ value }) => save(value),
	});
	const { selectedRecordIds, observations } = useStore(
		form.store,
		(state) => state.values
	);
	const [selected, setSelected] = useState<AssetFamilyComparisonRecord | null>(
		null
	);
	const [saving, setSaving] = useState(false);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [uncertain, setUncertain] = useState(false);
	const [message, setMessage] = useState("");
	// An uncertain write outcome must be resolved through the recorded
	// operation id; opening older records must never clear the lock.
	const controlsLocked = saving || uncertain;

	const currentVersionByRecord = new Map<
		string,
		AssetVersionCatalog["assetVersions"][number]
	>();
	for (const version of catalog.assetVersions) {
		if (version.assetFamilyId !== assetFamilyId) {
			continue;
		}
		const current = currentVersionByRecord.get(version.assetRecordId);
		if (!current || version.versionNumber > current.versionNumber) {
			currentVersionByRecord.set(version.assetRecordId, version);
		}
	}
	const eligibleRecords = assetRecords.filter(
		(record) =>
			record.assetCategory === profileId && record.availability !== "erased"
	);
	const selectedVersions = selectedRecordIds.flatMap((assetRecordId) => {
		const record = eligibleRecords.find(
			(candidate) => candidate.id === assetRecordId
		);
		const version = currentVersionByRecord.get(assetRecordId);
		return record && version ? [{ record, version }] : [];
	});
	const unitVersionsByAssetVersion = new Map<
		string,
		AssetVersionCatalog["unitVersions"]
	>();
	for (const unitVersion of catalog.unitVersions) {
		const versions =
			unitVersionsByAssetVersion.get(unitVersion.assetVersionId) ?? [];
		versions.push(unitVersion);
		unitVersionsByAssetVersion.set(unitVersion.assetVersionId, versions);
	}
	const canSave =
		selectedVersions.length >= 2 &&
		Object.values(observations).every((value) => value.trim().length > 0) &&
		!saving &&
		!uncertain &&
		!query.isPending &&
		!query.isError;

	async function save(values: ComparisonFormValues) {
		const selectedForSave = values.selectedRecordIds.flatMap(
			(assetRecordId) => {
				const record = eligibleRecords.find(
					(candidate) => candidate.id === assetRecordId
				);
				const version = currentVersionByRecord.get(assetRecordId);
				return record && version ? [{ record, version }] : [];
			}
		);
		const input: AssetFamilyComparisonInput = {
			id: crypto.randomUUID(),
			projectId,
			assetFamilyId,
			contractRevisionId: activation.contractRevisionId,
			assetVersions: selectedForSave.map(({ record, version }) => ({
				assetRecordId: record.id,
				assetVersionId: version.id,
				unitVersionIds: (unitVersionsByAssetVersion.get(version.id) ?? []).map(
					(unitVersion) => unitVersion.id
				),
			})),
			observations: values.observations,
		};
		setSaving(true);
		setMessage("");
		setPendingId(input.id);
		try {
			const record = await saveComparison.mutateAsync(input);
			setSelected(record);
			setPendingId(null);
			setMessage("Comparison verified from the saved record.");
			await queryClient.invalidateQueries({
				queryKey: orpc.assetFamilyComparisons.list.queryKey({
					input: { projectId, assetFamilyId },
				}),
			});
		} catch (error) {
			if (!isWriteOutcomeUncertain(error)) {
				setPendingId(null);
				setMessage(getErrorMessage(error, "Could not save comparison."));
				return;
			}
			setUncertain(true);
			setMessage(
				"Could not verify the save result. Check current records; do not resubmit the same comparison."
			);
		} finally {
			setSaving(false);
		}
	}

	async function checkCurrentRecords() {
		if (saving || query.isFetching) {
			return;
		}
		const result = await query.refetch();
		if (result.isError) {
			return;
		}
		const saved = result.data?.find((record) => record.id === pendingId);
		if (saved) {
			setSelected(saved);
			setPendingId(null);
			setUncertain(false);
			setMessage("Comparison verified from the saved record.");
			return;
		}
		setPendingId(null);
		setUncertain(false);
		setMessage(
			"Comparison was not found in the records. Select the information again and save."
		);
	}

	return (
		<section
			aria-label={`${familyName} state and direction family comparison`}
			className="space-y-4 rounded border p-4"
		>
			<header className="space-y-1">
				<h3 className="font-semibold text-xl">
					{familyName} · Compare State and Direction Family
				</h3>
				<p className="text-muted-foreground text-sm">
					Review current Asset Versions from at least two Asset Records side by
					side. This record stores user observations only; it does not make an
					automatic compatibility decision.
				</p>
			</header>
			{query.isError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">
						Could not load comparisons.
					</StatusMessage>
					<Button onClick={() => void query.refetch()} type="button">
						Reload records
					</Button>
				</div>
			) : null}
			<WriteOutcomeMessage message={message} uncertain={uncertain} />
			{uncertain ? (
				<Button
					disabled={query.isFetching}
					onClick={() => void checkCurrentRecords()}
					type="button"
				>
					Check current comparisons
				</Button>
			) : null}
			<ul className="space-y-1">
				{query.data?.map((record) => (
					<li key={record.id}>
						<Button
							disabled={controlsLocked}
							onClick={() => {
								if (controlsLocked) {
									return;
								}
								setSelected(record);
								setUncertain(false);
							}}
							type="button"
							variant="outline"
						>
							{new Date(record.createdAt).toLocaleString("tr-TR")} ·{" "}
							{record.versionPins.length} Asset Version
						</Button>
					</li>
				))}
			</ul>
			{selected ? (
				<>
					<div className="grid gap-4 sm:grid-cols-2">
						{selected.versionPins.map((pin) => {
							const version = catalog.assetVersions.find(
								(candidate) => candidate.id === pin.assetVersionId
							);
							return (
								<VersionCard
									key={pin.assetVersionId}
									name={pin.assetRecordName}
									unitVersions={pin.unitVersions}
									version={version}
									versionNumber={pin.versionNumber}
								/>
							);
						})}
					</div>
					<ObservationSummary observations={selected.observations} />
					<Button
						disabled={controlsLocked}
						onClick={() => {
							if (controlsLocked) {
								return;
							}
							setSelected(null);
							setUncertain(false);
							setMessage("");
							form.reset();
						}}
						type="button"
					>
						New comparison
					</Button>
				</>
			) : (
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						if (canSave) {
							void form.handleSubmit();
						}
					}}
				>
					<FieldSet className="space-y-3" disabled={saving || uncertain}>
						<FieldLegend className="font-medium">
							Current versions to compare
						</FieldLegend>
						<form.Field name="selectedRecordIds">
							{(field) =>
								eligibleRecords.map((record) => {
									const version = currentVersionByRecord.get(record.id);
									const checked = field.state.value.includes(record.id);
									return (
										<Label
											className="flex items-start gap-3 rounded border p-3 text-base leading-normal"
											key={record.id}
										>
											<Checkbox
												checked={checked}
												disabled={
													controlsLocked ||
													!version ||
													(!checked &&
														field.state.value.length >= maxComparedVersionCount)
												}
												onCheckedChange={() =>
													field.handleChange(
														checked
															? field.state.value.filter(
																	(id) => id !== record.id
																)
															: [...field.state.value, record.id]
													)
												}
											/>
											<span>
												<span className="block font-medium">{record.name}</span>
												<span className="text-muted-foreground text-sm">
													{version
														? `Current Asset Version ${version.versionNumber}`
														: "No comparable current versions"}
												</span>
											</span>
										</Label>
									);
								})
							}
						</form.Field>
					</FieldSet>
					{selectedVersions.length ? (
						<div className="grid gap-4 sm:grid-cols-2">
							{selectedVersions.map(({ record, version }) => (
								<VersionCard
									key={version.id}
									name={record.name}
									unitVersions={
										unitVersionsByAssetVersion.get(version.id) ?? []
									}
									version={version}
									versionNumber={version.versionNumber}
								/>
							))}
						</div>
					) : null}
					<div className="grid gap-4 sm:grid-cols-2">
						{(
							Object.keys(observationLabels) as Array<
								keyof typeof observationLabels
							>
						).map((key) => (
							<Label
								className="block space-y-1 text-base leading-normal"
								key={key}
							>
								<span className="font-medium text-sm">
									{observationLabels[key]}
								</span>
								<form.Field name={`observations.${key}`}>
									{(field) => (
										<Textarea
											aria-label={observationLabels[key]}
											className="min-h-24 w-full"
											disabled={saving || uncertain}
											maxLength={1000}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											value={field.state.value}
										/>
									)}
								</form.Field>
							</Label>
						))}
					</div>
					<p className="text-muted-foreground text-sm">
						Continue tracking required states in the Required Set.
					</p>
					<Button disabled={!canSave} type="submit">
						{saving ? "Kaydediliyor…" : "Save comparison"}
					</Button>
				</form>
			)}
		</section>
	);
}

function VersionCard({
	name,
	unitVersions,
	version,
	versionNumber,
}: {
	name: string;
	unitVersions: Array<{
		id?: string;
		unitKey: string;
		unitType: string;
		versionNumber: number;
	}>;
	version?: AssetVersionCatalog["assetVersions"][number];
	versionNumber: number;
}) {
	return (
		<article className="space-y-2 rounded border p-3">
			<h4 className="font-medium">
				{name} · Asset Version {versionNumber}
			</h4>
			{version ? (
				<AssetVersionPreview
					recordName={name}
					url={`${serverUrl}${version.previewUrl}`}
					versionNumber={versionNumber}
				/>
			) : (
				<p className="text-muted-foreground text-sm">
					This version can no longer be displayed.
				</p>
			)}
			{unitVersions.length ? (
				<ul className="text-muted-foreground text-sm">
					{unitVersions.map((unitVersion) => (
						<li
							key={
								unitVersion.id ??
								`${unitVersion.unitType}:${unitVersion.unitKey}`
							}
						>
							{unitVersion.unitType} · {unitVersion.unitKey} · Unit Version{" "}
							{unitVersion.versionNumber}
						</li>
					))}
				</ul>
			) : null}
		</article>
	);
}

function ObservationSummary({
	observations,
}: {
	observations: AssetFamilyComparisonRecord["observations"];
}) {
	return (
		<dl className="grid gap-3 sm:grid-cols-2">
			{(
				Object.keys(observationLabels) as Array<keyof typeof observationLabels>
			).map((key) => (
				<div key={key}>
					<dt className="font-medium text-sm">{observationLabels[key]}</dt>
					<dd className="text-muted-foreground text-sm">{observations[key]}</dd>
				</div>
			))}
		</dl>
	);
}
