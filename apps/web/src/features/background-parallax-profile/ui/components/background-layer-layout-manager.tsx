import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	type BackgroundLayerLayoutInput,
	type BackgroundLayerLayoutRecord,
	backgroundLayerLayoutInputSchema,
} from "@sprite-anvil/api/background-layer-layouts";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ENV } from "@/env";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

import { BackgroundScrollingSetup } from "./background-scrolling-setup";

type LayoutVersion = Pick<
	AssetVersion,
	| "id"
	| "assetFamilyId"
	| "assetRecordId"
	| "versionNumber"
	| "integrityVerified"
	| "contentDigest"
	| "sourceImageDimensions"
	| "previewUrl"
>;
export interface BackgroundLayerLayoutManagerProps {
	activation: ProjectProfileContractActivation;
	assetFamilyId: string;
	assetRecords: Pick<
		AssetRecord,
		"id" | "name" | "assetCategory" | "availability"
	>[];
	familyName: string;
	projectId: string;
	versions: LayoutVersion[];
	visualWorldId: string;
}
const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";
const numericFields = [
	["order", "Layer order"],
	["ratioWidth", "Target ratio width"],
	["ratioHeight", "Target ratio height"],
	["cropX", "Crop X"],
	["cropY", "Crop Y"],
	["cropWidth", "Crop width"],
	["cropHeight", "Crop height"],
	["safeX", "Safe area X"],
	["safeY", "Safe area Y"],
	["safeWidth", "Safe area width"],
	["safeHeight", "Safe area height"],
] as const;
type NumericField = (typeof numericFields)[number][0];
interface LayerDraft extends Record<NumericField, string> {
	assetVersionId: string;
	id: string;
	key: string;
}
function newLayer(order: number): LayerDraft {
	return {
		key: crypto.randomUUID(),
		id: "",
		assetVersionId: "",
		order: String(order),
		ratioWidth: "",
		ratioHeight: "",
		cropX: "0",
		cropY: "0",
		cropWidth: "",
		cropHeight: "",
		safeX: "",
		safeY: "",
		safeWidth: "",
		safeHeight: "",
	};
}
function layerInput(draft: LayerDraft, version: LayoutVersion | undefined) {
	return {
		id: draft.id,
		assetVersionId: draft.assetVersionId,
		assetRecordId: version?.assetRecordId ?? "",
		order: Number(draft.order),
		naturalSize: version?.sourceImageDimensions,
		targetAspectRatio: {
			width: Number(draft.ratioWidth),
			height: Number(draft.ratioHeight),
		},
		crop: {
			x: Number(draft.cropX),
			y: Number(draft.cropY),
			width: Number(draft.cropWidth),
			height: Number(draft.cropHeight),
		},
		safeArea: {
			x: Number(draft.safeX),
			y: Number(draft.safeY),
			width: Number(draft.safeWidth),
			height: Number(draft.safeHeight),
		},
	};
}
function LayerPreview({
	draft,
	version,
}: {
	draft: LayerDraft;
	version: LayoutVersion;
}) {
	const dimensions = version.sourceImageDimensions;
	if (!dimensions) {
		return null;
	}
	const source = version.previewUrl.startsWith("/")
		? `${serverUrl}${version.previewUrl}`
		: version.previewUrl;
	return (
		<svg
			aria-label={`${draft.id || "Layer"} crop and safe area preview`}
			className="max-h-60 w-full rounded border"
			role="img"
			viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
		>
			<title>Source image, crop boundary and player safe area</title>
			<image
				height={dimensions.height}
				href={source}
				width={dimensions.width}
			/>
			<rect
				fill="none"
				height={draft.cropHeight || 0}
				stroke="white"
				strokeDasharray="4 2"
				strokeWidth="2"
				width={draft.cropWidth || 0}
				x={draft.cropX || 0}
				y={draft.cropY || 0}
			/>
			<rect
				fill="none"
				height={draft.safeHeight || 0}
				stroke="lime"
				strokeWidth="2"
				width={draft.safeWidth || 0}
				x={draft.safeX || 0}
				y={draft.safeY || 0}
			/>
		</svg>
	);
}
export function BackgroundLayerLayoutManager({
	activation,
	projectId,
	assetFamilyId,
	familyName,
	visualWorldId,
	assetRecords,
	versions,
}: BackgroundLayerLayoutManagerProps) {
	const query = useQuery({
		...orpc.backgroundLayerLayouts.list.queryOptions({
			input: { projectId, assetFamilyId },
		}),
	});
	const [scrollingLayout, setScrollingLayout] =
		useState<BackgroundLayerLayoutRecord | null>(null);
	const [initialLayers] = useState<LayerDraft[]>(() => [newLayer(0)]);
	const form = useForm({
		defaultValues: { layers: initialLayers },
		onSubmit: async ({ value }) => {
			await save(value.layers);
		},
	});
	const layers = useStore(form.store, (state) => state.values.layers);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const saveMutation = useMutation(
		orpc.backgroundLayerLayouts.save.mutationOptions(mutationMeta)
	);
	const [saving, setSaving] = useState(false);
	const [uncertain, setUncertain] = useState(false);
	const [pendingInput, setPendingInput] =
		useState<BackgroundLayerLayoutInput | null>(null);
	const [checking, setChecking] = useState(false);
	const errorRef = useRef<HTMLParagraphElement>(null);
	const available = versions.filter(
		(v) =>
			v.assetFamilyId === assetFamilyId &&
			v.integrityVerified &&
			v.contentDigest &&
			v.sourceImageDimensions &&
			assetRecords.some(
				(r) =>
					r.id === v.assetRecordId &&
					r.assetCategory === "background_parallax" &&
					r.availability !== "erased"
			)
	);
	function clearFeedback() {
		setMessage("");
		setError("");
	}
	function selectVersion(index: number, assetVersionId: string) {
		const version = available.find((v) => v.id === assetVersionId);
		const dimensions = version?.sourceImageDimensions;
		form.setFieldValue(`layers[${index}]`, (layer) => ({
			...layer,
			assetVersionId,
			ratioWidth: String(dimensions?.width ?? ""),
			ratioHeight: String(dimensions?.height ?? ""),
			cropX: "0",
			cropY: "0",
			cropWidth: String(dimensions?.width ?? ""),
			cropHeight: String(dimensions?.height ?? ""),
			safeX: "",
			safeY: "",
			safeWidth: "",
			safeHeight: "",
		}));
		clearFeedback();
	}
	async function confirmLayout(input: BackgroundLayerLayoutInput) {
		const result = await query.refetch();
		if (
			!result.isError &&
			result.data?.some((record) => record.id === input.id)
		) {
			setPendingInput(null);
			setUncertain(false);
			setError("");
			setMessage("Layer layout saved.");
			return;
		}
		setUncertain(true);
		setError(
			result.isError
				? "Could not confirm the saved layout. Check current layouts again."
				: "The pending layout is not visible yet. Check current layouts again or retry the same layout."
		);
	}
	async function persistLayout(input: BackgroundLayerLayoutInput) {
		if (saving || checking) {
			return;
		}
		setSaving(true);
		setPendingInput(input);
		setMessage("");
		setError("");
		try {
			await saveMutation.mutateAsync(input);
			await confirmLayout(input);
		} catch (failure) {
			setError(getErrorMessage(failure, "Could not save the layer layout."));
			const outcomeUncertain = uncertain || isWriteOutcomeUncertain(failure);
			setUncertain(outcomeUncertain);
			if (!outcomeUncertain) {
				setPendingInput(null);
			}
		} finally {
			setSaving(false);
		}
	}
	async function checkCurrentLayouts() {
		if (!pendingInput || saving || checking) {
			return;
		}
		setChecking(true);
		try {
			await confirmLayout(pendingInput);
		} finally {
			setChecking(false);
		}
	}
	async function save(drafts: LayerDraft[]) {
		if (saving || uncertain || checking) {
			return;
		}
		setMessage("");
		setError("");
		const parsed = backgroundLayerLayoutInputSchema.safeParse({
			id: crypto.randomUUID(),
			projectId,
			assetFamilyId,
			visualWorldId,
			contractRevisionId: activation.contractRevisionId,
			layers: drafts.map((layer) =>
				layerInput(
					layer,
					available.find((v) => v.id === layer.assetVersionId)
				)
			),
		});
		if (!parsed.success) {
			setError(parsed.error.issues.map((issue) => issue.message).join(" "));
			requestAnimationFrame(() => errorRef.current?.focus());
			return;
		}
		await persistLayout(parsed.data);
	}
	return (
		<section className="space-y-4 rounded-lg border p-4">
			<h3 className="font-semibold">Background layer layout · {familyName}</h3>
			<p className="text-muted-foreground text-sm">
				Define layers from back to front using unique order values. Crop and
				player safe area use source-image pixels from the top-left corner. White
				dashed outline: crop; solid green outline: player safe area.
			</p>
			<p>Actual scrolling test is still required.</p>
			{query.isError ? (
				<div role="alert">
					{getErrorMessage(
						query.error,
						"Could not load layer layouts.",
						"query"
					)}{" "}
					<Button onClick={() => query.refetch()} type="button">
						Retry
					</Button>
				</div>
			) : null}
			{query.isPending ? <p role="status">Loading layer layouts…</p> : null}
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void form.handleSubmit();
				}}
			>
				{error ? (
					<p ref={errorRef} role="alert" tabIndex={-1}>
						{error}
					</p>
				) : null}
				<FieldSet
					className="block space-y-4"
					disabled={saving || uncertain || query.isPending || query.isError}
				>
					<FieldLegend className="sr-only">Layer layout</FieldLegend>
					<form.Field mode="array" name="layers">
						{(layersField) => (
							<>
								{layers.map((draft, index) => {
									const version = available.find(
										(v) => v.id === draft.assetVersionId
									);
									return (
										<FieldSet
											className="block space-y-3 rounded border p-3"
											key={draft.key}
										>
											<FieldLegend>Layer {index + 1}</FieldLegend>
											<div className="grid gap-3 sm:grid-cols-3">
												<form.Field name={`layers[${index}].id`}>
													{(field) => (
														<Label
															className="block space-y-1 leading-normal"
															htmlFor={`${draft.key}-id`}
														>
															Layer identity
															<Input
																className="block min-h-10"
																id={`${draft.key}-id`}
																onChange={(e) => {
																	field.handleChange(e.target.value);
																	clearFeedback();
																}}
																required
																value={draft.id}
															/>
														</Label>
													)}
												</form.Field>
												<form.Field name={`layers[${index}].assetVersionId`}>
													{(field) => (
														<Label
															className="block space-y-1 leading-normal"
															htmlFor={`${draft.key}-version`}
														>
															Exact version
															<NativeSelect
																className="block w-full *:data-[slot=native-select]:min-h-10"
																id={`${draft.key}-version`}
																onChange={(e) => {
																	field.handleChange(e.target.value);
																	selectVersion(index, e.target.value);
																}}
																required
																value={draft.assetVersionId}
															>
																<NativeSelectOption value="">
																	Select a version
																</NativeSelectOption>
																{available.map((v) => (
																	<NativeSelectOption key={v.id} value={v.id}>
																		{
																			assetRecords.find(
																				(r) => r.id === v.assetRecordId
																			)?.name
																		}{" "}
																		· v{v.versionNumber}
																	</NativeSelectOption>
																))}
															</NativeSelect>
														</Label>
													)}
												</form.Field>
												<p>
													Natural size:{" "}
													{version?.sourceImageDimensions
														? `${version.sourceImageDimensions.width} × ${version.sourceImageDimensions.height} px`
														: "Select a verified source version."}
												</p>
												{numericFields.map(([numericField, label]) => (
													<form.Field
														key={numericField}
														name={`layers[${index}].${numericField}`}
													>
														{(field) => (
															<Label
																className="block space-y-1 leading-normal"
																htmlFor={`${draft.key}-${numericField}`}
															>
																{label}
																<Input
																	className="block min-h-10"
																	id={`${draft.key}-${numericField}`}
																	min={
																		[
																			"order",
																			"cropX",
																			"cropY",
																			"safeX",
																			"safeY",
																		].includes(numericField)
																			? 0
																			: 1
																	}
																	onChange={(e) => {
																		field.handleChange(e.target.value);
																		clearFeedback();
																	}}
																	required
																	step={1}
																	type="number"
																	value={draft[numericField]}
																/>
															</Label>
														)}
													</form.Field>
												))}
											</div>
											{version ? (
												<LayerPreview draft={draft} version={version} />
											) : null}
											<Button
												disabled={layers.length === 1}
												onClick={() => layersField.removeValue(index)}
												type="button"
											>
												Remove layer {index + 1}
											</Button>
										</FieldSet>
									);
								})}
								<div className="flex flex-wrap gap-2">
									<Button
										disabled={layers.length >= 24}
										onClick={() =>
											layersField.pushValue(
												newLayer(
													Math.max(...layers.map((l) => Number(l.order) || 0)) +
														1
												)
											)
										}
										type="button"
									>
										Add layer
									</Button>
									<Button disabled={available.length === 0} type="submit">
										{saving ? "Saving…" : "Save layer layout"}
									</Button>
								</div>
							</>
						)}
					</form.Field>
					{available.length === 0 ? (
						<p>
							Add a background Asset Version with verified source dimensions to
							this family first.
						</p>
					) : null}
				</FieldSet>
			</form>
			{message ? <p role="status">{message}</p> : null}
			{uncertain ? (
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={saving || checking}
						onClick={checkCurrentLayouts}
						type="button"
					>
						Check current layouts
					</Button>
					{pendingInput ? (
						<Button
							disabled={saving || checking}
							onClick={() => persistLayout(pendingInput)}
							type="button"
						>
							{saving ? "Saving…" : "Retry same layout"}
						</Button>
					) : null}
				</div>
			) : null}
			{scrollingLayout ? (
				<BackgroundScrollingSetup
					assetRecords={assetRecords}
					key={scrollingLayout.id}
					layout={scrollingLayout}
					versions={versions}
				/>
			) : null}
			<h4 className="font-medium">Saved layer layouts</h4>
			<ul className="space-y-3">
				{query.data?.map((record) => (
					<li className="space-y-2 rounded border p-3" key={record.id}>
						<p>
							{new Date(record.createdAt).toLocaleString()} · Visual World:{" "}
							{record.visualWorldId}
						</p>
						<Button onClick={() => setScrollingLayout(record)} type="button">
							Test scrolling
						</Button>
						<ol>
							{[...record.layers]
								.sort((a, b) => a.order - b.order)
								.map((layer) => {
									const pin = record.versionPins.find(
										(v) => v.assetVersionId === layer.assetVersionId
									);
									return (
										<li key={layer.id}>
											<p>
												{layer.id} · {pin?.assetRecordName} · v
												{pin?.versionNumber}
											</p>
											<p>
												Order {layer.order} · {layer.naturalSize.width} ×{" "}
												{layer.naturalSize.height} px · Ratio{" "}
												{layer.targetAspectRatio.width}:
												{layer.targetAspectRatio.height}
											</p>
											<p>
												Crop: {layer.crop.x}, {layer.crop.y}, {layer.crop.width}{" "}
												× {layer.crop.height} · Safe area: {layer.safeArea.x},{" "}
												{layer.safeArea.y}, {layer.safeArea.width} ×{" "}
												{layer.safeArea.height}
											</p>
										</li>
									);
								})}
						</ol>
					</li>
				))}
			</ul>
		</section>
	);
}
