import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	type BackgroundLayerLayoutInput,
	backgroundLayerLayoutInputSchema,
} from "@sprite-anvil/api/background-layer-layouts";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { type SyntheticEvent, useRef, useState } from "react";
import { ENV } from "@/env";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

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
	const [layers, setLayers] = useState<LayerDraft[]>(() => [newLayer(0)]);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
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
	function update(key: string, field: keyof LayerDraft, value: string) {
		setLayers((current) =>
			current.map((layer) =>
				layer.key === key ? { ...layer, [field]: value } : layer
			)
		);
		setMessage("");
		setError("");
	}
	function selectVersion(key: string, assetVersionId: string) {
		const version = available.find((v) => v.id === assetVersionId);
		const dimensions = version?.sourceImageDimensions;
		setLayers((current) =>
			current.map((layer) =>
				layer.key === key
					? {
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
						}
					: layer
			)
		);
		setMessage("");
		setError("");
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
			await client.backgroundLayerLayouts.save(input);
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
	async function save(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
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
			layers: layers.map((layer) =>
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
			<form className="space-y-4" onSubmit={save}>
				{error ? (
					<p ref={errorRef} role="alert" tabIndex={-1}>
						{error}
					</p>
				) : null}
				<fieldset
					className="space-y-4"
					disabled={saving || uncertain || query.isPending || query.isError}
				>
					<legend className="sr-only">Layer layout</legend>
					{layers.map((draft, index) => {
						const version = available.find(
							(v) => v.id === draft.assetVersionId
						);
						return (
							<fieldset
								className="space-y-3 rounded border p-3"
								key={draft.key}
							>
								<legend>Layer {index + 1}</legend>
								<div className="grid gap-3 sm:grid-cols-3">
									<label className="space-y-1" htmlFor={`${draft.key}-id`}>
										Layer identity
										<input
											className="block min-h-10 w-full rounded border p-2"
											id={`${draft.key}-id`}
											onChange={(e) => update(draft.key, "id", e.target.value)}
											required
											value={draft.id}
										/>
									</label>
									<label className="space-y-1" htmlFor={`${draft.key}-version`}>
										Exact version
										<select
											className="block min-h-10 w-full rounded border p-2"
											id={`${draft.key}-version`}
											onChange={(e) => selectVersion(draft.key, e.target.value)}
											required
											value={draft.assetVersionId}
										>
											<option value="">Select a version</option>
											{available.map((v) => (
												<option key={v.id} value={v.id}>
													{
														assetRecords.find((r) => r.id === v.assetRecordId)
															?.name
													}{" "}
													· v{v.versionNumber}
												</option>
											))}
										</select>
									</label>
									<p>
										Natural size:{" "}
										{version?.sourceImageDimensions
											? `${version.sourceImageDimensions.width} × ${version.sourceImageDimensions.height} px`
											: "Select a verified source version."}
									</p>
									{numericFields.map(([field, label]) => (
										<label
											className="space-y-1"
											htmlFor={`${draft.key}-${field}`}
											key={field}
										>
											{label}
											<input
												className="block min-h-10 w-full rounded border p-2"
												id={`${draft.key}-${field}`}
												min={
													[
														"order",
														"cropX",
														"cropY",
														"safeX",
														"safeY",
													].includes(field)
														? 0
														: 1
												}
												onChange={(e) =>
													update(draft.key, field, e.target.value)
												}
												required
												step={1}
												type="number"
												value={draft[field]}
											/>
										</label>
									))}
								</div>
								{version ? (
									<LayerPreview draft={draft} version={version} />
								) : null}
								<Button
									disabled={layers.length === 1}
									onClick={() =>
										setLayers((current) =>
											current.filter((layer) => layer.key !== draft.key)
										)
									}
									type="button"
								>
									Remove layer {index + 1}
								</Button>
							</fieldset>
						);
					})}
					<div className="flex flex-wrap gap-2">
						<Button
							disabled={layers.length >= 24}
							onClick={() =>
								setLayers((current) => [
									...current,
									newLayer(
										Math.max(...current.map((l) => Number(l.order) || 0)) + 1
									),
								])
							}
							type="button"
						>
							Add layer
						</Button>
						<Button disabled={available.length === 0} type="submit">
							{saving ? "Saving…" : "Save layer layout"}
						</Button>
					</div>
					{available.length === 0 ? (
						<p>
							Add a background Asset Version with verified source dimensions to
							this family first.
						</p>
					) : null}
				</fieldset>
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
			<h4 className="font-medium">Saved layer layouts</h4>
			<ul className="space-y-3">
				{query.data?.map((record) => (
					<li className="space-y-2 rounded border p-3" key={record.id}>
						<p>
							{new Date(record.createdAt).toLocaleString()} · Visual World:{" "}
							{record.visualWorldId}
						</p>
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
