import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type {
	AssetVersion,
	UnitVersion,
} from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	createUiStateComparisonArchive,
	type UiStateComparisonInput,
	type UiStateComparisonRecord,
	uiComponentKinds,
	uiComponentStates,
	uiStateComparisonInputSchema,
} from "@sprite-anvil/api/ui-state-comparisons";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";
import {
	createUiStateComparisonSubmitSchema,
	type UiStateComparisonDraftItem,
} from "../../schemas";
import {
	kindLabels,
	outcomeLabels,
	stateLabels,
	UiStateComparisonPreview,
} from "./ui-state-comparison-preview";

export interface UiStateComparisonManagerProps {
	activation?: ProjectProfileContractActivation | null;
	assetFamilyId: string;
	assetRecords: Pick<
		AssetRecord,
		"id" | "name" | "assetCategory" | "availability"
	>[];
	familyName: string;
	projectId: string;
	units: UnitVersion[];
	versions: Pick<
		AssetVersion,
		| "id"
		| "assetFamilyId"
		| "assetRecordId"
		| "integrityVerified"
		| "contentDigest"
		| "contentLength"
		| "contentType"
		| "versionNumber"
		| "previewUrl"
		| "sourceImageDimensions"
	>[];
}
type Item = UiStateComparisonDraftItem;
const inputClass = "min-h-11 w-full";
const selectClass = "w-full [&_select]:min-h-11";
const labelClass = "block space-y-1 text-base leading-normal";
function newItem(state: Item["state"]): Item {
	return {
		key: crypto.randomUUID(),
		componentId: "",
		componentKind: "button",
		state,
		assetVersionId: "",
		unitVersionId: null,
		region: { x: 0, y: 0, width: 1, height: 1 },
	};
}
function download(record: UiStateComparisonRecord) {
	const archive = createUiStateComparisonArchive(record);
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" })
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = `ui-state-comparison-${record.id}.json`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function UiStateComparisonManager(props: UiStateComparisonManagerProps) {
	const {
		activation,
		assetFamilyId,
		assetRecords,
		familyName,
		projectId,
		versions,
		units,
	} = props;
	const prefix = useId();
	const [defaultValues] = useState(() => ({
		screenAssetVersionId: "",
		name: "",
		familyStyleNotes: "",
		stateDistinctionNotes: "",
		outcome: "inconclusive" as UiStateComparisonInput["outcome"],
		items: [newItem("normal"), newItem("hover")],
	}));
	const form = useForm({
		defaultValues,
		onSubmit: ({ value }) => {
			const parsed = createUiStateComparisonSubmitSchema({
				projectId,
				assetFamilyId,
				contractRevisionId: activation?.contractRevisionId,
			}).safeParse(value);
			if (!parsed.success) {
				setMessage(
					parsed.error.issues[0]?.message ?? "Check comparison fields."
				);
				return;
			}
			void save(parsed.data);
		},
	});
	const [saving, setSaving] = useState(false);
	const [pending, setPending] = useState<UiStateComparisonInput | null>(null);
	const [retryAllowed, setRetryAllowed] = useState(false);
	const [message, setMessage] = useState("");
	const recordsById = new Map(
		assetRecords
			.filter(
				(record) =>
					record.assetCategory === "ui" && record.availability !== "erased"
			)
			.map((record) => [record.id, record])
	);
	const choices = versions.filter(
		(version) =>
			version.assetFamilyId === assetFamilyId &&
			recordsById.has(version.assetRecordId) &&
			version.integrityVerified &&
			version.contentDigest &&
			version.sourceImageDimensions
	);
	const queryClient = useQueryClient();
	const saveComparison = useMutation(
		orpc.uiStateComparisons.save.mutationOptions()
	);
	const listKey = orpc.uiStateComparisons.list.queryKey({
		input: { projectId, assetFamilyId },
	});
	const query = useQuery({
		...orpc.uiStateComparisons.list.queryOptions({
			input: { projectId, assetFamilyId },
		}),
		enabled: activation?.contract.profileId === "ui",
	});
	if (activation?.contract.profileId !== "ui" || recordsById.size === 0) {
		return null;
	}
	async function checkSaved() {
		setRetryAllowed(false);
		const result = await query.refetch();
		if (result.isError) {
			setMessage(
				"Comparisons could not be read. Check saved comparisons again before retrying."
			);
			return;
		}
		const persisted = result.data?.find((record) => record.id === pending?.id);
		if (persisted && pending) {
			if (
				JSON.stringify(
					uiStateComparisonInputSchema.strip().parse(persisted)
				) !== JSON.stringify(uiStateComparisonInputSchema.parse(pending))
			) {
				setMessage(
					"The operation id has different saved content. Reload before continuing."
				);
				return;
			}
			setPending(null);
			setMessage("Comparison verified from persistent storage.");
			return;
		}
		setRetryAllowed(Boolean(pending));
		setMessage(
			"Comparison is absent from the saved list. Retry the same comparison or check again."
		);
	}
	async function save(input: UiStateComparisonInput) {
		setSaving(true);
		setMessage("");
		setRetryAllowed(false);
		try {
			const saved = await saveComparison.mutateAsync(input);
			setPending(input);
			await queryClient.invalidateQueries({ queryKey: listKey });
			const refreshed =
				queryClient.getQueryData<UiStateComparisonRecord[]>(listKey);
			const refreshFailed =
				queryClient.getQueryState(listKey)?.status === "error";
			const persisted = refreshed?.find((record) => record.id === saved.id);
			if (
				!refreshFailed &&
				persisted &&
				JSON.stringify(
					uiStateComparisonInputSchema.strip().parse(persisted)
				) === JSON.stringify(input)
			) {
				setPending(null);
				setMessage("Comparison verified from persistent storage.");
			} else {
				setMessage(
					"Save result is uncertain. Check saved comparisons before retrying."
				);
			}
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setPending(input);
				setMessage(
					"Save result is uncertain. Check saved comparisons before retrying."
				);
			} else {
				setPending(null);
				setMessage(getErrorMessage(error, "Comparison could not be saved."));
			}
		} finally {
			setSaving(false);
		}
	}
	function versionOptions() {
		return (
			<>
				<NativeSelectOption value="">Choose a version</NativeSelectOption>
				{choices.map((version) => (
					<NativeSelectOption key={version.id} value={version.id}>
						{recordsById.get(version.assetRecordId)?.name} · Version{" "}
						{version.versionNumber}
					</NativeSelectOption>
				))}
			</>
		);
	}
	return (
		<section
			aria-labelledby={`${prefix}-heading`}
			className="space-y-4 rounded-lg border p-4"
		>
			<h3 className="font-semibold text-xl" id={`${prefix}-heading`}>
				{familyName} · Ekran ve Bileşen Durumlarını Karşılaştırma
			</h3>
			<p className="text-muted-foreground text-sm">
				Compare a screen and its component states in this Asset Family. Record
				your observations; visual consistency is a human decision. This
				comparison does not generate gameplay code or perform stretch and
				text-area tests.
			</p>
			{message ? (
				<p aria-live="polite" role="status">
					{message}
				</p>
			) : null}
			{query.isPending ? <p role="status">Loading comparisons…</p> : null}
			{query.isError ? (
				<p role="alert">Comparisons could not be read.</p>
			) : null}
			<Button
				disabled={saving || query.isFetching}
				onClick={() => void checkSaved()}
				type="button"
				variant="outline"
			>
				Check saved comparisons
			</Button>
			{pending && retryAllowed ? (
				<Button
					disabled={saving || query.isFetching}
					onClick={() => void save(pending)}
					type="button"
				>
					Retry same comparison
				</Button>
			) : null}
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void form.handleSubmit();
				}}
			>
				<FieldSet className="space-y-4" disabled={saving || Boolean(pending)}>
					<form.Field name="name">
						{(field) => (
							<Label className={labelClass} htmlFor={`${prefix}-name`}>
								Comparison name
								<Input
									className={inputClass}
									id={`${prefix}-name`}
									maxLength={120}
									onChange={(event) =>
										field.handleChange(event.currentTarget.value)
									}
									required
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
					<form.Field name="screenAssetVersionId">
						{(field) => {
							const screenVersion = choices.find(
								(version) => version.id === field.state.value
							);
							return (
								<>
									<Label className={labelClass} htmlFor={`${prefix}-screen`}>
										Screen version
										<NativeSelect
											className={selectClass}
											id={`${prefix}-screen`}
											onChange={(event) =>
												field.handleChange(event.currentTarget.value)
											}
											required
											value={field.state.value}
										>
											{versionOptions()}
										</NativeSelect>
									</Label>
									{screenVersion?.sourceImageDimensions ? (
										<UiStateComparisonPreview
											dimensions={screenVersion.sourceImageDimensions}
											key={screenVersion.id}
											name={`Screen · ${recordsById.get(screenVersion.assetRecordId)?.name}`}
											previewUrl={screenVersion.previewUrl}
										/>
									) : null}
								</>
							);
						}}
					</form.Field>
					<form.Field mode="array" name="items">
						{(itemsField) => (
							<>
								<div className="grid gap-4 lg:grid-cols-2">
									{itemsField.state.value.map((item, index) => {
										const version = choices.find(
											(choice) => choice.id === item.assetVersionId
										);
										const unitChoices = units.filter(
											(unit) =>
												unit.assetVersionId === item.assetVersionId &&
												unit.unitType === "state" &&
												unit.projectId === projectId
										);
										const rowId = `${prefix}-${item.key}`;
										return (
											<FieldSet
												className="min-w-0 space-y-3 rounded border p-3"
												key={item.key}
											>
												<FieldLegend>Component state {index + 1}</FieldLegend>
												<form.Field name={`items[${index}].componentId`}>
													{(field) => (
														<Label
															className={labelClass}
															htmlFor={`${rowId}-identity`}
														>
															Component identity
															<Input
																className={inputClass}
																id={`${rowId}-identity`}
																maxLength={120}
																onChange={(event) =>
																	field.handleChange(event.currentTarget.value)
																}
																required
																value={field.state.value}
															/>
														</Label>
													)}
												</form.Field>
												<form.Field name={`items[${index}].componentKind`}>
													{(field) => (
														<Label
															className={labelClass}
															htmlFor={`${rowId}-kind`}
														>
															Component kind
															<NativeSelect
																className={selectClass}
																id={`${rowId}-kind`}
																onChange={(event) =>
																	field.handleChange(
																		uiStateComparisonInputSchema.shape.items.element.shape.componentKind.parse(
																			event.currentTarget.value
																		)
																	)
																}
																value={field.state.value}
															>
																{uiComponentKinds.map((kind) => (
																	<NativeSelectOption key={kind} value={kind}>
																		{kindLabels[kind]}
																	</NativeSelectOption>
																))}
															</NativeSelect>
														</Label>
													)}
												</form.Field>
												<form.Field name={`items[${index}].state`}>
													{(field) => (
														<Label
															className={labelClass}
															htmlFor={`${rowId}-state`}
														>
															State
															<NativeSelect
																className={selectClass}
																id={`${rowId}-state`}
																onChange={(event) =>
																	field.handleChange(
																		uiStateComparisonInputSchema.shape.items.element.shape.state.parse(
																			event.currentTarget.value
																		)
																	)
																}
																value={field.state.value}
															>
																{uiComponentStates.map((state) => (
																	<NativeSelectOption key={state} value={state}>
																		{stateLabels[state]}
																	</NativeSelectOption>
																))}
															</NativeSelect>
														</Label>
													)}
												</form.Field>
												<form.Field name={`items[${index}].assetVersionId`}>
													{(field) => (
														<Label
															className={labelClass}
															htmlFor={`${rowId}-version`}
														>
															Component version
															<NativeSelect
																className={selectClass}
																id={`${rowId}-version`}
																onChange={(event) => {
																	const next = choices.find(
																		(choice) =>
																			choice.id === event.currentTarget.value
																	);
																	field.handleChange(next?.id ?? "");
																	form.setFieldValue(
																		`items[${index}].unitVersionId`,
																		null
																	);
																	form.setFieldValue(`items[${index}].region`, {
																		x: 0,
																		y: 0,
																		width:
																			next?.sourceImageDimensions?.width ?? 1,
																		height:
																			next?.sourceImageDimensions?.height ?? 1,
																	});
																}}
																required
																value={field.state.value}
															>
																{versionOptions()}
															</NativeSelect>
														</Label>
													)}
												</form.Field>
												<form.Field name={`items[${index}].unitVersionId`}>
													{(field) => (
														<Label
															className={labelClass}
															htmlFor={`${rowId}-unit`}
														>
															State Unit Version
															<NativeSelect
																className={selectClass}
																id={`${rowId}-unit`}
																onChange={(event) =>
																	field.handleChange(
																		event.currentTarget.value || null
																	)
																}
																value={field.state.value ?? ""}
															>
																<NativeSelectOption value="">
																	Whole image / explicit image region
																</NativeSelectOption>
																{unitChoices.map((unit) => (
																	<NativeSelectOption
																		key={unit.id}
																		value={unit.id}
																	>
																		{unit.unitKey} · Version{" "}
																		{unit.versionNumber}
																	</NativeSelectOption>
																))}
															</NativeSelect>
														</Label>
													)}
												</form.Field>
												<FieldSet className="grid grid-cols-2 gap-2">
													<FieldLegend>
														Source image region (px, top-left)
													</FieldLegend>
													{(["x", "y", "width", "height"] as const).map(
														(regionField) => (
															<form.Field
																key={regionField}
																name={`items[${index}].region.${regionField}`}
															>
																{(field) => (
																	<Label
																		className="block text-base leading-normal"
																		htmlFor={`${rowId}-${regionField}`}
																	>
																		{regionField}
																		<Input
																			className={inputClass}
																			id={`${rowId}-${regionField}`}
																			max={4096}
																			min={
																				regionField === "width" ||
																				regionField === "height"
																					? 1
																					: 0
																			}
																			onChange={(event) =>
																				field.handleChange(
																					Number(event.currentTarget.value)
																				)
																			}
																			required
																			type="number"
																			value={field.state.value}
																		/>
																	</Label>
																)}
															</form.Field>
														)
													)}
												</FieldSet>
												{version?.sourceImageDimensions ? (
													<UiStateComparisonPreview
														dimensions={version.sourceImageDimensions}
														key={version.id}
														name={`${item.componentId || "Component"} · ${kindLabels[item.componentKind]} · ${stateLabels[item.state]}`}
														previewUrl={version.previewUrl}
														region={item.region}
													/>
												) : null}
												{itemsField.state.value.length > 2 ? (
													<Button
														aria-label={`Remove component state ${index + 1}`}
														onClick={() => itemsField.removeValue(index)}
														type="button"
														variant="outline"
													>
														Remove state
													</Button>
												) : null}
											</FieldSet>
										);
									})}
								</div>
								<Button
									disabled={itemsField.state.value.length >= 49}
									onClick={() => itemsField.pushValue(newItem("normal"))}
									type="button"
									variant="outline"
								>
									Add component state
								</Button>
							</>
						)}
					</form.Field>
					<form.Field name="familyStyleNotes">
						{(field) => (
							<Label className={labelClass} htmlFor={`${prefix}-family-notes`}>
								Family style observations
								<Textarea
									className={inputClass}
									id={`${prefix}-family-notes`}
									maxLength={2000}
									onChange={(event) =>
										field.handleChange(event.currentTarget.value)
									}
									required
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
					<form.Field name="stateDistinctionNotes">
						{(field) => (
							<Label className={labelClass} htmlFor={`${prefix}-state-notes`}>
								State distinction observations
								<Textarea
									className={inputClass}
									id={`${prefix}-state-notes`}
									maxLength={2000}
									onChange={(event) =>
										field.handleChange(event.currentTarget.value)
									}
									required
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
					<form.Field name="outcome">
						{(field) => (
							<Label className={labelClass} htmlFor={`${prefix}-outcome`}>
								Comparison outcome
								<NativeSelect
									className={selectClass}
									id={`${prefix}-outcome`}
									onChange={(event) =>
										field.handleChange(
											uiStateComparisonInputSchema.shape.outcome.parse(
												event.currentTarget.value
											)
										)
									}
									value={field.state.value}
								>
									{Object.entries(outcomeLabels).map(([value, label]) => (
										<NativeSelectOption key={value} value={value}>
											{label}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Label>
						)}
					</form.Field>
					<Button
						disabled={
							saving ||
							Boolean(pending) ||
							query.isPending ||
							query.isError ||
							choices.length === 0
						}
						type="submit"
					>
						{saving ? "Saving comparison…" : "Save comparison"}
					</Button>
				</FieldSet>
			</form>
			{query.data?.length ? (
				<section aria-label="Saved UI State Comparisons" className="space-y-3">
					<h4 className="font-medium">Saved comparisons</h4>
					{query.data.map((record) => (
						<SavedComparison key={record.id} record={record} />
					))}
				</section>
			) : null}
		</section>
	);
}
function SavedComparison({ record }: { record: UiStateComparisonRecord }) {
	const screen = record.versionPins.find(
		(pin) => pin.assetVersionId === record.screenAssetVersionId
	);
	const previewUrl = (id: string) =>
		`/api/projects/${encodeURIComponent(record.projectId)}/asset-versions/${encodeURIComponent(id)}/preview`;
	return (
		<article className="space-y-3 rounded border p-3">
			<h5 className="font-medium">{record.name}</h5>
			<p>
				{outcomeLabels[record.outcome]} ·{" "}
				{new Date(record.createdAt).toLocaleString()}
			</p>
			<p>{record.familyStyleNotes}</p>
			<p>{record.stateDistinctionNotes}</p>
			<details>
				<summary className="min-h-11 cursor-pointer">
					Show comparison details
				</summary>
				<div className="space-y-3 pt-3">
					{screen ? (
						<UiStateComparisonPreview
							dimensions={screen.sourceImageDimensions}
							name={`Screen · ${screen.assetRecordName}`}
							previewUrl={previewUrl(screen.assetVersionId)}
						/>
					) : null}
					<div className="grid gap-3 sm:grid-cols-2">
						{record.items.map((item) => {
							const pin = record.versionPins.find(
								(candidate) => candidate.assetVersionId === item.assetVersionId
							);
							return (
								<div
									className="space-y-2"
									key={JSON.stringify([item.componentId, item.state])}
								>
									{pin ? (
										<UiStateComparisonPreview
											dimensions={pin.sourceImageDimensions}
											name={`${item.componentId} · ${kindLabels[item.componentKind]} · ${stateLabels[item.state]}`}
											previewUrl={previewUrl(pin.assetVersionId)}
											region={item.region}
										/>
									) : null}
									<p className="break-all text-muted-foreground text-xs">
										{pin?.assetRecordName} · Version {pin?.versionNumber} ·
										SHA-256 {pin?.contentDigest}
										{item.unitVersionId
											? ` · Unit Version ${item.unitVersionId}`
											: ""}
									</p>
								</div>
							);
						})}
					</div>
					<p>
						Profile revision: {record.contractRevisionId} ·{" "}
						{record.contractSnapshot.name}
					</p>
				</div>
			</details>
			<Button onClick={() => download(record)} type="button" variant="outline">
				Download comparison JSON
			</Button>
		</article>
	);
}
