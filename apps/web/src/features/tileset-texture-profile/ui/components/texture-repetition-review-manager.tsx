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
import { useQuery } from "@tanstack/react-query";
import { useCallback, useId, useRef, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
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
const fieldStyle = "w-full rounded border bg-background p-2";
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
	const [selectedUnitId, setUnitId] = useState(reviewable[0]?.id ?? "");
	const unitId = getSelectedUnitId(reviewable, selectedUnitId);
	const [previousUnitId, setPreviousUnitId] = useState(unitId);
	const unit = reviewable.find((item) => item.id === unitId);
	const version = versions.find((item) => item.id === unit?.assetVersionId);
	const [regionOverride, setRegionOverride] = useState<{
		x: number;
		y: number;
		width: number;
		height: number;
	} | null>(null);
	const onImageDimensions = useCallback(
		(dimensions: { width: number; height: number }) => {
			setRegionOverride(
				(previous) => previous ?? { x: 0, y: 0, ...dimensions }
			);
		},
		[]
	);
	const region = getRegion(regionOverride, version);
	const [axes, setAxes] = useState<("x" | "y")[]>(["x", "y"]);
	const [offsetOverride, setOffset] = useState<{ x: number; y: number } | null>(
		null
	);
	const offset = getOffset(offsetOverride, axes, region);
	const [terrainId, setTerrainId] = useState("");
	const [zoom, setZoom] = useState(1);
	const [observations, setObservations] = useState(
		arrangements.map((arrangement) => ({
			arrangement,
			outcome: "" as string,
			notes: "",
		}))
	);
	const [pending, setPending] = useState(false);
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
		setObservations(
			arrangements.map((arrangement) => ({
				arrangement,
				outcome: "",
				notes: "",
			}))
		);
		setEdgeCheck(null);
		setMessage("");
	}
	async function inspect() {
		setPending(true);
		setError("");
		try {
			setEdgeCheck(await client.textureRepetitionReviews.inspect(target));
		} catch (cause) {
			setError(
				getErrorMessage(
					cause,
					"Texture edges could not be checked. Try again.",
					"query"
				)
			);
		} finally {
			setPending(false);
		}
	}
	async function save(event: React.SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		setError("");
		setMessage("");
		const parsed = textureRepetitionReviewInputSchema.safeParse({
			...target,
			id: crypto.randomUUID(),
			shiftedOffset: offset,
			observations,
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
		setPending(true);
		try {
			const record = await client.textureRepetitionReviews.save(input);
			setSaved(record);
			setEdgeCheck(record.edgeCheck);
			setUncertain(false);
			setError("");
			setMessage("Texture review saved.");
			void query.refetch();
		} catch (cause) {
			setUncertain(isWriteOutcomeUncertain(cause));
			setError(getErrorMessage(cause, "Texture review could not be saved."));
		} finally {
			setPending(false);
		}
	}

	if (previousUnitId !== unitId) {
		setPreviousUnitId(unitId);
		setRegionOverride(null);
		setOffset(null);
		invalidate();
	}
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
				<form className="space-y-4" onSubmit={save}>
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
					<fieldset className="space-y-4" disabled={pending || uncertain}>
						<label className="block" htmlFor={`${formId}-unit`}>
							Texture unit
							<select
								className={fieldStyle}
								id={`${formId}-unit`}
								onChange={(event) => {
									setUnitId(event.target.value);
									setRegionOverride(null);
									setOffset(null);

									invalidate();
								}}
								value={unitId}
							>
								{reviewable.map((item) => (
									<option key={item.id} value={item.id}>
										{
											records.find((record) => record.id === item.assetRecordId)
												?.name
										}{" "}
										· {item.unitKey} · v{item.versionNumber}
									</option>
								))}
							</select>
						</label>
						<div className="grid gap-3 sm:grid-cols-4">
							{(["x", "y", "width", "height"] as const).map((key) => (
								<label htmlFor={`${formId}-${key}`} key={key}>
									Atlas {key}
									<input
										className={fieldStyle}
										id={`${formId}-${key}`}
										min={key === "width" || key === "height" ? 1 : 0}
										onChange={(event) => {
											setRegionOverride({
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
								</label>
							))}
						</div>
						<label className="block" htmlFor={`${formId}-terrain`}>
							Terrain ID
							<input
								className={fieldStyle}
								id={`${formId}-terrain`}
								onChange={(event) => {
									setTerrainId(event.target.value);
									invalidate();
								}}
								value={terrainId}
							/>
						</label>
						<label className="block" htmlFor={`${formId}-axes`}>
							Repeat axes
							<select
								className={fieldStyle}
								id={`${formId}-axes`}
								onChange={(event) => {
									setAxes(axesOptions[event.target.value] ?? ["x", "y"]);
									setOffset(null);
									invalidate();
								}}
								value={axes.length === 2 ? "xy" : axes[0]}
							>
								<option value="xy">X and Y</option>
								<option value="x">X only</option>
								<option value="y">Y only</option>
							</select>
						</label>
						<div className="grid gap-3 sm:grid-cols-3">
							{(["x", "y"] as const).map((axis) => (
								<label htmlFor={`${formId}-shift-${axis}`} key={axis}>
									Shift {axis.toUpperCase()}
									<input
										className={fieldStyle}
										disabled={!axes.includes(axis)}
										id={`${formId}-shift-${axis}`}
										max={(axis === "x" ? region.width : region.height) - 1}
										min="0"
										onChange={(event) => {
											setObservations(clearShiftedObservation);
											setOffset({
												...offset,
												[axis]: Number(event.target.value),
											});
										}}
										step="1"
										type="number"
										value={offset[axis]}
									/>
								</label>
							))}
							<label htmlFor={`${formId}-zoom`}>
								Preview zoom
								<select
									className={fieldStyle}
									id={`${formId}-zoom`}
									onChange={(event) => setZoom(Number(event.target.value))}
									value={zoom}
								>
									{[1, 2, 4, 8].map((value) => (
										<option key={value} value={value}>
											{value}×
										</option>
									))}
								</select>
							</label>
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
									<label
										className="block"
										htmlFor={`${formId}-outcome-${index}`}
									>
										{observation.arrangement} outcome
										<select
											className={fieldStyle}
											id={`${formId}-outcome-${index}`}
											onChange={(event) =>
												setObservations((items) =>
													updateObservation(items, index, {
														outcome: event.target.value,
													})
												)
											}
											required
											value={observation.outcome}
										>
											<option value="">Choose outcome</option>
											<option value="passed">Passed</option>
											<option value="failed">Failed</option>
											<option value="inconclusive">Inconclusive</option>
											<option value="needs_follow_up">Needs follow-up</option>
										</select>
									</label>
									<label className="block" htmlFor={`${formId}-notes-${index}`}>
										{observation.arrangement} notes
										<textarea
											className={fieldStyle}
											id={`${formId}-notes-${index}`}
											maxLength={2000}
											onChange={(event) =>
												setObservations((items) =>
													updateObservation(items, index, {
														notes: event.target.value,
													})
												)
											}
											required
											value={observation.notes}
										/>
									</label>
								</div>
							))}
						</div>
						<Button
							disabled={!unit || query.isError || !previewsReady}
							type="submit"
						>
							{pending ? "Saving texture review…" : "Save texture review"}
						</Button>
					</fieldset>
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

function updateObservation(
	items: {
		arrangement: "2x2" | "3x3" | "shifted";
		outcome: string;
		notes: string;
	}[],
	index: number,
	changes: { outcome?: string; notes?: string }
) {
	return items.map((item, position) =>
		position === index ? { ...item, ...changes } : item
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
