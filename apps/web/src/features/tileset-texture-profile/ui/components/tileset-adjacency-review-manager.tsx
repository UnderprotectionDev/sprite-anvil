import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import type {
	TilesetAdjacencyReviewInput,
	TilesetAdjacencyReviewRecord,
	TilesetTestMap,
	TilesetTile,
} from "@sprite-anvil/api/tileset-adjacency-reviews";
import {
	inspectTilesetAdjacency,
	tilesetAdjacencyReviewInputSchema,
	tilesetMapScenarioLabels,
} from "@sprite-anvil/api/tileset-adjacency-reviews";
import { getTilesetReviewEvidenceError } from "@sprite-anvil/api/tileset-scenario-evidence";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { createTilesetTestMaps } from "../../lib/tileset-map-presets";
import {
	tilesetIssueFormDefaults,
	tilesetIssueFormSchema,
} from "../../schemas";
import { TilesetAtlasTileEditor } from "./tileset-atlas-tile-editor";
import { TilesetMap } from "./tileset-map";

type Tile = TilesetTile & { tileId: string; assetVersionId: string };
const labelClass = "flex flex-col items-stretch gap-1";
const selectClass = "w-full *:data-[slot=native-select]:min-h-11";
export function TilesetAdjacencyReviewManager({
	activation,
	assetFamilyId,
	familyName,
	projectId,
	catalog,
	assetRecords,
}: {
	activation: ProjectProfileContractActivation;
	assetFamilyId: string;
	familyName: string;
	projectId: string;
	catalog: AssetVersionCatalog;
	assetRecords: AssetRecord[];
}) {
	const prefix = useId();
	const reviews = useQuery(
		orpc.tilesetAdjacencyReviews.list.queryOptions({
			input: { projectId, assetFamilyId },
		})
	);
	const recordIds = new Set(
		assetRecords
			.filter(
				(record) =>
					record.assetCategory === "tileset_terrain_texture" &&
					record.availability !== "erased"
			)
			.map((record) => record.id)
	);
	const composites = catalog.compositeVersions.filter(
		(composite) =>
			recordIds.has(composite.assetRecordId) &&
			composite.compositionMemberships.length > 0 &&
			composite.compositionMemberships.every(
				(member) => member.unitType === "tile"
			)
	);
	const form = useForm({
		defaultValues: { compositeId: "", ...tilesetIssueFormDefaults },
	});
	const { compositeId, issueNotes, neighborIndex } = useStore(
		form.store,
		(state) => state.values
	);
	const [tiles, setTiles] = useState<Tile[]>([]);
	const [maps, setMaps] = useState<TilesetTestMap[]>([]);
	const [scenarioIndex, setScenarioIndex] = useState(0);
	const [brush, setBrush] = useState<string | null>(null);
	const [inspectOnly, setInspectOnly] = useState(false);
	const [cellIndex, setCellIndex] = useState(0);
	const [previewGeneration, setPreviewGeneration] = useState(0);
	const [previewReady, setPreviewReady] = useState<Record<string, boolean>>({});
	const [status, setStatus] = useState("");
	const saveMutation = useMutation(
		orpc.tilesetAdjacencyReviews.save.mutationOptions(mutationMeta)
	);
	const [saving, setSaving] = useState(false);
	const [pending, setPending] = useState<TilesetAdjacencyReviewInput | null>(
		null
	);
	const map = maps[scenarioIndex];
	const automaticIssues = inspectTilesetAdjacency({ tiles, maps });
	const locked = saving || pending !== null;
	function resetEditor(nextBrush: string | null, inspection: boolean) {
		setBrush(nextBrush);
		setInspectOnly(inspection);
		setPreviewReady({});
		setPreviewGeneration((current) => current + 1);
		setCellIndex(0);
		setScenarioIndex(0);
		form.setFieldValue("neighborIndex", "");
		form.setFieldValue("issueNotes", "");
	}
	function chooseComposite(id: string) {
		const composite = composites.find((item) => item.id === id);
		const selected: Tile[] = [];
		for (const member of composite?.compositionMemberships ?? []) {
			const unit = catalog.unitVersions.find(
				(item) => item.id === member.unitVersionId
			);
			const version = catalog.assetVersions.find(
				(item) =>
					item.id === unit?.assetVersionId &&
					item.assetFamilyId === assetFamilyId
			);
			if (!(unit && version?.sourceImageDimensions)) {
				continue;
			}
			selected.push({
				unitVersionId: unit.id,
				tileId: unit.unitKey,
				assetVersionId: version.id,
				terrainId: null,
				region: { x: 0, y: 0, ...version.sourceImageDimensions },
				edges: { north: null, east: null, south: null, west: null },
			});
		}
		form.setFieldValue("compositeId", id);
		setTiles(selected);
		setMaps(
			selected[0]
				? createTilesetTestMaps(
						selected[0].unitVersionId,
						selected[1]?.unitVersionId ?? null
					)
				: []
		);
		resetEditor(selected[0]?.unitVersionId ?? null, false);
		setStatus("");
	}
	function updateMap(changes: Partial<TilesetTestMap>) {
		setMaps((current) =>
			current.map((item, index) =>
				index === scenarioIndex ? { ...item, ...changes } : item
			)
		);
	}
	function loadReview(record: TilesetAdjacencyReviewRecord) {
		form.setFieldValue("compositeId", record.compositeVersionId);
		setTiles(
			record.tiles.map((tile) => ({
				...tile,
				tileId:
					record.versionPins.find(
						(pin) => pin.unitVersionId === tile.unitVersionId
					)?.tileId ?? tile.unitVersionId,
				assetVersionId:
					record.versionPins.find(
						(pin) => pin.unitVersionId === tile.unitVersionId
					)?.assetVersionId ?? "",
			}))
		);
		setMaps(structuredClone(record.maps));
		resetEditor(record.tiles[0]?.unitVersionId ?? null, true);
		setStatus("Saved review loaded.");
	}
	function createReviewRequest(): TilesetAdjacencyReviewInput | null {
		const parsed = tilesetAdjacencyReviewInputSchema.safeParse({
			id: crypto.randomUUID(),
			projectId,
			assetFamilyId,
			compositeVersionId: compositeId,
			contractRevisionId: activation.contractRevisionId,
			tiles: tiles.map(
				({ tileId: _tileId, assetVersionId: _assetVersionId, ...tile }) => tile
			),
			maps,
		});
		if (!parsed.success) {
			setStatus(parsed.error.issues[0]?.message ?? "Complete the review.");
			return null;
		}
		const evidenceError = getTilesetReviewEvidenceError(parsed.data);
		if (evidenceError) {
			setStatus(evidenceError);
			return null;
		}
		if (tiles.some((tile) => !previewReady[tile.unitVersionId])) {
			setStatus("Load every tile preview before saving.");
			return null;
		}
		return parsed.data;
	}
	async function saveReview() {
		const request = pending ?? createReviewRequest();
		if (!request) {
			return;
		}
		setPending(request);
		setSaving(true);
		try {
			await saveMutation.mutateAsync(request);
			const readback = await reviews.refetch();
			if (
				readback.isError ||
				!readback.data?.some((item) => item.id === request.id)
			) {
				setStatus(
					"Saved review could not be reloaded. Retry the same review to check its saved result."
				);
				return;
			}
			setPending(null);
			setStatus("Tileset adjacency review saved.");
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setStatus(
					"Save result is uncertain. Retry the same review to check its saved result."
				);
			} else {
				setPending(null);
				setStatus(
					getErrorMessage(
						error,
						"Review was rejected. Check the fields and save again."
					)
				);
			}
		} finally {
			setSaving(false);
		}
	}
	return (
		<section className="space-y-4 rounded-lg border p-4">
			<h3 className="font-semibold text-lg">
				Karo Komşuluklarını Test Haritasında Sınama · {familyName}
			</h3>
			<p className="text-muted-foreground text-sm">
				Paint small usage examples and inspect tile connections. Visual
				judgments remain yours. This test map is not a level editor.
			</p>
			<p role="status">{status}</p>
			{reviews.isError ? (
				<p role="alert">
					Reviews could not be loaded.{" "}
					<Button onClick={() => void reviews.refetch()} type="button">
						Reload reviews
					</Button>
				</p>
			) : null}
			<div className="flex flex-wrap gap-2">
				{reviews.data?.map((record) => (
					<Button
						disabled={locked}
						key={record.id}
						onClick={() => loadReview(record)}
						type="button"
						variant="outline"
					>
						Open review · {new Date(record.createdAt).toLocaleString()}
					</Button>
				))}
			</div>
			<FieldSet className="block space-y-4" disabled={locked}>
				<Label className={labelClass} htmlFor={`${prefix}-composition`}>
					Birleşik Sürüm
					<NativeSelect
						className={selectClass}
						id={`${prefix}-composition`}
						onChange={(event) => chooseComposite(event.target.value)}
						value={compositeId}
					>
						<NativeSelectOption value="">
							Choose a tileset composition
						</NativeSelectOption>
						{composites.map((item) => (
							<NativeSelectOption key={item.id} value={item.id}>
								{
									assetRecords.find(
										(record) => record.id === item.assetRecordId
									)?.name
								}{" "}
								· Composition {item.versionNumber}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Label>
				{composites.length === 0 ? (
					<p>
						Bu ailede önce karo Birim Sürümlerini ve bir Birleşik Sürüm
						oluşturun.
					</p>
				) : null}
				<div className="grid gap-4 xl:grid-cols-2">
					<div className="space-y-3">
						<h4 className="font-semibold">Atlas tiles</h4>
						{tiles.map((tile, index) => (
							<TilesetAtlasTileEditor
								key={`${previewGeneration}:${tile.unitVersionId}`}
								onChange={(updated) =>
									setTiles((current) =>
										current.map((item) =>
											item.unitVersionId === tile.unitVersionId
												? { ...item, ...updated }
												: item
										)
									)
								}
								onReady={(ready) =>
									setPreviewReady((current) =>
										current[tile.unitVersionId] === ready
											? current
											: { ...current, [tile.unitVersionId]: ready }
									)
								}
								prefix={`${prefix}-tile-${index}`}
								tile={tile}
								tileId={tile.tileId}
								version={catalog.assetVersions.find(
									(version) => version.id === tile.assetVersionId
								)}
							/>
						))}
					</div>
					<div className="space-y-3">
						<h4 className="font-semibold">Test map</h4>
						<Label className={labelClass} htmlFor={`${prefix}-scenario`}>
							Scenario
							<NativeSelect
								className={selectClass}
								id={`${prefix}-scenario`}
								onChange={(event) => {
									setScenarioIndex(Number(event.target.value));
									setCellIndex(0);
								}}
								value={scenarioIndex}
							>
								{maps.map((item, index) => (
									<NativeSelectOption key={item.scenario} value={index}>
										{tilesetMapScenarioLabels[item.scenario]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
						<Label className={labelClass} htmlFor={`${prefix}-brush`}>
							Paint tile
							<NativeSelect
								className={selectClass}
								id={`${prefix}-brush`}
								onChange={(event) => setBrush(event.target.value || null)}
								value={brush ?? ""}
							>
								<NativeSelectOption value="">Erase</NativeSelectOption>
								{tiles.map((tile) => (
									<NativeSelectOption
										key={tile.unitVersionId}
										value={tile.unitVersionId}
									>
										{tile.tileId}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
						<Label
							className="flex min-h-11 items-center gap-2"
							htmlFor={`${prefix}-inspect`}
						>
							<Checkbox
								checked={inspectOnly}
								disabled={locked}
								id={`${prefix}-inspect`}
								onCheckedChange={setInspectOnly}
							/>
							Inspect without painting
						</Label>
						{map ? (
							<>
								<Button
									onClick={() =>
										updateMap({
											cells: map.cells.map(() => brush),
											issues: [],
											outcome: "inconclusive",
										})
									}
									type="button"
									variant="outline"
								>
									Fill with selected tile
								</Button>
								<Button
									onClick={() =>
										updateMap({
											cells: map.cells.map(
												() =>
													tiles[Math.floor(Math.random() * tiles.length)]
														?.unitVersionId ?? null
											),
											issues: [],
											outcome: "inconclusive",
										})
									}
									type="button"
									variant="outline"
								>
									Randomize placement
								</Button>
								<TilesetMap
									map={map}
									onInspect={setCellIndex}
									onPaint={
										inspectOnly
											? undefined
											: (index) =>
													updateMap({
														cells: map.cells.map((cell, i) =>
															i === index ? brush : cell
														),
														outcome: "inconclusive",
														issues: map.issues.filter(
															(issue) =>
																issue.cellIndex !== index &&
																issue.neighborIndex !== index
														),
													})
									}
									tiles={tiles}
									versions={catalog.assetVersions}
								/>
								<p>
									Cell {cellIndex + 1} ·{" "}
									{tiles.find(
										(tile) => tile.unitVersionId === map.cells[cellIndex]
									)?.tileId ?? "Empty"}
								</p>
								<Label className={labelClass} htmlFor={`${prefix}-neighbor`}>
									Connection to cell (optional)
									<Input
										className="min-h-11"
										id={`${prefix}-neighbor`}
										max={map.cells.length}
										min={1}
										onChange={(event) =>
											form.setFieldValue("neighborIndex", event.target.value)
										}
										type="number"
										value={neighborIndex}
									/>
								</Label>
								<Label className={labelClass} htmlFor={`${prefix}-issue`}>
									Tile or connection issue
									<Textarea
										id={`${prefix}-issue`}
										maxLength={1000}
										onChange={(event) =>
											form.setFieldValue("issueNotes", event.target.value)
										}
										value={issueNotes}
									/>
								</Label>
								<Button
									disabled={!(issueNotes.trim() && map.cells[cellIndex])}
									onClick={() => {
										const parsed = tilesetIssueFormSchema.safeParse({
											issueNotes,
											neighborIndex,
										});
										if (!parsed.success) {
											setStatus(
												parsed.error.issues[0]?.message ?? "Complete the issue."
											);
											return;
										}
										const neighbor = neighborIndex
											? Number(neighborIndex) - 1
											: null;
										updateMap({
											outcome: "failed",
											issues: [
												...map.issues.filter(
													(issue) =>
														issue.cellIndex !== cellIndex ||
														issue.neighborIndex !== neighbor
												),
												{
													cellIndex,
													neighborIndex: neighbor,
													notes: issueNotes,
												},
											],
										});
										form.setFieldValue("issueNotes", "");
									}}
									type="button"
									variant="outline"
								>
									Record issue
								</Button>
								{map.issues.map((issue, index) => (
									<p key={JSON.stringify(issue)}>
										Cell {issue.cellIndex + 1}
										{issue.neighborIndex === null
											? ""
											: ` → ${issue.neighborIndex + 1}`}
										: {issue.notes}{" "}
										<Button
											onClick={() =>
												updateMap({
													issues: map.issues.filter((_, i) => i !== index),
													outcome: "inconclusive",
												})
											}
											type="button"
											variant="outline"
										>
											Remove issue {index + 1}
										</Button>
									</p>
								))}
								<ul>
									{automaticIssues
										.filter((issue) => issue.scenario === map.scenario)
										.map((issue) => (
											<li key={`${issue.cellIndex}-${issue.edge}`}>
												Cell {issue.cellIndex + 1} → {issue.neighborIndex + 1}:{" "}
												{issue.result} ({issue.edge})
											</li>
										))}
								</ul>
								<p className="text-muted-foreground text-sm">
									Connector checks compare declared edge labels; they do not
									check exact image pixels.
								</p>
								<Label className={labelClass} htmlFor={`${prefix}-outcome`}>
									Scenario result
									<NativeSelect
										className={selectClass}
										id={`${prefix}-outcome`}
										onChange={(event) =>
											updateMap({
												outcome: event.target
													.value as TilesetTestMap["outcome"],
											})
										}
										value={map.outcome}
									>
										<NativeSelectOption value="inconclusive">
											Inconclusive
										</NativeSelectOption>
										<NativeSelectOption value="passed">
											Passed
										</NativeSelectOption>
										<NativeSelectOption value="failed">
											Failed
										</NativeSelectOption>
									</NativeSelect>
								</Label>
								<Label className={labelClass} htmlFor={`${prefix}-notes`}>
									Scenario observations
									<Textarea
										id={`${prefix}-notes`}
										maxLength={2000}
										onChange={(event) =>
											updateMap({ notes: event.target.value })
										}
										value={map.notes}
									/>
								</Label>
							</>
						) : null}
					</div>
				</div>
			</FieldSet>
			<Button
				disabled={
					saving || reviews.isPending || reviews.isError || tiles.length === 0
				}
				onClick={() => void saveReview()}
				type="button"
			>
				{saveButtonLabel(saving, pending !== null)}
			</Button>
		</section>
	);
}

function saveButtonLabel(saving: boolean, pending: boolean) {
	if (saving) {
		return "Saving review…";
	}
	if (pending) {
		return "Retry same review";
	}
	return "Save adjacency review";
}
