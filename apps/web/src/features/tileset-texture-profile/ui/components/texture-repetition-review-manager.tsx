import type { UnitVersion } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	createTextureRepetitionPackage,
	type TextureEdgeCheck,
	type TextureRepetitionReviewInput,
	type TextureRepetitionReviewRecord,
	textureRepetitionReviewInputSchema,
} from "@sprite-anvil/api/texture-repetition-reviews";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";
import { TextureRepeatPreview } from "./texture-repeat-preview";

export interface TextureRepetitionReviewManagerProps {
	activation: ProjectProfileContractActivation;
	assetFamilyId: string;
	familyName: string;
	projectId: string;
	records: {
		id: string;
		name: string;
		assetCategory?: string | null;
		availability: string;
	}[];
	units: UnitVersion[];
	versions: {
		id: string;
		assetRecordId: string;
		assetFamilyId: string;
		previewUrl: string;
		integrityVerified: boolean;
		sourceImageDimensions?: { width: number; height: number } | null;
	}[];
}
const arrangementLabels = {
	"2x2": "2×2",
	"3x3": "3×3",
	shifted: "Shifted repetition",
};
const axesOptions: Record<string, ("x" | "y")[]> = {
	xy: ["x", "y"],
	x: ["x"],
	y: ["y"],
};
const arrangements = ["2x2", "3x3", "shifted"] as const;
const labelClass = "flex flex-col items-stretch gap-1";
const selectClass = "w-full";
function EdgeResults({ result }: { result: TextureEdgeCheck }) {
	return (
		<div className="text-sm" role="status">
			{(["x", "y"] as const).map((axis) => (
				<p key={axis}>
					{axis.toUpperCase()} edge:{" "}
					{result[axis]
						? `${result[axis].mismatchCount} mismatched pixels${result[axis].firstMismatch === null ? "" : `; first at ${result[axis].firstMismatch} px`}`
						: "not repeated"}
				</p>
			))}
		</div>
	);
}
function download(record: TextureRepetitionReviewRecord) {
	const contents = createTextureRepetitionPackage(record);
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(contents, null, 2)], { type: "application/json" })
	);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `texture-repetition-${record.id}.json`;
	anchor.click();
	URL.revokeObjectURL(url);
}
function getReviewableUnits(
	props: Pick<
		TextureRepetitionReviewManagerProps,
		"units" | "versions" | "records" | "assetFamilyId"
	>
) {
	return props.units.filter(
		(unit) =>
			unit.unitType === "tile" &&
			props.versions.some(
				(version) =>
					version.id === unit.assetVersionId &&
					version.assetFamilyId === props.assetFamilyId &&
					version.integrityVerified
			) &&
			props.records.some(
				(record) =>
					record.id === unit.assetRecordId &&
					record.assetCategory === "tileset_terrain_texture" &&
					record.availability !== "erased"
			)
	);
}
interface Region {
	height: number;
	width: number;
	x: number;
	y: number;
}
interface Offset {
	x: number;
	y: number;
}
interface Observation {
	arrangement: (typeof arrangements)[number];
	notes: string;
	outcome: string;
}
function emptyObservations(): Observation[] {
	return arrangements.map((arrangement) => ({
		arrangement,
		outcome: "",
		notes: "",
	}));
}

