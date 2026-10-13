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
import { useQuery } from "@tanstack/react-query";
import { type SyntheticEvent, useId, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
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
type Item = UiStateComparisonInput["items"][number] & { key: string };
const controlClass =
	"min-h-11 w-full rounded-md border bg-background px-3 py-2";
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
	const [items, setItems] = useState<Item[]>(() => [
		newItem("normal"),
		newItem("hover"),
	]);
	const [screenAssetVersionId, setScreenVersion] = useState("");
	const [name, setName] = useState("");
	const [familyStyleNotes, setFamilyNotes] = useState("");
	const [stateDistinctionNotes, setStateNotes] = useState("");
	const [outcome, setOutcome] =
		useState<UiStateComparisonInput["outcome"]>("inconclusive");
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
	const query = useQuery({
		...orpc.uiStateComparisons.list.queryOptions({
			input: { projectId, assetFamilyId },
		}),
		enabled: activation?.contract.profileId === "ui",
	});
	if (activation?.contract.profileId !== "ui" || recordsById.size === 0) {
		return null;
	}
	const screenVersion = choices.find(
		(version) => version.id === screenAssetVersionId
	);
	function patch(key: string, change: Partial<Item>) {
		setItems((current) =>
			current.map((item) => (item.key === key ? { ...item, ...change } : item))
		);
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
			const saved = await client.uiStateComparisons.save(input);
			setPending(input);
			const result = await query.refetch();
			const persisted = result.data?.find((record) => record.id === saved.id);
			if (
				!result.isError &&
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
	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		const parsed = uiStateComparisonInputSchema.safeParse({
			id: crypto.randomUUID(),
			projectId,
			assetFamilyId,
			contractRevisionId: activation?.contractRevisionId,
			screenAssetVersionId,
			name,
			familyStyleNotes,
			stateDistinctionNotes,
			outcome,
			items: items.map(({ key: _key, ...item }) => item),
		});
		if (!parsed.success) {
			setMessage(parsed.error.issues[0]?.message ?? "Check comparison fields.");
			return;
		}
		void save(parsed.data);
	}
	function versionOptions() {
		return (
			<>
				<option value="">Choose a version</option>
				{choices.map((version) => (
					<option key={version.id} value={version.id}>
						{recordsById.get(version.assetRecordId)?.name} · Version{" "}
						{version.versionNumber}
					</option>
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
			<form className="space-y-4" onSubmit={submit}>
				<fieldset className="space-y-4" disabled={saving || Boolean(pending)}>
					<label className="block space-y-1" htmlFor={`${prefix}-name`}>
						Comparison name
						<input
							className={controlClass}
							id={`${prefix}-name`}
							maxLength={120}
							onChange={(event) => setName(event.currentTarget.value)}
							required
							value={name}
						/>
					</label>
					<label className="block space-y-1" htmlFor={`${prefix}-screen`}>
						Screen version
						<select
							className={controlClass}
							id={`${prefix}-screen`}
							onChange={(event) => setScreenVersion(event.currentTarget.value)}
							required
							value={screenAssetVersionId}
						>
							{versionOptions()}
						</select>
					</label>
					{screenVersion?.sourceImageDimensions ? (
						<UiStateComparisonPreview
							dimensions={screenVersion.sourceImageDimensions}
							key={screenVersion.id}
							name={`Screen · ${recordsById.get(screenVersion.assetRecordId)?.name}`}
							previewUrl={screenVersion.previewUrl}
						/>
					) : null}
					<div className="grid gap-4 lg:grid-cols-2">
						{items.map((item, index) => {
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
								<fieldset
									className="min-w-0 space-y-3 rounded border p-3"
									key={item.key}
								>
									<legend>Component state {index + 1}</legend>
									<label
										className="block space-y-1"
										htmlFor={`${rowId}-identity`}
									>
										Component identity
										<input
											className={controlClass}
											id={`${rowId}-identity`}
											maxLength={120}
											onChange={(event) =>
												patch(item.key, {
													componentId: event.currentTarget.value,
												})
											}
											required
											value={item.componentId}
										/>
									</label>
									<label className="block space-y-1" htmlFor={`${rowId}-kind`}>
										Component kind
										<select
											className={controlClass}
											id={`${rowId}-kind`}
											onChange={(event) => {
												const parsed =
													uiStateComparisonInputSchema.shape.items.element.shape.componentKind.parse(
														event.currentTarget.value
													);
												patch(item.key, { componentKind: parsed });
											}}
											value={item.componentKind}
										>
											{uiComponentKinds.map((kind) => (
												<option key={kind} value={kind}>
													{kindLabels[kind]}
												</option>
											))}
										</select>
									</label>
									<label className="block space-y-1" htmlFor={`${rowId}-state`}>
										State
										<select
											className={controlClass}
											id={`${rowId}-state`}
											onChange={(event) =>
												patch(item.key, {
													state:
														uiStateComparisonInputSchema.shape.items.element.shape.state.parse(
															event.currentTarget.value
														),
												})
											}
											value={item.state}
										>
											{uiComponentStates.map((state) => (
												<option key={state} value={state}>
													{stateLabels[state]}
												</option>
											))}
										</select>
									</label>
									<label
										className="block space-y-1"
										htmlFor={`${rowId}-version`}
									>
										Component version
										<select
											className={controlClass}
											id={`${rowId}-version`}
											onChange={(event) => {
												const next = choices.find(
													(choice) => choice.id === event.currentTarget.value
												);
												patch(item.key, {
													assetVersionId: next?.id ?? "",
													unitVersionId: null,
													region: {
														x: 0,
														y: 0,
														width: next?.sourceImageDimensions?.width ?? 1,
														height: next?.sourceImageDimensions?.height ?? 1,
													},
												});
											}}
											required
											value={item.assetVersionId}
										>
											{versionOptions()}
										</select>
									</label>
									<label className="block space-y-1" htmlFor={`${rowId}-unit`}>
										State Unit Version
										<select
											className={controlClass}
											id={`${rowId}-unit`}
											onChange={(event) =>
												patch(item.key, {
													unitVersionId: event.currentTarget.value || null,
												})
											}
											value={item.unitVersionId ?? ""}
										>
											<option value="">
												Whole image / explicit image region
											</option>
											{unitChoices.map((unit) => (
												<option key={unit.id} value={unit.id}>
													{unit.unitKey} · Version {unit.versionNumber}
												</option>
											))}
										</select>
									</label>
									<fieldset className="grid grid-cols-2 gap-2">
										<legend>Source image region (px, top-left)</legend>
										{(["x", "y", "width", "height"] as const).map((field) => (
											<label htmlFor={`${rowId}-${field}`} key={field}>
												{field}
												<input
													className={controlClass}
													id={`${rowId}-${field}`}
													max={4096}
													min={field === "width" || field === "height" ? 1 : 0}
													onChange={(event) =>
														patch(item.key, {
															region: {
																...item.region,
																[field]: Number(event.currentTarget.value),
															},
														})
													}
													required
													type="number"
													value={item.region[field]}
												/>
											</label>
										))}
									</fieldset>
									{version?.sourceImageDimensions ? (
										<UiStateComparisonPreview
											dimensions={version.sourceImageDimensions}
											key={version.id}
											name={`${item.componentId || "Component"} · ${kindLabels[item.componentKind]} · ${stateLabels[item.state]}`}
											previewUrl={version.previewUrl}
											region={item.region}
										/>
									) : null}
									{items.length > 2 ? (
										<Button
											aria-label={`Remove component state ${index + 1}`}
											onClick={() =>
												setItems((current) =>
													current.filter(
														(candidate) => candidate.key !== item.key
													)
												)
											}
											type="button"
											variant="outline"
										>
											Remove state
										</Button>
									) : null}
								</fieldset>
							);
						})}
					</div>
					<Button
						disabled={items.length >= 49}
						onClick={() =>
							setItems((current) => [...current, newItem("normal")])
						}
						type="button"
						variant="outline"
					>
						Add component state
					</Button>
					<label className="block space-y-1" htmlFor={`${prefix}-family-notes`}>
						Family style observations
						<textarea
							className={controlClass}
							id={`${prefix}-family-notes`}
							maxLength={2000}
							onChange={(event) => setFamilyNotes(event.currentTarget.value)}
							required
							value={familyStyleNotes}
						/>
					</label>
					<label className="block space-y-1" htmlFor={`${prefix}-state-notes`}>
						State distinction observations
						<textarea
							className={controlClass}
							id={`${prefix}-state-notes`}
							maxLength={2000}
							onChange={(event) => setStateNotes(event.currentTarget.value)}
							required
							value={stateDistinctionNotes}
						/>
					</label>
					<label className="block space-y-1" htmlFor={`${prefix}-outcome`}>
						Comparison outcome
						<select
							className={controlClass}
							id={`${prefix}-outcome`}
							onChange={(event) =>
								setOutcome(
									uiStateComparisonInputSchema.shape.outcome.parse(
										event.currentTarget.value
									)
								)
							}
							value={outcome}
						>
							{Object.entries(outcomeLabels).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>
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
				</fieldset>
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