export function TextureRepetitionReviewManager({
	projectId,
	assetFamilyId,
	familyName,
	activation,
	units,
	versions,
	records,
}: TextureRepetitionReviewManagerProps) {
	const formId = useId();
	const reviewable = getReviewableUnits({
		units,
		versions,
		records,
		assetFamilyId,
	});
	const form = useForm({
		defaultValues: {
			unitId: reviewable[0]?.id ?? "",
			regionOverride: null as Region | null,
			axes: ["x", "y"] as ("x" | "y")[],
			offsetOverride: null as Offset | null,
			terrainId: "",
			zoom: 1,
			observations: emptyObservations(),
		},
		onSubmit: async ({ value }) => {
			await save(value);
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const unitId = getSelectedUnitId(reviewable, values.unitId);
	const previousUnitId = useRef(unitId);
	const unit = reviewable.find((item) => item.id === unitId);
	const version = versions.find((item) => item.id === unit?.assetVersionId);
	const { axes, observations, terrainId, zoom } = values;
	const onImageDimensions = useCallback(
		(dimensions: { width: number; height: number }) => {
			form.setFieldValue(
				"regionOverride",
				(previous) => previous ?? { x: 0, y: 0, ...dimensions }
			);
		},
		[form]
	);
	const region = getRegion(values.regionOverride, version);
	const offset = getOffset(values.offsetOverride, axes, region);
	const queryClient = useQueryClient();
	const inspectMutation = useMutation(
		orpc.textureRepetitionReviews.inspect.mutationOptions()
	);
	const saveMutation = useMutation(
		orpc.textureRepetitionReviews.save.mutationOptions()
	);
	const pending = inspectMutation.isPending || saveMutation.isPending;
	const [uncertain, setUncertain] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [edgeCheck, setEdgeCheck] = useState<TextureEdgeCheck | null>(null);
	const [saved, setSaved] = useState<TextureRepetitionReviewRecord | null>(
		null
	);
	const query = useQuery({
		...orpc.textureRepetitionReviews.list.queryOptions({
			input: { projectId, assetFamilyId },
		}),
	});
	const target = {
		projectId,
		assetFamilyId,
		contractRevisionId: activation.contractRevisionId,
		unitVersionId: unitId,
		atlasRegion: region,
		repeatAxes: axes,
		terrainId: terrainId.trim() || null,
	};
	const displayed = getDisplayedReviews(saved, query.data);
	const pendingInput = useRef<TextureRepetitionReviewInput | null>(null);
	const [previewReady, setPreviewReady] = useState<Record<string, boolean>>({});
	const onPreviewStatus = useCallback((key: string, ready: boolean) => {
		setPreviewReady((previous) => ({ ...previous, [key]: ready }));
	}, []);
	const previewKey = JSON.stringify({ unitId, region });
	const previewsReady = arrangements.every(
		(arrangement) => previewReady[`${previewKey}:${arrangement}`]
	);
	function invalidate() {
		form.setFieldValue("observations", emptyObservations());
		setEdgeCheck(null);
		setMessage("");
	}
	function resetUnitSelection() {
		form.setFieldValue("regionOverride", null);
		form.setFieldValue("offsetOverride", null);
		invalidate();
	}
	async function inspect() {
		setError("");
		try {
			setEdgeCheck(await inspectMutation.mutateAsync(target));
		} catch (cause) {
			setError(
				getErrorMessage(
					cause,
					"Texture edges could not be checked. Try again.",
					"query"
				)
			);
		}
	}
	async function save(value: { observations: Observation[] }) {
		setError("");
		setMessage("");
		const parsed = textureRepetitionReviewInputSchema.safeParse({
			...target,
			id: crypto.randomUUID(),
			shiftedOffset: offset,
			observations: value.observations,
		});
		if (!parsed.success) {
			setError(
				parsed.error.issues[0]?.message ?? "Complete all repeat observations."
			);
			return;
		}
		await persist(parsed.data);
	}
	async function persist(input: TextureRepetitionReviewInput) {
		pendingInput.current = input;
		try {
			const record = await saveMutation.mutateAsync(input);
			setSaved(record);
			setEdgeCheck(record.edgeCheck);
			setUncertain(false);
			setError("");
			setMessage("Texture review saved.");
			void queryClient.invalidateQueries({
				queryKey: orpc.textureRepetitionReviews.list.queryKey({
					input: { projectId, assetFamilyId },
				}),
			});
		} catch (cause) {
			setUncertain(isWriteOutcomeUncertain(cause));
			setError(getErrorMessage(cause, "Texture review could not be saved."));
		}
	}

	useEffect(() => {
		if (previousUnitId.current !== unitId) {
			previousUnitId.current = unitId;
			resetUnitSelection();
		}
	});
	if (activation.contract.profileId !== "tileset_terrain_texture") {
		return null;
	}
	return (
		<section className="space-y-4 rounded border p-4">
			<h3 className="font-medium">Texture repetition · {familyName}</h3>
			<p className="text-muted-foreground text-sm">
				Compare exact edges and record your visible repetition findings for each
				arrangement. Terrain ID is preserved as declared metadata; leave it
				blank when unknown.
			</p>
			{query.isError ? (
				<div role="alert">
					{getErrorMessage(
						query.error,
						"Texture reviews could not be loaded.",
						"query"
					)}{" "}
					<Button
						onClick={() => void query.refetch()}
						type="button"
						variant="outline"
					>
						Retry texture reviews
					</Button>
				</div>
			) : null}
			{reviewable.length ? (
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void form.handleSubmit();
					}}
				>
					<TextureReviewFeedback error={error} message={message} />
					{uncertain && pendingInput.current ? (
						<TextureUncertainReviewActions
							input={pendingInput.current}
							load={() => query.refetch()}
							onConfirmed={(record) => {
								setSaved(record);
								setUncertain(false);
								setError("");
								setMessage("Texture review saved.");
							}}
							onRetry={(input) => void persist(input)}
							pending={pending || query.isFetching}
						/>
					) : null}
					<FieldSet className="block space-y-4" disabled={pending || uncertain}>
						<form.Field name="unitId">
							{(field) => (
								<Label className={labelClass} htmlFor={`${formId}-unit`}>
									Texture unit
									<NativeSelect
										className={selectClass}
										id={`${formId}-unit`}
										onChange={(event) => {
											field.handleChange(event.target.value);
											resetUnitSelection();
										}}
										value={unitId}
									>
										{reviewable.map((item) => (
											<NativeSelectOption key={item.id} value={item.id}>
												{
													records.find(
														(record) => record.id === item.assetRecordId
													)?.name
												}{" "}
												· {item.unitKey} · v{item.versionNumber}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Label>
							)}
						</form.Field>
						<form.Field name="regionOverride">
							{(field) => (
								<div className="grid gap-3 sm:grid-cols-4">
									{(["x", "y", "width", "height"] as const).map((key) => (
										<Label
											className={labelClass}
											htmlFor={`${formId}-${key}`}
											key={key}
										>
											Atlas {key}
											<Input
												id={`${formId}-${key}`}
												min={key === "width" || key === "height" ? 1 : 0}
												onChange={(event) => {
													field.handleChange({
														...region,
														[key]: Number(event.target.value),
													});
													invalidate();
												}}
												required
												step="1"
												type="number"
												value={region[key]}
											/>
										</Label>
									))}
								</div>
							)}
						</form.Field>
						<form.Field name="terrainId">
							{(field) => (
								<Label className={labelClass} htmlFor={`${formId}-terrain`}>
									Terrain ID
									<Input
										id={`${formId}-terrain`}
										onChange={(event) => {
											field.handleChange(event.target.value);
											invalidate();
										}}
										value={field.state.value}
									/>
								</Label>
							)}
						</form.Field>
						<form.Field name="axes">
							{(field) => (
								<Label className={labelClass} htmlFor={`${formId}-axes`}>
									Repeat axes
									<NativeSelect
										className={selectClass}
										id={`${formId}-axes`}
										onChange={(event) => {
											field.handleChange(
												axesOptions[event.target.value] ?? ["x", "y"]
											);
											form.setFieldValue("offsetOverride", null);
											invalidate();
										}}
										value={axes.length === 2 ? "xy" : axes[0]}
									>
										<NativeSelectOption value="xy">X and Y</NativeSelectOption>
										<NativeSelectOption value="x">X only</NativeSelectOption>
										<NativeSelectOption value="y">Y only</NativeSelectOption>
									</NativeSelect>
								</Label>
							)}
						</form.Field>
						<div className="grid gap-3 sm:grid-cols-3">
							<form.Field name="offsetOverride">
								{(field) => (
									<>
										{(["x", "y"] as const).map((axis) => (
											<Label
												className={labelClass}
												htmlFor={`${formId}-shift-${axis}`}
												key={axis}
											>
												Shift {axis.toUpperCase()}
												<Input
													disabled={!axes.includes(axis)}
													id={`${formId}-shift-${axis}`}
													max={
														(axis === "x" ? region.width : region.height) - 1
													}
													min="0"
													onChange={(event) => {
														form.setFieldValue(
															"observations",
															clearShiftedObservation
														);
														field.handleChange({
															...offset,
															[axis]: Number(event.target.value),
														});
													}}
													step="1"
													type="number"
													value={offset[axis]}
												/>
											</Label>
										))}
									</>
								)}
							</form.Field>
							<form.Field name="zoom">
								{(field) => (
									<Label className={labelClass} htmlFor={`${formId}-zoom`}>
										Preview zoom
										<NativeSelect
											className={selectClass}
											id={`${formId}-zoom`}
											onChange={(event) =>
												field.handleChange(Number(event.target.value))
											}
											value={zoom}
										>
											{[1, 2, 4, 8].map((value) => (
												<NativeSelectOption key={value} value={value}>
													{value}×
												</NativeSelectOption>
											))}
										</NativeSelect>
									</Label>
								)}
							</form.Field>
						</div>
						<Button
							onClick={() => void inspect()}
							type="button"
							variant="outline"
						>
							Check exact edges
						</Button>
						{edgeCheck ? <EdgeResults result={edgeCheck} /> : null}
						<div className="grid gap-4 lg:grid-cols-3">
							{observations.map((observation, index) => (
								<div
									className="min-w-0 space-y-2"
									key={observation.arrangement}
								>
									<h4>{arrangementLabels[observation.arrangement]}</h4>
									{version ? (
										<TextureRepeatPreview
											arrangement={observation.arrangement}
											axes={axes}
											offset={offset}
											onDimensions={onImageDimensions}
											onStatus={onPreviewStatus}
											previewUrl={version.previewUrl}
											region={region}
											statusKey={`${previewKey}:${observation.arrangement}`}
											zoom={zoom}
										/>
									) : null}
									<form.Field name={`observations[${index}].outcome`}>
										{(field) => (
											<Label
												className={labelClass}
												htmlFor={`${formId}-outcome-${index}`}
											>
												{observation.arrangement} outcome
												<NativeSelect
													className={selectClass}
													id={`${formId}-outcome-${index}`}
													onChange={(event) =>
														field.handleChange(event.target.value)
													}
													required
													value={observation.outcome}
												>
													<NativeSelectOption value="">
														Choose outcome
													</NativeSelectOption>
													<NativeSelectOption value="passed">
														Passed
													</NativeSelectOption>
													<NativeSelectOption value="failed">
														Failed
													</NativeSelectOption>
													<NativeSelectOption value="inconclusive">
														Inconclusive
													</NativeSelectOption>
													<NativeSelectOption value="needs_follow_up">
														Needs follow-up
													</NativeSelectOption>
												</NativeSelect>
											</Label>
										)}
									</form.Field>
									<form.Field name={`observations[${index}].notes`}>
										{(field) => (
											<Label
												className={labelClass}
												htmlFor={`${formId}-notes-${index}`}
											>
												{observation.arrangement} notes
												<Textarea
													id={`${formId}-notes-${index}`}
													maxLength={2000}
													onChange={(event) =>
														field.handleChange(event.target.value)
													}
													required
													value={observation.notes}
												/>
											</Label>
										)}
									</form.Field>
								</div>
							))}
						</div>
						<Button
							disabled={!unit || query.isError || !previewsReady}
							type="submit"
						>
							{pending ? "Saving texture review…" : "Save texture review"}
						</Button>
					</FieldSet>
				</form>
			) : (
				<p>
					Create a tile Unit Version for a texture Asset Record in this family
					to review repetition.
				</p>
			)}
			<TextureReviewHistory onError={setError} records={displayed} />
		</section>
	);
}

function TextureReviewHistory({
	records,
	onError,
}: {
	records: TextureRepetitionReviewRecord[];
	onError: (message: string) => void;
}) {
	return (
		<div className="space-y-3">
			{records.map((record) => (
				<article className="space-y-2 rounded border p-3" key={record.id}>
					<h4>
						{record.unitSnapshot.unitKey} · {record.createdAt}
					</h4>
					<p className="text-sm">
						Unit {record.unitSnapshot.id} · Atlas {record.atlasRegion.x},{" "}
						{record.atlasRegion.y}, {record.atlasRegion.width} ×{" "}
						{record.atlasRegion.height} px · Terrain{" "}
						{record.terrainId ?? "Unknown"} · Repeat{" "}
						{record.repeatAxes.join(", ")} · Shift {record.shiftedOffset.x},{" "}
						{record.shiftedOffset.y}
					</p>
					<EdgeResults result={record.edgeCheck} />
					{record.observations.map((item) => (
						<p key={item.arrangement}>
							{item.arrangement}: {item.outcome} — {item.notes}
						</p>
					))}
					<Button
						disabled={Boolean(
							record.edgeCheck.x?.mismatchCount ||
								record.edgeCheck.y?.mismatchCount
						)}
						onClick={() => {
							try {
								download(record);
							} catch (cause) {
								onError(
									getErrorMessage(
										cause,
										"Texture operation failed. Check current reviews before trying again."
									)
								);
							}
						}}
						type="button"
						variant="outline"
					>
						Download texture metadata
					</Button>
				</article>
			))}
		</div>
	);
}

function getRegion(
	override: { x: number; y: number; width: number; height: number } | null,
	version: TextureRepetitionReviewManagerProps["versions"][number] | undefined
) {
	return (
		override ?? {
			x: 0,
			y: 0,
			width: version?.sourceImageDimensions?.width ?? 1,
			height: version?.sourceImageDimensions?.height ?? 1,
		}
	);
}
function getOffset(
	override: { x: number; y: number } | null,
	axes: ("x" | "y")[],
	region: { width: number; height: number }
) {
	return (
		override ?? {
			x: axes.includes("x") ? Math.floor(region.width / 2) : 0,
			y: axes.includes("y") ? Math.floor(region.height / 2) : 0,
		}
	);
}
function getDisplayedReviews(
	saved: TextureRepetitionReviewRecord | null,
	records: TextureRepetitionReviewRecord[] = []
) {
	return saved && !records.some((item) => item.id === saved.id)
		? [saved, ...records]
		: records;
}

function TextureUncertainReviewActions({
	input,
	load,
	pending,
	onConfirmed,
	onRetry,
}: {
	input: TextureRepetitionReviewInput;
	load: () => Promise<{
		data?: TextureRepetitionReviewRecord[];
		isError: boolean;
	}>;
	pending: boolean;
	onConfirmed: (record: TextureRepetitionReviewRecord) => void;
	onRetry: (input: TextureRepetitionReviewInput) => void;
}) {
	const [canRetrySame, setCanRetrySame] = useState(false);
	async function reconcile() {
		setCanRetrySame(false);
		const result = await load();
		const confirmed = result.data?.find((item) => item.id === input.id);
		if (confirmed) {
			onConfirmed(confirmed);
		} else if (!result.isError) {
			setCanRetrySame(true);
		}
	}
	return (
		<div className="flex flex-wrap gap-2">
			<Button
				disabled={pending}
				onClick={() => void reconcile()}
				type="button"
				variant="outline"
			>
				Check current texture reviews
			</Button>
			{canRetrySame ? (
				<Button
					disabled={pending}
					onClick={() => {
						setCanRetrySame(false);
						onRetry(input);
					}}
					type="button"
					variant="outline"
				>
					Retry same texture review
				</Button>
			) : null}
		</div>
	);
}

function getSelectedUnitId(units: UnitVersion[], selected: string) {
	return units.some((item) => item.id === selected)
		? selected
		: (units[0]?.id ?? "");
}
function clearShiftedObservation(
	items: {
		arrangement: "2x2" | "3x3" | "shifted";
		outcome: string;
		notes: string;
	}[]
) {
	return items.map((item) =>
		item.arrangement === "shifted" ? { ...item, outcome: "", notes: "" } : item
	);
}

function TextureReviewFeedback({
	error,
	message,
}: {
	error: string;
	message: string;
}) {
	return (
		<>
			{error ? <p role="alert">{error}</p> : null}
			{message ? <p role="status">{message}</p> : null}
		</>
	);
}
